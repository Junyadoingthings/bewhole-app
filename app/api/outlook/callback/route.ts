import crypto from 'node:crypto';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { getApiUser } from '@/lib/auth';
import { audit, getOutlookConnection, nowISO, saveOutlookConnection } from '@/lib/db';
import { appUrl } from '@/lib/links';
import { encryptToken } from '@/lib/outlook/token-crypto';
import {
  ensureCategories,
  ensureSubscription,
  newClientState,
  pushUpcomingToOutlook,
  syncFromOutlook,
} from '@/services/outlook';
import { exchangeCode, forgetAccessToken, graph } from '@/services/outlook/graph';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATE_COOKIE = 'bwc_outlook_state';

function back(result: string) {
  const response = NextResponse.redirect(appUrl(`/admin/settings?outlook=${result}`));
  response.cookies.set(STATE_COOKIE, '', { path: '/api/outlook', maxAge: 0 });
  return response;
}

/** Microsoft returns here after the administrator signs in and agrees. */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) return back('denied');

  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const expected = cookies().get(STATE_COOKIE)?.value ?? '';
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return back('expired');
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code) return back('cancelled');

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back('failed');
    const me = await graph<{ mail?: string | null; userPrincipalName?: string }>('/me?$select=mail,userPrincipalName', {
      token: tokens.access_token,
    });
    const previous = await getOutlookConnection();
    forgetAccessToken();
    await saveOutlookConnection({
      id: 'outlook',
      accountEmail: me.mail || me.userPrincipalName || 'Outlook account',
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      connectedByUserId: user.id,
      subscriptionId: previous?.subscriptionId ?? null,
      subscriptionExpiresAt: previous?.subscriptionExpiresAt ?? null,
      clientState: newClientState(),
      lastSyncedAt: null,
      lastSyncError: null,
      issues: [],
      syncLockUntil: null,
      createdAt: previous?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    });
    await audit({ actorUserId: user.id, actorRole: user.role, action: 'outlook.connected', entity: 'outlook_connection' });

    await ensureCategories();
    await pushUpcomingToOutlook();
    await ensureSubscription().catch((error) => console.error('[bwc:outlook] subscription failed', error?.message));
    await syncFromOutlook();
    return back('connected');
  } catch (error) {
    console.error('[bwc:outlook] connect failed', error instanceof Error ? error.message : error);
    return back('failed');
  }
}
