import 'server-only';

import crypto from 'node:crypto';

import type {
  CheckoutResult,
  CheckoutStatus,
  CreateCheckoutInput,
  PaymentProvider,
  ProviderPaymentState,
  WebhookVerification,
} from './types';

/**
 * Payfast — the lower-cost alternative to Peach.
 *
 * No monthly fee, which matters for a practice doing a handful of sessions a
 * week, and it carries Visa, Mastercard, Instant EFT, SnapScan, Zapper,
 * Mobicred, Apple Pay and Samsung Pay.
 *
 * Payfast works differently to Peach: instead of an API call that returns a
 * redirect URL, you build a signed form and POST the shopper to it. There is
 * no "create checkout" request, so `createCheckout` returns a URL to our own
 * `/pay/redirect` page which performs the auto-submitting POST.
 *
 * Confirmation arrives as an ITN (Instant Transaction Notification) — a form
 * POST to our webhook, which must be signature-checked AND validated back to
 * Payfast before it is believed.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NOT YET VERIFIED AGAINST THE SANDBOX. See PAYMENTS.md before going live.
 * ─────────────────────────────────────────────────────────────────────────
 */

const LIVE_PROCESS = 'https://www.payfast.co.za/eng/process';
const SANDBOX_PROCESS = 'https://sandbox.payfast.co.za/eng/process';
const LIVE_VALIDATE = 'https://www.payfast.co.za/eng/query/validate';
const SANDBOX_VALIDATE = 'https://sandbox.payfast.co.za/eng/query/validate';

function config() {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) throw new Error('Payfast credentials are not configured');
  const sandbox = process.env.PAYFAST_MODE !== 'live';
  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE ?? '',
    processUrl: sandbox ? SANDBOX_PROCESS : LIVE_PROCESS,
    validateUrl: sandbox ? SANDBOX_VALIDATE : LIVE_VALIDATE,
  };
}

/**
 * Payfast signature: URL-encode each value, join as a query string in the
 * order the fields were added (NOT sorted — Payfast is order-sensitive),
 * append the passphrase if one is set, then MD5.
 *
 * Payfast requires uppercase percent-encoding and spaces as `+`.
 */
function encode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

function sign(fields: [string, string][], passphrase: string) {
  const query = fields
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join('&');
  const withPass = passphrase ? `${query}&passphrase=${encode(passphrase)}` : query;
  return crypto.createHash('md5').update(withPass).digest('hex');
}

/** Fields for the auto-submitting form, in the exact order Payfast signs. */
export function buildPayfastForm(input: {
  amountCents: number;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  customerEmail?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
}) {
  const { merchantId, merchantKey, passphrase, processUrl } = config();

  const fields: [string, string][] = [
    ['merchant_id', merchantId],
    ['merchant_key', merchantKey],
    ['return_url', input.successUrl],
    ['cancel_url', input.cancelUrl],
    ['notify_url', input.webhookUrl],
    ['name_first', input.customerFirstName ?? ''],
    ['name_last', input.customerLastName ?? ''],
    ['email_address', input.customerEmail ?? ''],
    ['m_payment_id', input.reference],
    ['amount', (input.amountCents / 100).toFixed(2)],
    ['item_name', input.description.slice(0, 100)],
  ];

  const signature = sign(fields, passphrase);
  return { action: processUrl, fields: [...fields, ['signature', signature] as [string, string]] };
}

export const payfastProvider: PaymentProvider = {
  name: 'payfast',

  get live() {
    return Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);
  },

  get methods() {
    return ['apple_pay', 'samsung_pay', 'mastercard', 'visa', 'instant_eft', 'snapscan', 'zapper'] as const;
  },

  // Payfast only offers a full-page hand-off, so the booking flow falls back
  // to redirecting. Still works; just not in-page.
  supportsEmbedded: false,

  /**
   * Payfast has no create-checkout call. We hand back our own redirect page,
   * which builds the signed form and posts the shopper onward.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    config(); // fail fast if misconfigured
    return {
      checkoutId: input.reference,
      redirectUrl: `/pay/redirect/${encodeURIComponent(input.reference)}`,
    };
  },

  /**
   * Payfast offers no clean status-by-reference lookup on the standard plan,
   * so confirmation is ITN-driven. Returning `pending` here is correct: it
   * means "no new information", and the caller leaves the payment as it is.
   */
  async verifyCheckout(checkoutId: string): Promise<CheckoutStatus> {
    return {
      checkoutId,
      state: 'pending',
      failureReason: null,
    };
  },

  async refund() {
    // Payfast refunds are initiated from their dashboard, not the API.
    return {
      ok: false,
      error: 'Payfast refunds are made from the Payfast dashboard, not from this app.',
    };
  },

  /**
   * ITN verification, in the order Payfast requires:
   *   1. recompute the signature over the posted fields
   *   2. post the payload back to Payfast and require a literal "VALID"
   *
   * Step 2 is what makes a forged notification useless: an attacker who
   * guessed the passphrase would still have to be Payfast.
   */
  async verifyWebhook(rawBody: string): Promise<WebhookVerification> {
    let validateUrl: string;
    let passphrase: string;
    try {
      ({ validateUrl, passphrase } = config());
    } catch {
      return { valid: false, reason: 'Payfast credentials are not configured' };
    }

    const params = new URLSearchParams(rawBody);
    const provided = params.get('signature') ?? '';

    const fields: [string, string][] = [];
    params.forEach((value, key) => {
      if (key !== 'signature') fields.push([key, value]);
    });

    const expected = sign(fields, passphrase);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: 'ITN signature mismatch' };
    }

    // Confirm with Payfast itself.
    try {
      const res = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody,
        cache: 'no-store',
      });
      const verdict = (await res.text()).trim();
      if (!verdict.startsWith('VALID')) {
        return { valid: false, reason: `Payfast did not confirm the notification (${verdict})` };
      }
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Could not reach Payfast to validate',
      };
    }

    const status = (params.get('payment_status') ?? '').toUpperCase();
    const state: ProviderPaymentState =
      status === 'COMPLETE' ? 'paid' : status === 'CANCELLED' ? 'cancelled' : 'pending';

    return {
      valid: true,
      checkoutId: params.get('m_payment_id') ?? undefined,
      reference: params.get('m_payment_id') ?? undefined,
      state,
      providerPaymentId: params.get('pf_payment_id'),
      // Payfast states the amount it actually took; the caller checks it.
      amountCents: params.get('amount_gross')
        ? Math.round(Number(params.get('amount_gross')) * 100)
        : undefined,
      raw: Object.fromEntries(params.entries()),
    };
  },
};
