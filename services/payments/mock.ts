import 'server-only';

import crypto from 'node:crypto';

import type {
  CheckoutResult,
  EmbeddedCheckout,
  CheckoutStatus,
  CreateCheckoutInput,
  PaymentProvider,
  ProviderPaymentState,
  WebhookVerification,
} from './types';

/**
 * Development payment provider, used when no gateway credentials are set.
 *
 * It renders our own hosted checkout page at /pay/[checkoutId] which looks and
 * behaves like a real redirect: the client leaves the booking flow, approves or
 * declines, and comes back to the same success/failure URLs a real gateway would use.
 * Crucially the outcome is still recorded server-side and read back through
 * verifyCheckout, so the confirmation path is identical in both modes.
 */

interface MockCheckout {
  id: string;
  amountCents: number;
  currency: string;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  state: ProviderPaymentState;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: string;
}

const globalRef = globalThis as unknown as { __bwc_mock_checkouts?: Map<string, MockCheckout> };
const store = (globalRef.__bwc_mock_checkouts ??= new Map<string, MockCheckout>());

export function getMockCheckout(id: string) {
  return store.get(id) ?? null;
}

/** Called by the mock checkout page once the "client" chooses an outcome. */
export function settleMockCheckout(id: string, outcome: 'paid' | 'failed' | 'cancelled') {
  const checkout = store.get(id);
  if (!checkout) return null;
  checkout.state = outcome;
  checkout.providerPaymentId = outcome === 'paid' ? `mockpay_${id.slice(-8)}` : null;
  checkout.failureReason =
    outcome === 'failed' ? 'The card was declined by the issuing bank (simulated).' : null;
  store.set(id, checkout);
  return checkout;
}

export const mockProvider: PaymentProvider = {
  name: 'mock',
  live: false,

  // Mirrors what Peach would present, so the booking flow looks the same in
  // development as it will in production.
  methods: ['apple_pay', 'google_pay', 'mastercard', 'visa', 'payshap', 'scan_to_pay'] as const,

  supportsEmbedded: true,

  /**
   * In development the "widget" is our own simulated card form, served from
   * /pay/embedded/[checkoutId]. It looks and behaves like the real one so the
   * booking flow can be built and reviewed without a gateway account — but it
   * accepts no real card data and says so on screen.
   */
  async createEmbeddedCheckout(input: CreateCheckoutInput): Promise<EmbeddedCheckout> {
    const { checkoutId } = await mockProvider.createCheckout(input);
    return {
      checkoutId,
      scriptUrl: '',
      brands: 'APPLEPAY GOOGLEPAY VISA MASTER',
      resultUrl: input.successUrl,
    };
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const id = `mockchk_${crypto.randomBytes(10).toString('hex')}`;
    store.set(id, {
      id,
      amountCents: input.amountCents,
      currency: input.currency,
      reference: input.reference,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.failureUrl,
      state: 'pending',
      providerPaymentId: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    });
    return { checkoutId: id, redirectUrl: `/pay/${id}` };
  },

  async verifyCheckout(checkoutId: string): Promise<CheckoutStatus> {
    const checkout = store.get(checkoutId);
    if (!checkout) {
      return { checkoutId, state: 'failed', failureReason: 'Checkout not found' };
    }
    return {
      checkoutId,
      state: checkout.state,
      providerPaymentId: checkout.providerPaymentId,
      amountCents: checkout.amountCents,
      failureReason: checkout.failureReason,
    };
  },

  async refund(providerPaymentId: string) {
    return { ok: providerPaymentId.startsWith('mockpay_') };
  },

  async verifyWebhook(): Promise<WebhookVerification> {
    // The mock has no outbound webhooks; confirmation goes through verifyCheckout.
    return { valid: false, reason: 'Mock provider does not emit webhooks' };
  },
};
