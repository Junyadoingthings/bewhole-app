import { NextResponse } from 'next/server';

import { handleProviderWebhook } from '@/services/payment.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Payment provider webhook.
 *
 * The raw body is read before any parsing so the signature can be verified over
 * exactly the bytes that were signed. An unverified request never touches the
 * database. Even a verified one only triggers a fresh server-to-server status
 * read — the payload's own claim about state is not trusted.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const result = await handleProviderWebhook(rawBody, request.headers);
    if (!result.ok) {
      console.warn('[bwc:webhook] rejected —', result.reason);
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }
    return NextResponse.json({ received: true, detail: result.reason });
  } catch (error) {
    console.error('[bwc:webhook] handler error', error);
    // 500 makes the provider retry, which is what we want for a transient fault.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}
