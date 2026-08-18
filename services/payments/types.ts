/**
 * Payment provider contract.
 *
 * The application only ever talks to this interface. Peach Payments, Payfast
 * and the development mock are implementations; nothing in the booking flow
 * knows which is active.
 *
 * Three rules hold for every implementation:
 *   1. Card data never touches this application. We create a checkout with the
 *      provider and hand the client to the provider's hosted page.
 *   2. The frontend never confirms a payment. Status changes only come from
 *      verifyCheckout() or a signature-verified webhook, both server-side.
 *   3. Settlement is configured in the provider's own dashboard, never here.
 *      No bank account number belongs in this repository.
 */

/** Instruments a provider can present. Used only to set client expectations. */
export type PaymentMethodMark =
  | 'apple_pay'
  | 'google_pay'
  | 'samsung_pay'
  | 'mastercard'
  | 'visa'
  | 'amex'
  | 'instant_eft'
  | 'payshap'
  | 'scan_to_pay'
  | 'snapscan'
  | 'zapper';

export interface CreateCheckoutInput {
  amountCents: number;
  currency: string;
  /** Our payment row id — echoed back by the provider for reconciliation. */
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  /** Where the provider sends its server-to-server notification. */
  webhookUrl: string;
  customerEmail?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  metadata: Record<string, string>;
}

export interface CheckoutResult {
  checkoutId: string;
  redirectUrl: string;
}

/**
 * An in-page checkout.
 *
 * The gateway serves the card fields as its own iframes inside our layout, so
 * the client types their card number on our page without the number ever
 * reaching our JavaScript or our server. That keeps the practice on the
 * simplest PCI footing (SAQ A) while still feeling like one continuous flow.
 *
 * Never accept a raw card number into this application. If a future change
 * makes it tempting, the answer is a hosted field, not a validated input.
 */
export interface EmbeddedCheckout {
  checkoutId: string;
  /** Gateway widget script, already carrying the checkout id. */
  scriptUrl: string;
  /**
   * Space-separated brands the widget should offer, e.g.
   * "APPLEPAY GOOGLEPAY VISA MASTER AMEX". Order is the order shown.
   */
  brands: string;
  /** Where the widget sends the shopper once the gateway has an answer. */
  resultUrl: string;
}

export type ProviderPaymentState = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';

export interface CheckoutStatus {
  checkoutId: string;
  state: ProviderPaymentState;
  providerPaymentId?: string | null;
  amountCents?: number;
  failureReason?: string | null;
  /** e.g. "MASTER", "APPLEPAY" — shown on the receipt when the provider says. */
  instrument?: string | null;
  raw?: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  checkoutId?: string;
  /** Our own payment id, when the provider echoes it back. */
  reference?: string;
  state?: ProviderPaymentState;
  providerPaymentId?: string | null;
  amountCents?: number;
  reason?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: 'peach' | 'payfast' | 'mock';
  /** True when real credentials are configured. */
  readonly live: boolean;
  /** Instruments this provider can present, for client-facing copy. */
  readonly methods: readonly PaymentMethodMark[];
  /**
   * Whether card fields can be rendered inside our own page. Providers that
   * can only redirect (Payfast) leave this false and the flow falls back to
   * a hand-off, which still works — it just isn't as seamless.
   */
  readonly supportsEmbedded: boolean;
  /** Present only when supportsEmbedded is true. */
  createEmbeddedCheckout?(input: CreateCheckoutInput): Promise<EmbeddedCheckout>;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  /** Authoritative status read, server-to-server. */
  verifyCheckout(checkoutId: string): Promise<CheckoutStatus>;
  refund(providerPaymentId: string, amountCents: number): Promise<{ ok: boolean; error?: string }>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;
}
