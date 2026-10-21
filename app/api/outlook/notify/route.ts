import crypto from 'node:crypto';

import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

import { getOutlookConnection } from '@/lib/db';
import { syncFromOutlook } from '@/services/outlook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Microsoft calls this when the practitioner's calendar changes.
 *
 * The notification only says "something changed"; nothing in it is trusted or
 * applied. It must carry the secret clientState set when the subscription was
 * made, and then the site re-reads her calendar itself (syncFromOutlook).
 */
export async function POST(request: Request) {
  // Subscription set-up: Microsoft checks the endpoint by asking it to echo a token.
  const validationToken = new URL(request.url).searchParams.get('validationToken');
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  const connection = await getOutlookConnection();
  if (!connection) return new NextResponse(null, { status: 202 });

  const body = (await request.json().catch(() => null)) as { value?: { clientState?: string }[] } | null;
  const expected = Buffer.from(connection.clientState);
  const genuine = (body?.value ?? []).some((n) => {
    const got = Buffer.from(n.clientState ?? '');
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
  if (!genuine) return new NextResponse(null, { status: 202 });

  waitUntil(syncFromOutlook().catch(() => undefined));
  return new NextResponse(null, { status: 202 });
}
