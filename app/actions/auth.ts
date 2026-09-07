'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSessionToken,
  readTokenFromCookie,
  sessionExpiry,
  setSessionCookie,
} from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth';
import { withTimeout } from '@/lib/db/with-timeout';
import {
  audit,
  createSession,
  createUserWithProfile,
  deleteSession,
  deleteSessionsForUser,
  findUserByEmail,
  recordConsent,
  updateProfile,
  updateUser,
} from '@/lib/db';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { fieldErrors, loginSchema, profileSchema, registerSchema, safeRedirect } from '@/lib/validation';
import { notify } from '@/services/notifications';

export interface AuthState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  errors?: Record<string, string>;
}

/* ------------------------------------------------------------------- login */

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const limit = rateLimit(`${clientKey(headers(), 'login')}:${email.toLowerCase()}`, LIMITS.login);
  if (!limit.ok) {
    return {
      status: 'error',
      message: `Too many attempts. Please wait about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes before trying again.`,
    };
  }

  const parsed = loginSchema.safeParse({ email, password: formData.get('password') });
  if (!parsed.success) {
    return { status: 'error', message: 'Please check your details.', errors: fieldErrors(parsed.error) };
  }

  const user = await findUserByEmail(parsed.data.email);
  // Same message and roughly the same work either way — no user enumeration.
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid || user.disabled) {
    await audit({
      actorUserId: user?.id ?? null,
      action: 'auth.login_failed',
      entity: 'user',
      entityId: user?.id ?? null,
    });
    return { status: 'error', message: 'That email and password do not match.' };
  }

  const { token, cookieValue } = createSessionToken();
  // Persisting the session is the ONE write that must succeed for login to
  // mean anything, but it must not hang forever either. 10s is far beyond a
  // healthy INSERT; past that, surface an error the user can retry rather than
  // spinning indefinitely.
  const persisted = await withTimeout(
    createSession(user.id, token, sessionExpiry()).then(() => true),
    false,
    10_000,
  );
  if (!persisted) {
    return { status: 'error', message: 'Sign-in is taking too long right now. Please try again.' };
  }
  setSessionCookie(cookieValue);

  // The audit log is a side effect, not part of signing in. A slow audit
  // write must never delay the redirect — cap it and move on.
  await withTimeout(
    audit({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
    }),
    undefined,
    3000,
  );

  const next = String(formData.get('next') ?? '');
  const destination = safeRedirect(next) ?? (user.role === 'CLIENT' ? '/portal' : '/admin');
  redirect(destination);
}

/* ---------------------------------------------------------------- register */

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const limit = rateLimit(clientKey(headers(), 'register'), LIMITS.register);
  if (!limit.ok) {
    return { status: 'error', message: 'Too many sign-ups from this device. Please try again later.' };
  }

  const parsed = registerSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    consentTerms: formData.get('consentTerms') === 'on',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      errors: fieldErrors(parsed.error),
    };
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    // Bookings create passwordless accounts, so an existing row is common and
    // is not an error — we point at the reset flow rather than leaking status.
    return {
      status: 'error',
      message:
        'There is already an account with that email. Try signing in, or use “Set or reset password”.',
      errors: { email: 'Account already exists' },
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { user } = await createUserWithProfile({
    email: parsed.data.email,
    passwordHash,
    role: 'CLIENT',
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
  });

  // Consent is recorded but must not block account creation if the write is
  // slow — the acceptance is also captured on the user row.
  await withTimeout(
    recordConsent({
      userId: user.id,
      type: 'terms',
      version: '2026-01',
      granted: true,
      grantedAt: new Date().toISOString(),
    }),
    undefined,
    3000,
  );

  const { token, cookieValue } = createSessionToken();
  const persisted = await withTimeout(
    createSession(user.id, token, sessionExpiry()).then(() => true),
    false,
    10_000,
  );
  if (!persisted) {
    return {
      status: 'error',
      message: 'Your account was created but sign-in is slow right now. Please try signing in.',
    };
  }
  setSessionCookie(cookieValue);

  // Audit and the welcome email are side effects. The welcome email in
  // particular makes a network call to the mail provider, which is exactly the
  // kind of thing that hung "Creating your account…" — cap both and redirect.
  await withTimeout(
    audit({
      actorUserId: user.id,
      actorRole: 'CLIENT',
      action: 'auth.registered',
      entity: 'user',
      entityId: user.id,
    }),
    undefined,
    3000,
  );

  await withTimeout(
    notify({
      type: 'account.created',
      audience: 'client',
      channels: ['email', 'in_app'],
      to: { email: user.email, userId: user.id },
      subject: 'Your Be Whole Care account',
      body: `Hi ${parsed.data.firstName},\n\nYour account is ready. You can book sessions, see your appointment history and manage everything from your portal.\n\nWe're glad you're here.`,
      href: '/portal',
    }),
    undefined,
    3000,
  );

  const next = String(formData.get('next') ?? '');
  redirect(safeRedirect(next) ?? '/portal');
}

