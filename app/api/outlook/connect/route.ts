import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { getApiUser } from '@/lib/auth';
import { appUrl } from '@/lib/links';
import { authorizeUrl, outlookConfigured } from '@/services/outlook/graph';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'bwc_outlook_state';

/**
 * Start connecting the practice's Outlook calendar. Administrator only. A
 * random state is kept in a short-lived httpOnly cookie and checked on return,
 * so nobody can trick the console into linking someone else's calendar.
 */
export async function GET() {
  const user = await getApiUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.redirect(appUrl('/sign-in?next=/admin/settings'));
  }
  if (!outlookConfigured()) {
    return NextResponse.redirect(appUrl('/admin/settings?outlook=not_configured'));
  }
  const state = crypto.randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(authorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/outlook',
    maxAge: 600,
  });
  return response;
}
