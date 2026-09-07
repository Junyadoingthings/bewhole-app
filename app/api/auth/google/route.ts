import { NextResponse } from 'next/server';

import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  googleAuthUrl,
  googleOAuthConfigured,
  newOAuthState,
} from '@/lib/auth/google';
import { safeRedirect } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Starts the Google sign-in dance.
 *
 * Two short-lived cookies are set before redirecting:
 *
 *   state  a random value echoed back by Google and compared on return. This
 *          is the CSRF defence — without it, an attacker could feed someone a
 *          crafted callback URL and sign them into an account they do not own.
 *   next   where to land afterwards, carried in a cookie rather than through
 *          Google, so a redirect target cannot be injected via the OAuth flow.
 *
 * Both are httpOnly, 10 minutes, and cleared by the callback.
 */
export async function GET(request: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/sign-in?error=google_unavailable', request.url));
  }

  const requested = new URL(request.url).searchParams.get('next');
  const state = newOAuthState();

  const response = NextResponse.redirect(googleAuthUrl(state));
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  };

  response.cookies.set(OAUTH_STATE_COOKIE, state, options);
  // `safeRedirect` rejects anything that is not a local path, so an open
  // redirect cannot be smuggled in through ?next=.
  response.cookies.set(OAUTH_NEXT_COOKIE, safeRedirect(requested ?? '') ?? '', options);

  return response;
}
