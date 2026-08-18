import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { findSessionUser } from '@/lib/db';
import type { ID, Role, SessionUser } from '@/types';
import { ROLE_RANK } from '@/types';
import { SESSION_COOKIE, readTokenFromCookie } from './session';

/**
 * Identity is always derived from the signed session cookie, server-side.
 * No route, action or component ever accepts a user id from the client.
 *
 * `cache` dedupes the lookup across a single render pass so a layout, a page
 * and three server components share one resolution.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const token = readTokenFromCookie(raw);
  if (!token) return null;

  /**
   * One query, not three.
   *
   * This used to walk session → user → profile as three sequential round
   * trips, on every request to every signed-in page. `findSessionUser` does
   * the same work as a single join, which removes two round trips from every
   * click in the portal and the admin console.
   *
   * The signature is unchanged, and `cache()` still dedupes it across a render
   * pass, so a layout and three server components share one resolution.
   */
  const found = await findSessionUser(token);
  if (!found) return null;

  return {
    id: found.id,
    email: found.email,
    role: found.role,
    firstName: found.firstName,
    lastName: found.lastName,
  };
});

export async function requireUser(redirectTo = '/sign-in'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireRole(minimum: Role, redirectTo = '/sign-in'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) redirect('/portal');
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  return requireRole('STAFF', '/sign-in?next=/admin');
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole('ADMIN', '/sign-in?next=/admin');
}

/** For API routes, which return a status rather than redirecting. */
export async function getApiUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

/**
 * Ownership check for every client-scoped record.
 *
 * A CLIENT may only ever touch rows whose clientUserId equals their own id.
 * Staff and above may act on any client record.
 */
export function canAccessClientRecord(user: SessionUser, ownerUserId: ID): boolean {
  if (ROLE_RANK[user.role] >= ROLE_RANK.STAFF) return true;
  return user.id === ownerUserId;
}

export function assertClientAccess(user: SessionUser, ownerUserId: ID) {
  if (!canAccessClientRecord(user, ownerUserId)) {
    const error = new Error('Forbidden');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}
