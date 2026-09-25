import 'server-only';

import crypto from 'node:crypto';

import { outboundTimeout } from '@/lib/outbound';

import type {
  CheckoutResult,
  CheckoutStatus,
  CreateCheckoutInput,
  PaymentProvider,
  ProviderPaymentState,
  WebhookVerification,
} from './types';

/**
 * Yoco Checkout.
 *
 * Docs: https://developer.yoco.com/online/api-reference/checkout/create-checkout
 *
 * The client is redirected to Yoco's own hosted page, so no card data ever
 * reaches this application. Yoco is explicit that the successUrl redirect is
 * NOT proof of payment — only the webhook (or a server-side status read) is —
 * which is exactly how the rest of this codebase already treats redirects.
 *
 * ── Keys ──────────────────────────────────────────────────────────────────
 * Yoco issues two kinds:
 *   pk_test_… / pk_live_…  public, safe in a browser, useless here
 *   sk_test_… / sk_live_…  secret, authorises charges — server only
 *
 * This provider needs the SECRET key. A public key in YOCO_SECRET_KEY is a
 * configuration mistake that would fail confusingly at the first charge, so it
 * is rejected up front with a message that says what to do about it.
 */

const API = 'https://payments.yoco.com/api';

function config() {
  const secretKey = process.env.YOCO_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('YOCO_SECRET_KEY is not configured');

  if (secretKey.startsWith('pk_')) {
    throw new Error(
      'YOCO_SECRET_KEY holds a public key (pk_…). Yoco checkouts must be created with the ' +
        'secret key (sk_…), found in the Yoco dashboard under Sell Online → Payment Gateway.',
    );
  }
  return { secretKey };
}

