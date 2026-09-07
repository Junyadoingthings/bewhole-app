import { NextResponse } from 'next/server';

import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  exchangeGoogleCode,
  googleOAuthConfigured,
} from '@/lib/auth/google';
import { createSessionToken, sessionCookieOptions, sessionExpiry, SESSION_COOKIE } from '@/lib/auth/session';
import { audit, createSession, createUserWithProfile, findUserByEmail } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { safeRedirect } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Send the person back to sign-in with a code the page can explain. */
function fail(request: Request, reason: string) {
  const response = NextResponse.redirect(new URL(`/sign-in?error=${reason}`, request.url));
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(OAUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

/**
 * Where Google returns to.
 *
 * The order of checks below is the security of this feature:
 *
 *  1. `state` must match the cookie we set — otherwise the callback was not
 *     started by this browser, and honouring it would let an attacker sign
 *     someone into an account of the attacker's choosing (session fixation
 *     via CSRF).
 *  2. The email must be VERIFIED by Google. We link to existing accounts by
 *     email, so an unverified address would be a direct account-takeover
 *     path against any client whose email someone could guess.
 *
 * Only after both does a session get minted — the same signed cookie a
 * password sign-in produces.
 */
export async function GET(request: Request) {
  if (!googleOAuthConfigured()) return fail(request, 'google_unavailable');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  // The person pressed "Cancel" on Google's screen. Not an error.
  if (url.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  if (!code || !returnedState) return fail(request, 'google_failed');

  const expectedState = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.split('=')[1];

  if (!expectedState || expectedState !== returnedState) return fail(request, 'google_state');

  const identity = await exchangeGoogleCode(code);
  if (!identity) return fail(request, 'google_failed');
  if (!identity.emailVerified) return fail(request, 'google_unverified');

  /* ------------------------------------------------ find or create the user */

  let user = await findUserByEmail(identity.email);

  if (!user) {
    /**
     * A Google-only account has no usable password.
     *
     * The column is NOT NULL, so it is given a random value that no input can
     * ever hash to. The person signs in with Google, or uses "reset password"
     * to set one — exactly like the passwordless accounts a guest booking
     * creates.
     */
    const created = await createUserWithProfile({
      email: identity.email,
      passwordHash: `google-oauth:${crypto.randomUUID()}`,
      role: 'CLIENT',
      firstName: identity.firstName,
      lastName: identity.lastName,
    });
    user = created.user;
  }

  if (user.disabled) return fail(request, 'account_disabled');

  /* ------------------------------------------------------- mint the session */

  const { token, cookieValue } = createSessionToken();
  const persisted = await withTimeout(
    createSession(user.id, token, sessionExpiry()).then(() => true),
    false,
    10_000,
  );
  if (!persisted) return fail(request, 'slow');

  const requestedNext = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_NEXT_COOKIE}=`))
    ?.split('=')[1];

  const destination =
    safeRedirect(requestedNext ? decodeURIComponent(requestedNext) : null) ??
    (user.role === 'CLIENT' ? '/portal' : '/admin');

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(SESSION_COOKIE, cookieValue, sessionCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(OAUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 });

  // Side effect — never allowed to delay or break the sign-in.
  await withTimeout(
    audit({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'auth.login_google',
      entity: 'user',
      entityId: user.id,
    }),
    undefined,
    3000,
  );

  return response;
}
