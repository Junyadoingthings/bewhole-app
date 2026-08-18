import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

import type { Role, SessionUser } from '@/types';
import { ROLE_RANK } from '@/types';

/**
 * Opaque server-side sessions.
 *
 * The cookie carries a random token and an HMAC of it — nothing about the user
 * is derivable from the cookie, and the token is only meaningful when it also
 * exists in the sessions table. Identity is always resolved server-side from
 * this token; a user id supplied by the client is never trusted anywhere.
 */

export const SESSION_COOKIE = 'bwc_session';
const SESSION_TTL_DAYS = 14;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set to a 32+ character value in production.');
  }
  // Dev fallback so the app runs from a fresh clone with no .env.
  return 'bwc-development-only-secret-do-not-use-in-production';
}

function sign(token: string) {
  return crypto.createHmac('sha256', secret()).update(token).digest('base64url');
}

export function createSessionToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, cookieValue: `${token}.${sign(token)}` };
}

export function readTokenFromCookie(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;
  const token = value.slice(0, idx);
  const mac = value.slice(idx + 1);
  const expected = sign(token);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return token;
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86_400,
  };
}

export function setSessionCookie(cookieValue: string) {
  cookies().set(SESSION_COOKIE, cookieValue, sessionCookieOptions());
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
}

/* ------------------------------------------------------------ authorization */

export function hasRole(user: SessionUser | null, minimum: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

export function isStaff(user: SessionUser | null) {
  return hasRole(user, 'STAFF');
}

/* ------------------------------------------------------------- CSRF helpers */

const CSRF_COOKIE = 'bwc_csrf';

export function ensureCsrfToken(): string {
  const jar = cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString('base64url');
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
  return token;
}

export function verifyCsrf(submitted: string | null | undefined): boolean {
  const stored = cookies().get(CSRF_COOKIE)?.value;
  if (!stored || !submitted) return false;
  if (stored.length !== submitted.length) return false;
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(submitted));
}

export { CSRF_COOKIE };