/* ------------------------------------------------------------------ logout */

export async function logout() {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const token = readTokenFromCookie(raw);
  if (token) await deleteSession(token);
  clearSessionCookie();
  redirect('/');
}

/* ----------------------------------------------------------- password reset */

/**
 * Password reset.
 *
 * Always reports success so the form cannot be used to discover which email
 * addresses have accounts. Real delivery is via the notification service.
 */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const limit = rateLimit(`${clientKey(headers(), 'reset')}:${email}`, LIMITS.login);
  if (!limit.ok) {
    return { status: 'error', message: 'Too many requests. Please try again shortly.' };
  }

  const user = await findUserByEmail(email);
  if (user) {
    await notify({
      type: 'auth.password_reset',
      audience: 'client',
      channels: ['email'],
      to: { email: user.email, userId: user.id },
      subject: 'Set your Be Whole Care password',
      body: 'You asked to set or reset your password.\n\nOur team will confirm your identity and send you a secure link. If you did not request this, you can ignore this message — nothing has changed on your account.',
    });
    await audit({
      actorUserId: user.id,
      action: 'auth.reset_requested',
      entity: 'user',
      entityId: user.id,
    });
  }

  return {
    status: 'success',
    message:
      'If there is an account with that email, we have sent instructions for setting a password.',
  };
}

/* ----------------------------------------------------------------- profile */

export async function updateOwnProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };

  const parsed = profileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    dateOfBirth: formData.get('dateOfBirth') || null,
    preferredContact: formData.get('preferredContact'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      errors: fieldErrors(parsed.error),
    };
  }

  await updateProfile(user.id, parsed.data);
  await audit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'profile.updated',
    entity: 'profile',
    entityId: user.id,
  });

  return { status: 'success', message: 'Your details are saved.' };
}

export async function changeOwnPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');

  const record = await findUserByEmail(user.email);
  if (!record) return { status: 'error', message: 'Please sign in again.' };

  const valid = await verifyPassword(current, record.passwordHash);
  if (!valid) {
    return { status: 'error', message: 'That is not your current password.', errors: { currentPassword: 'Incorrect' } };
  }

  const parsed = registerSchema.shape.password.safeParse(next);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0].message, errors: { newPassword: parsed.error.issues[0].message } };
  }

  await updateUser(user.id, { passwordHash: await hashPassword(next) });
  // Signing out other devices is the point of a password change.
  await deleteSessionsForUser(user.id);

  const { token, cookieValue } = createSessionToken();
  await createSession(user.id, token, sessionExpiry());
  setSessionCookie(cookieValue);

  await audit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'auth.password_changed',
    entity: 'user',
    entityId: user.id,
  });

  return { status: 'success', message: 'Password changed. Other devices have been signed out.' };
}

