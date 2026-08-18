import 'server-only';

import { mockProvider } from './mock';
import { payfastProvider } from './payfast';
import { peachProvider } from './peach';
import type { PaymentMethodMark, PaymentProvider } from './types';

/**
 * Provider selection.
 *
 * PAYMENT_PROVIDER picks explicitly; otherwise whichever gateway has
 * credentials wins, and the mock catches everything else so development and
 * previews always have a working booking flow.
 *
 * Peach is the default for Be Whole Care because Apple Pay and Google Pay
 * require an FNB, Nedbank or Standard Bank merchant account, and the practice
 * banks with FNB.
 */
export function getPaymentProvider(): PaymentProvider {
  const explicit = process.env.PAYMENT_PROVIDER?.toLowerCase();

  if (explicit === 'peach') return peachProvider;
  if (explicit === 'payfast') return payfastProvider;
  if (explicit === 'mock') return mockProvider;

  if (peachProvider.live) return peachProvider;
  if (payfastProvider.live) return payfastProvider;
  return mockProvider;
}

export function paymentProviderName(): PaymentProvider['name'] {
  return getPaymentProvider().name;
}

/** Instruments the active provider can present, for client-facing copy. */
export function acceptedMethods(): readonly PaymentMethodMark[] {
  return getPaymentProvider().methods;
}

export * from './types';
export { settleMockCheckout, getMockCheckout } from './mock';
export { buildPayfastForm } from './payfast';
