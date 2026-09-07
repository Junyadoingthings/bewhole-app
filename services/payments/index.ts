import 'server-only';

import { mockProvider } from './mock';
import { payfastProvider } from './payfast';
import { peachProvider } from './peach';
import { yocoProvider } from './yoco';
import { isProductionRuntime } from './runtime';
import type { PaymentMethodMark, PaymentProvider } from './types';

/**
 * Provider selection.
 *
 * PAYMENT_PROVIDER picks explicitly; otherwise whichever gateway has
 * credentials wins.
 *
 * Peach is the default for Be Whole Care because Apple Pay and Google Pay
 * require an FNB, Nedbank or Standard Bank merchant account, and the practice
 * banks with FNB.
 *
 * ── Why the simulated gateway is blocked in production ────────────────────
 * This used to fall through to the mock whenever no credentials were found,
 * in every environment. On the live site that is a money bug, not a
 * convenience: a client would be shown a working "Pay" button, the booking
 * would be marked paid, and no money would ever move. The practice would be
 * giving away sessions and only find out at reconciliation — and a client
 * holding a confirmation that says paid would be entirely in the right.
 *
 * One mistyped environment variable on Vercel was enough to cause it, which
 * makes it far likelier than any attack on the payment logic itself.
 *
 * In production the mock is therefore never selected silently. Payments are
 * reported as unavailable instead, and the booking flow adapts: sessions are
 * still booked and confirmed, with the fee settled directly with the practice.
 * Refusing to take money is recoverable. Pretending to take it is not.
 */
export function getPaymentProvider(): PaymentProvider {
  const explicit = process.env.PAYMENT_PROVIDER?.toLowerCase();

  if (explicit === 'peach') return peachProvider;
  if (explicit === 'payfast') return payfastProvider;
  if (explicit === 'yoco') return yocoProvider;

  if (peachProvider.live) return peachProvider;
  if (payfastProvider.live) return payfastProvider;
  if (yocoProvider.live) return yocoProvider;

  /**
   * The mock is still returned as the last resort, and that is safe on its own
   * terms: it emits no webhooks (verifyWebhook always rejects) and its hosted
   * page refuses to render in production. What makes it dangerous is being
   * *charged against*, and that is gated by paymentsAreLive() below rather
   * than here — the booking flow asks that question before it offers to take
   * anyone's money.
   */
  return mockProvider;
}

/**
 * Can this deployment actually take money right now?
 *
 * The single question the booking flow should ask before offering to charge
 * anyone. False means no real gateway is configured, so nothing may be
 * presented to a client as a payment.
 *
 * Note it asks the provider whether it is `live`, not merely which one was
 * selected: PAYMENT_PROVIDER=peach with blank credentials returns the Peach
 * provider, and that is not the same thing as being able to charge a card.
 */
export function paymentsAreLive(): boolean {
  const provider = getPaymentProvider();
  if (provider.live) return true;
  // A deliberately-enabled simulator counts as live only outside production.
  return !isProductionRuntime();
}

/**
 * Whether simulated payments are running where real clients can reach them.
 * Surfaced in the admin dashboard so this is visible rather than discovered.
 */
export function simulatedPaymentsAreExposed(): boolean {
  return isProductionRuntime() && getPaymentProvider().name === 'mock';
}

export function paymentProviderName(): PaymentProvider['name'] {
  return getPaymentProvider().name;
}

/** Instruments the active provider can present, for client-facing copy. */
export function acceptedMethods(): readonly PaymentMethodMark[] {
  if (!paymentsAreLive()) return [];
  return getPaymentProvider().methods;
}

export * from './types';
export { isProductionRuntime } from './runtime';
export { settleMockCheckout, getMockCheckout } from './mock';
export { buildPayfastForm } from './payfast';
export { yocoKeyMode } from './yoco';
