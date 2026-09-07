import 'server-only';

import { randomBytes } from 'node:crypto';

/**
 * Sign in with Google.
 *
 * ── How this fits the existing auth ───────────────────────────────────────
 * Google is an additional way to PROVE who you are, not a second session
 * system. Once Google has confirmed an email, we mint exactly the same
 * HMAC-signed session cookie that a password sign-in produces, so every
 * downstream guard (`requireUser`, `requireStaff`, the portal, the admin
 * console) is untouched and unaware of how the person authenticated.
 *
 * ── Why accounts are linked by verified email ─────────────────────────────
 * Booking creates passwordless accounts for people who have never signed up,
 * so the common case is that a Google email ALREADY has a user row. Linking by
 * email is therefore the norm rather than the exception.
 *
 * That is only safe because we require `email_verified` from Google. Without
 * that check, anyone able to set an arbitrary email on a Google account could
 * claim an existing client's record — an account-takeover hole. If Google says
 * the address is unverified, we refuse.
 *
 * ── Configuration ─────────────────────────────────────────────────────────
 * Deliberately separate from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, which
 * belong to the Calendar integration and carry different scopes and a
 * different consent audience. Sharing one client between "read the practice's
 * calendar" and "let a client log in" would tangle two unrelated concerns.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** The one-request cookie that defeats CSRF on the callback. */
export const OAUTH_STATE_COOKIE = 'bwc_oauth_state';
/** Where to send the person once they are signed in. */
export const OAUTH_NEXT_COOKIE = 'bwc_oauth_next';

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * The redirect URI registered in Google Cloud.
 *
 * Built from NEXT_PUBLIC_APP_URL because Google requires an EXACT match — it
 * cannot be derived from the incoming request, or a preview deployment would
 * present a URI that was never registered and the exchange would fail.
 */
export function googleRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5600').replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return `${withProtocol}/api/auth/google/callback`;
}

export function newOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    // Identity only. We are not asking for calendar, contacts or anything
    // else — a login should request the least it can.
    scope: 'openid email profile',
    state,
    // Always show the picker: on a shared machine, silently reusing the last
    // Google account is a privacy problem for a counselling service.
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

/**
 * Exchange the one-time code for the person's identity.
 *
 * Returns null rather than throwing on any failure: a broken exchange should
 * send someone back to the sign-in page with a readable message, not surface
 * a stack trace or a 500.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleIdentity | null> {
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });
    if (!tokenRes.ok) {
      console.error('[bwc:google] token exchange failed', tokenRes.status);
      return null;
    }

    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return null;

    const userRes = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!userRes.ok) {
      console.error('[bwc:google] userinfo failed', userRes.status);
      return null;
    }

    const profile = (await userRes.json()) as {
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
    };
    if (!profile.email) return null;

    // Fall back to splitting `name` when Google omits the granular fields,
    // which it does for some account types.
    const [fallbackFirst, ...fallbackRest] = (profile.name ?? '').trim().split(/\s+/);

    return {
      email: profile.email.trim().toLowerCase(),
      emailVerified: profile.email_verified === true,
      firstName: profile.given_name?.trim() || fallbackFirst || 'Friend',
      lastName: profile.family_name?.trim() || fallbackRest.join(' ') || '',
    };
  } catch (error) {
    console.error('[bwc:google] exchange threw', error);
    return null;
  }
}
