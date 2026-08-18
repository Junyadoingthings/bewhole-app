import 'server-only';

import crypto from 'node:crypto';

import type {
  CheckoutResult,
  CheckoutStatus,
  CreateCheckoutInput,
  EmbeddedCheckout,
  PaymentProvider,
  ProviderPaymentState,
  WebhookVerification,
} from './types';

/**
 * Peach Payments — Checkout V2 (hosted).
 *
 * Chosen because it is the route to Apple Pay and Google Pay for a South
 * African practice banking with FNB: Peach requires an FNB, Nedbank or
 * Standard Bank merchant account for Apple Pay, and Absa/FNB/Nedbank/Standard
 * Bank for Google Pay. It also carries Visa, Mastercard, Amex, Diners,
 * Samsung Pay, PayShap, Pay by Bank and Scan to Pay through one integration.
 *
 * Which of those a client actually sees is decided by what the practice has
 * enabled in the Peach dashboard — this code never hardcodes a method list.
 *
 * Card data never reaches this application: we create a checkout, redirect to
 * Peach's hosted page, and read the outcome back server-to-server.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NOT YET VERIFIED AGAINST THE SANDBOX. Written to Peach's documented Checkout
 * V2 contract, but no request has been made against a real entity. Before
 * going live, run the sandbox checklist in PAYMENTS.md — particularly the
 * signature and the result-code mapping.
 * ─────────────────────────────────────────────────────────────────────────
 */

const LIVE_BASE = 'https://secure.peachpayments.com';
const SANDBOX_BASE = 'https://testsecure.peachpayments.com';

/**
 * COPYandPAY hosts — the widget that renders card fields inside our page.
 * Peach runs on ACI's platform, so the widget is served from oppwa.
 */
const LIVE_WIDGET = 'https://eu-prod.oppwa.com';
const SANDBOX_WIDGET = 'https://eu-test.oppwa.com';

/**
 * Brands offered inside the widget, in display order.
 *
 * Apple Pay and Google Pay lead because they are one tap and need no typing.
 * The widget silently omits any wallet the device or browser cannot do, so an
 * Android user never sees a dead Apple Pay button.
 */
const WIDGET_BRANDS = 'APPLEPAY GOOGLEPAY VISA MASTER AMEX';

function config() {
  const entityId = process.env.PEACH_ENTITY_ID;
  const secret = process.env.PEACH_SECRET_TOKEN;
  if (!entityId || !secret) throw new Error('Peach Payments credentials are not configured');
  return {
    entityId,
    secret,
    base: process.env.PEACH_MODE === 'live' ? LIVE_BASE : SANDBOX_BASE,
  };
}

/**
 * Peach request signature.
 *
 * Sort every parameter by key, concatenate `key + value` with no separators,
 * then HMAC-SHA256 with the secret token. The signature field itself is never
 * part of the input.
 */
function sign(params: Record<string, string>, secret: string): string {
  const payload = Object.keys(params)
    .filter((key) => key !== 'signature' && params[key] !== '' && params[key] != null)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Peach/ACI result codes.
 *
 * Success and "successful but manually reviewed" both mean the money moved.
 * The 000.200.* family means the shopper has not finished yet — treat as
 * pending, never as paid.
 */
function mapResultCode(code: string | undefined): ProviderPaymentState {
  if (!code) return 'pending';
  if (/^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.0[00-11])/.test(code)) return 'paid';
  if (/^000\.200/.test(code)) return 'pending';
  if (/^(000\.400\.[01][0-9][0-9]|000\.400\.2)/.test(code)) return 'processing';
  return 'failed';
}