/** Test keys must never quietly take real money, nor live keys fake it. */
export function yocoKeyMode(): 'test' | 'live' | 'unknown' {
  const key = process.env.YOCO_SECRET_KEY?.trim() ?? '';
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  return 'unknown';
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { secretKey } = config();
  const { idempotencyKey, ...rest } = init;

  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(rest.headers ?? {}),
    },
    cache: 'no-store',
    signal: outboundTimeout(),
  });

  const text = await res.text();
  if (!res.ok) {
    // Yoco returns a JSON body with a description; fall back to the raw text.
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { description?: string; message?: string };
      detail = parsed.description ?? parsed.message ?? text;
    } catch {
      /* keep raw */
    }
    throw new Error(`Yoco ${res.status}: ${detail.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/**
 * Yoco reports checkout state as `status`, and separately exposes the payment.
 * Anything not explicitly successful or failed is treated as still in flight —
 * never as paid.
 */
function mapStatus(status: string | undefined): ProviderPaymentState {
  switch ((status ?? '').toLowerCase()) {
    case 'completed':
    case 'successful':
    case 'succeeded':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'processing':
      return 'processing';
    default:
      return 'pending';
  }
}

interface YocoCheckout {
  id: string;
  redirectUrl: string;
  status?: string;
  amount?: number;
  currency?: string;
  paymentId?: string | null;
  metadata?: Record<string, string>;
}

export const yocoProvider: PaymentProvider = {
  name: 'yoco',

  get live() {
    const key = process.env.YOCO_SECRET_KEY?.trim();
    return Boolean(key) && !key!.startsWith('pk_');
  },

  methods: ['mastercard', 'visa', 'amex', 'apple_pay', 'samsung_pay', 'scan_to_pay'] as const,

  // Yoco Checkout is a redirect to their hosted page, not an in-page widget.
  supportsEmbedded: false,

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const checkout = await call<YocoCheckout>('/checkouts', {
      method: 'POST',
      // Our payment row id is stable per attempt, so a retried request cannot
      // create a second checkout — and cannot charge twice.
      idempotencyKey: input.reference,
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        failureUrl: input.failureUrl,
        metadata: {
          ...input.metadata,
          reference: input.reference,
          description: input.description,
        },
      }),
    });

    if (!checkout.redirectUrl) {
      throw new Error('Yoco did not return a redirect URL for the checkout');
    }
    return { checkoutId: checkout.id, redirectUrl: checkout.redirectUrl };
  },

  async verifyCheckout(checkoutId: string): Promise<CheckoutStatus> {
    const checkout = await call<YocoCheckout>(`/checkouts/${encodeURIComponent(checkoutId)}`, {
      method: 'GET',
    });
    return {
      checkoutId: checkout.id,
      state: mapStatus(checkout.status),
      providerPaymentId: checkout.paymentId ?? null,
      amountCents: typeof checkout.amount === 'number' ? checkout.amount : undefined,
      raw: checkout,
    };
  },

  async refund(providerPaymentId: string, _amountCents: number) {
    /**
     * Yoco refunds are keyed on the CHECKOUT id, not the payment id, and only
     * work on checkouts created with live keys. The caller stores the checkout
     * id as the provider reference for this provider.
     */
    try {
      await call(`/checkouts/${encodeURIComponent(providerPaymentId)}/refund`, {
        method: 'POST',
        idempotencyKey: `refund_${providerPaymentId}`,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Refund failed' };
    }
  },

  /**
   * Standard Webhooks verification.
   *
   * Yoco signs with the Standard Webhooks scheme:
   *   signed content  = `${webhook-id}.${webhook-timestamp}.${rawBody}`
   *   key             = base64-decode(secret without its `whsec_` prefix)
   *   signature       = base64(HMAC-SHA256(key, signed content))
   *   header value    = space-separated `v1,<signature>` entries
   *
   * The timestamp is checked against a 3-minute window, as Yoco recommends, so
   * a captured webhook cannot be replayed later. Every comparison is
   * constant-time, and a failure returns a reason rather than throwing, so the
   * route can answer 401 without leaking which part did not match.
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    const secret = process.env.YOCO_WEBHOOK_SECRET?.trim();
    if (!secret) return { valid: false, reason: 'YOCO_WEBHOOK_SECRET is not configured' };

    const id = headers.get('webhook-id');
    const timestamp = headers.get('webhook-timestamp');
    const signatureHeader = headers.get('webhook-signature');
    if (!id || !timestamp || !signatureHeader) {
      return { valid: false, reason: 'Missing webhook-id, webhook-timestamp or webhook-signature' };
    }

    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt)) return { valid: false, reason: 'Malformed webhook-timestamp' };
    const skewSeconds = Math.abs(Date.now() / 1000 - sentAt);
    if (skewSeconds > 180) {
      return { valid: false, reason: `Timestamp outside the 3 minute window (${Math.round(skewSeconds)}s)` };
    }

    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto
      .createHmac('sha256', key)
      .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
      .digest('base64');

    // The header may carry several versioned signatures; any v1 match is valid.
    const candidates = signatureHeader
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('v1,'))
      .map((part) => part.slice(3));

    const matched = candidates.some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });

    if (!matched) return { valid: false, reason: 'Signature mismatch' };

    try {
      const event = JSON.parse(rawBody) as {
        type?: string;
        payload?: {
          id?: string;
          status?: string;
          amount?: number;
          metadata?: { checkoutId?: string; reference?: string };
        };
      };

      const payload = event.payload ?? {};
      /**
       * `payment.succeeded` is authoritative for state; anything else is
       * mapped conservatively and never becomes 'paid' by accident.
       */
      const state: ProviderPaymentState =
        event.type === 'payment.succeeded' ? 'paid' : mapStatus(payload.status);

      return {
        valid: true,
        checkoutId: payload.metadata?.checkoutId,
        reference: payload.metadata?.reference,
        state,
        providerPaymentId: payload.id ?? null,
        amountCents: typeof payload.amount === 'number' ? payload.amount : undefined,
        raw: event,
      };
    } catch {
      return { valid: false, reason: 'Webhook body was not valid JSON' };
    }
  },
};
