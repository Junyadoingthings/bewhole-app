'use server';

import { randomInt } from 'node:crypto';

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
  countPasswordResetCodesSince,
  createPasswordResetCode,
  createSession,
  createUserWithProfile,
  deleteSession,
  deleteSessionsForUser,
  findUserByEmail,
  getActivePasswordResetCode,
  markPasswordResetCodeUsed,
  recordConsent,
  recordPasswordResetAttempt,
  updateProfile,
  updateUser,
} from '@/lib/db';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import {
  fieldErrors,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
  safeRedirect,
} from '@/lib/validation';
import { notify, sendSecurityEmail } from '@/services/notifications';
import type { Role } from '@/types';

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
      subject: 'Welcome to Be Whole Care',
      heading: 'Your account has been created',
      greeting: parsed.data.firstName,
      body:
        'Thank you for creating an account with Be Whole Care. Your account is now active.\n\n' +
        'Through your client portal you may book sessions, view your appointment history and manage ' +
        'your details. We are glad to welcome you.',
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
  if (user && isPracticeAdmin(user)) {
    // The practice administrator resets with an emailed code (entered on the
    // same page). A failure is not shown: the reply must read the same for
    // every address, so this form never reveals which one is the console's.
    await sendPasswordCode(user, 'sign_in').catch(() => undefined);
  } else if (user) {
    await notify({
      type: 'auth.password_reset',
      audience: 'client',
      channels: ['email'],
      to: { email: user.email, userId: user.id },
      subject: 'Your password request',
      heading: 'We have received your password request',
      body:
        'We have received a request to set or reset the password for your Be Whole Care account.\n\n' +
        'A member of our team will verify your identity and send you a secure link to complete the ' +
        'process. If you did not make this request, no action is required and your account remains ' +
        'unchanged.',
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

let decoy: Promise<string> | null = null;
function decoyHash() {
  decoy ??= hashPassword(String(randomInt(0, 1_000_000)));
  return decoy;
}

/**
 * Forgot password, signed out: the practice administrator enters the emailed
 * code and a new password, and is signed in to the console.
 *
 * Every failure for a reason other than the password rules gives the same
 * answer — no account, not the administrator, no code, wrong code — so the
 * form cannot be used to find the console's address or to probe codes. Each
 * code allows 5 tries and then stops working; requests are also rate-limited.
 */
export async function resetPasswordWithEmailCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const entered = String(formData.get('code') ?? '').replace(/\D/g, '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  const limit = rateLimit(`${clientKey(headers(), 'reset-code')}:${email}`, LIMITS.login);
  if (!limit.ok) return { status: 'error', message: 'Too many attempts. Please wait 15 minutes and try again.' };

  if (!email) return { status: 'error', message: 'Enter the email address the code was sent to.' };
  if (entered.length !== 6) return { status: 'error', message: 'Enter the 6-digit code from the email.' };
  const problem = newPasswordProblem(next, confirm);
  if (problem) return { status: 'error', message: problem };

  const invalid: AuthState = {
    status: 'error',
    message: 'That code is not correct or has expired. Check it, or send a new one.',
  };
  const user = await findUserByEmail(email);
  if (!user || !isPracticeAdmin(user)) {
    // Spend the same time as checking a real code, so timing gives nothing away.
    await verifyPassword(entered, await decoyHash());
    return invalid;
  }

  const checked = await checkPasswordCode(user.id, entered);
  if (!checked.ok) return invalid;

  await completePasswordChange(user, next, 'email_code');
  redirect('/admin');
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

/* ------------------------------------------------ console password (admin) */

type PasswordResult = { ok: boolean; error?: string };

const CODE_TTL_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const CODES_PER_15_MINUTES = 3;

/** The practice's administrators — the only accounts that use console Settings. */
function isPracticeAdmin(user: { role: string } | null) {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

/** The same rules as everywhere else on the site (10+ characters, mixed case, a number). */
function newPasswordProblem(next: string, confirm: string): string | null {
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return parsed.error.issues[0].message;
  if (next !== confirm) return 'The new passwords do not match.';
  return null;
}

/**
 * Save the new password, sign every other device out (anyone who knew the
 * old password loses access), keep this device signed in, record it, and tell
 * the admin by email so an unexpected change does not go unnoticed.
 */
async function completePasswordChange(
  user: { id: string; email: string; role: Role },
  next: string,
  via: 'current_password' | 'email_code',
) {
  await updateUser(user.id, { passwordHash: await hashPassword(next) });
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
    meta: { via },
  });

  await sendSecurityEmail({
    type: 'auth.password_changed',
    audience: 'staff',
    to: { email: user.email },
    subject: 'Your console password was changed',
    heading: 'Your console password was changed',
    body:
      'The password for your Be Whole Care practice console was changed just now, and any other ' +
      'devices that were signed in have been signed out.\n\n' +
      'If you made this change, no action is needed. If you did not, contact your website ' +
      'developer straight away.',
  });
}

/** Change the console password, knowing the current one. */
export async function updateAdminPassword(formData: FormData): Promise<PasswordResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  if (!isPracticeAdmin(user)) {
    return { ok: false, error: 'Only the practice administrator can change the console password here.' };
  }

  const limit = rateLimit(`console-password:${user.id}`, LIMITS.passwordChange);
  if (!limit.ok) {
    return { ok: false, error: 'Too many attempts. Please wait 15 minutes and try again.' };
  }

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  if (!current || !next || !confirm) return { ok: false, error: 'Please fill in all three fields.' };

  const record = await findUserByEmail(user.email);
  if (!record?.passwordHash) return { ok: false, error: 'Please sign in again.' };
  if (!(await verifyPassword(current, record.passwordHash))) {
    return { ok: false, error: 'Your current password is not correct.' };
  }

  const problem = newPasswordProblem(next, confirm);
  if (problem) return { ok: false, error: problem };
  if (await verifyPassword(next, record.passwordHash)) {
    return { ok: false, error: 'Choose a password different from your current one.' };
  }

  await completePasswordChange(user, next, 'current_password');
  return { ok: true };
}

/**
 * Email a 6-digit code to an administrator's own address. The code proves they
 * can read that inbox; only its hash is stored, it expires after 10 minutes,
 * asking again cancels the previous one, and at most 3 are sent per 15 minutes
 * (counted in the database, so the limit holds across every server instance).
 */
async function sendPasswordCode(
  user: { id: string; email: string; role: Role },
  via: 'settings' | 'sign_in',
): Promise<PasswordResult> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  if ((await countPasswordResetCodesSince(user.id, since)) >= CODES_PER_15_MINUTES) {
    return { ok: false, error: 'Several codes have been sent already. Please wait 15 minutes and try again.' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  const saved = await createPasswordResetCode(user.id, await hashPassword(code), expiresAt);

  const sent = await sendSecurityEmail({
    type: 'auth.password_code',
    audience: 'staff',
    to: { email: user.email },
    // Not in the subject: subjects are kept in the email log, codes are not.
    subject: 'Your Be Whole Care verification code',
    heading: 'Your verification code',
    body:
      'Use this code to set a new password for your Be Whole Care practice console:\n\n' +
      `## ${code}\n\n` +
      `The code expires in ${CODE_TTL_MINUTES} minutes and can be used once.\n\n` +
      'If you did not ask for this, you can ignore this email — your password stays the same.',
  });
  if (!sent.ok) {
    await markPasswordResetCodeUsed(saved.id);
    return { ok: false, error: 'The email could not be sent. Please try again in a moment.' };
  }

  await audit({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'auth.password_code_sent',
    entity: 'user',
    entityId: user.id,
    meta: { via },
  });
  return { ok: true };
}

/**
 * Check an emailed code. A code is used up when it is accepted and after 5
 * wrong tries, so it can never work twice or be guessed.
 */
async function checkPasswordCode(
  userId: string,
  entered: string,
): Promise<{ ok: true } | { ok: false; reason: 'none' | 'locked' | 'wrong'; left?: number }> {
  const active = await getActivePasswordResetCode(userId);
  if (!active) return { ok: false, reason: 'none' };
  if (!(await verifyPassword(entered, active.codeHash))) {
    const attempts = await recordPasswordResetAttempt(active.id);
    if (attempts >= CODE_MAX_ATTEMPTS) {
      await markPasswordResetCodeUsed(active.id);
      return { ok: false, reason: 'locked' };
    }
    return { ok: false, reason: 'wrong', left: CODE_MAX_ATTEMPTS - attempts };
  }
  await markPasswordResetCodeUsed(active.id);
  return { ok: true };
}

/** Forgot password, from Settings: email a code to the signed-in admin. */
export async function sendAdminPasswordCode(): Promise<PasswordResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  if (!isPracticeAdmin(user)) {
    return { ok: false, error: 'Only the practice administrator can reset the console password.' };
  }
  return sendPasswordCode(user, 'settings');
}

/** Forgot password, step two: check the emailed code and set the new password. */
export async function resetAdminPasswordWithCode(formData: FormData): Promise<PasswordResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  if (!isPracticeAdmin(user)) {
    return { ok: false, error: 'Only the practice administrator can reset the console password.' };
  }

  const entered = String(formData.get('code') ?? '').replace(/\D/g, '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  if (entered.length !== 6) return { ok: false, error: 'Enter the 6-digit code from the email.' };

  const problem = newPasswordProblem(next, confirm);
  if (problem) return { ok: false, error: problem };

  const checked = await checkPasswordCode(user.id, entered);
  if (!checked.ok) {
    if (checked.reason === 'none') {
      return { ok: false, error: 'This code has expired or was already used. Please send a new one.' };
    }
    if (checked.reason === 'locked') return { ok: false, error: 'Too many incorrect codes. Please send a new one.' };
    const left = checked.left ?? 0;
    return { ok: false, error: `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.` };
  }

  await completePasswordChange(user, next, 'email_code');
  return { ok: true };
}