export const peachProvider: PaymentProvider = {
  name: 'peach',

  get live() {
    return Boolean(process.env.PEACH_ENTITY_ID && process.env.PEACH_SECRET_TOKEN);
  },

  /**
   * Methods this integration can present. Actual availability is whatever the
   * practice has switched on in the Peach dashboard — this list is only used
   * to tell clients what to expect, so it stays conservative.
   */
  get methods() {
    return ['apple_pay', 'google_pay', 'mastercard', 'visa', 'amex', 'payshap', 'scan_to_pay'] as const;
  },

  supportsEmbedded: true,

  /**
   * Create a checkout for the in-page widget.
   *
   * This is the COPYandPAY flow: we register the intended payment server-side
   * and get back an id, then the browser loads Peach's widget script with that
   * id. The card fields the client types into are Peach's iframes — the number
   * goes straight from the client's browser to Peach and is never seen here.
   */
  async createEmbeddedCheckout(input: CreateCheckoutInput): Promise<EmbeddedCheckout> {
    const { entityId, secret, base } = config();
    const sandbox = process.env.PEACH_MODE !== 'live';

    const body: Record<string, string> = {
      entityId,
      amount: (input.amountCents / 100).toFixed(2),
      currency: input.currency,
      paymentType: 'DB',
      merchantTransactionId: input.reference,
      'customer.email': input.customerEmail ?? '',
      'customer.givenName': input.customerFirstName ?? '',
      'customer.surname': input.customerLastName ?? '',
      notificationUrl: input.webhookUrl,
    };

    const res = await fetch(`${base}/v1/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[peach] embedded checkout failed', {
        status: res.status,
        body: text.slice(0, 400),
      });
      throw new Error(`Could not start payment (${res.status})`);
    }

    const json = JSON.parse(text) as { id?: string; result?: { code?: string; description?: string } };
    if (!json.id) {
      throw new Error(json.result?.description ?? 'Peach did not return a checkout id');
    }

    const widgetBase = sandbox ? SANDBOX_WIDGET : LIVE_WIDGET;

    return {
      checkoutId: json.id,
      scriptUrl: `${widgetBase}/v1/paymentWidgets.js?checkoutId=${encodeURIComponent(json.id)}`,
      brands: WIDGET_BRANDS,
      resultUrl: input.successUrl,
    };
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const { entityId, secret, base } = config();

    const params: Record<string, string> = {
      entityId,
      // Peach expects a decimal amount, not cents.
      amount: (input.amountCents / 100).toFixed(2),
      currency: input.currency,
      paymentType: 'DB', // debit — take the money now
      merchantTransactionId: input.reference,
      // Peach calls back here server-to-server, and returns the shopper here.
      shopperResultUrl: input.successUrl,
      notificationUrl: input.webhookUrl,
      'customer.email': input.customerEmail ?? '',
      'customer.givenName': input.customerFirstName ?? '',
      'customer.surname': input.customerLastName ?? '',
      'customParameters[bookingReference]': input.metadata.reference ?? '',
      nonce: crypto.randomUUID(),
    };

    params.signature = sign(params, secret);

    const res = await fetch(`${base}/v2/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params),
      cache: 'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[peach] checkout create failed', { status: res.status, body: text.slice(0, 400) });
      throw new Error(`Peach checkout failed (${res.status})`);
    }

    const json = JSON.parse(text) as {
      checkoutId?: string;
      redirectUrl?: string;
      result?: { code?: string; description?: string };
    };

    if (!json.checkoutId || !json.redirectUrl) {
      throw new Error(`Peach did not return a checkout (${json.result?.description ?? 'no reason given'})`);
    }

    return { checkoutId: json.checkoutId, redirectUrl: json.redirectUrl };
  },

  async verifyCheckout(checkoutId: string): Promise<CheckoutStatus> {
    const { entityId, secret, base } = config();

    const query: Record<string, string> = { entityId };
    query.signature = sign(query, secret);

    const url = `${base}/v2/checkout/${encodeURIComponent(checkoutId)}/payment?${new URLSearchParams(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const text = await res.text();

    if (!res.ok) {
      console.error('[peach] status read failed', { status: res.status, body: text.slice(0, 400) });
      return { checkoutId, state: 'pending', failureReason: `Status read failed (${res.status})` };
    }

    const json = JSON.parse(text) as {
      id?: string;
      amount?: string;
      result?: { code?: string; description?: string };
      paymentBrand?: string;
    };

    const state = mapResultCode(json.result?.code);

    return {
      checkoutId,
      state,
      providerPaymentId: json.id ?? null,
      // Peach returns a decimal string; the app works in cents throughout.
      amountCents: json.amount ? Math.round(Number(json.amount) * 100) : undefined,
      failureReason: state === 'failed' ? (json.result?.description ?? 'Payment declined') : null,
      instrument: json.paymentBrand ?? null,
      raw: json,
    };
  },

  async refund(providerPaymentId: string, amountCents: number) {
    const { entityId, secret, base } = config();

    const params: Record<string, string> = {
      entityId,
      amount: (amountCents / 100).toFixed(2),
      currency: 'ZAR',
      paymentType: 'RF',
    };
    params.signature = sign(params, secret);

    try {
      const res = await fetch(`${base}/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
        cache: 'no-store',
      });
      const json = (await res.json()) as { result?: { code?: string; description?: string } };
      const ok = mapResultCode(json.result?.code) === 'paid';
      return ok ? { ok: true } : { ok: false, error: json.result?.description ?? 'Refund declined' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Refund failed' };
    }
  },

  /**
   * Webhook verification.
   *
   * Peach signs the notification body; we recompute the HMAC over the raw
   * bytes and compare in constant time. Even once verified, the payload's own
   * claim about status is not trusted — the caller re-reads status from Peach.
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    const secret = process.env.PEACH_WEBHOOK_SECRET;
    if (!secret) return { valid: false, reason: 'PEACH_WEBHOOK_SECRET is not configured' };

    const provided =
      headers.get('x-signature') ?? headers.get('x-peach-signature') ?? headers.get('signature');
    if (!provided) return { valid: false, reason: 'Missing signature header' };

    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(provided.trim().toLowerCase());
    const b = Buffer.from(expected.toLowerCase());
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    try {
      const payload = JSON.parse(rawBody) as {
        checkoutId?: string;
        merchantTransactionId?: string;
        result?: { code?: string };
        id?: string;
      };
      return {
        valid: true,
        checkoutId: payload.checkoutId,
        reference: payload.merchantTransactionId,
        state: mapResultCode(payload.result?.code),
        providerPaymentId: payload.id ?? null,
        raw: payload,
      };
    } catch {
      return { valid: false, reason: 'Malformed webhook body' };
    }
  },
};
