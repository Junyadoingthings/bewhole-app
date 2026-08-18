import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';

import { LogoCompact } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { getMockCheckout, settleMockCheckout } from '@/services/payments';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Secure payment', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Mock hosted checkout.
 *
 * Stands in for the gateway's hosted page when no credentials are configured.
 * It is deliberately a real redirect to a separate page with its own outcome,
 * so the development flow exercises exactly the same path as production: leave
 * the app, settle, come back to the success/failure URL, let the server verify.
 *
 * With Peach or Payfast credentials set, nothing ever routes here.
 */
export default function MockCheckoutPage({ params }: { params: { checkoutId: string } }) {
  const checkout = getMockCheckout(params.checkoutId);
  if (!checkout) notFound();

  async function settle(formData: FormData) {
    'use server';
    const outcome = formData.get('outcome');
    const id = String(formData.get('checkoutId'));
    const current = getMockCheckout(id);
    if (!current) return;

    if (outcome === 'paid') {
      settleMockCheckout(id, 'paid');
      redirect(current.successUrl);
    }
    if (outcome === 'failed') {
      settleMockCheckout(id, 'failed');
      redirect(current.failureUrl);
    }
    settleMockCheckout(id, 'cancelled');
    redirect(current.cancelUrl);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream-100 dark:bg-card">
      <header className="border-b border-line bg-white">
        <div className="shell flex h-16 items-center justify-between">
          <LogoCompact />
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <Lock className="h-3.5 w-3.5 text-forest-600 dark:text-forest-300" />
            Secure checkout
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-4xl border border-line bg-white p-8 shadow-card">
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Payment request
            </p>
            <p className="mt-3 font-display text-4xl tabular text-ink">
              {money(checkout.amountCents)}
            </p>
            <p className="mt-2 text-sm text-ink-soft">{checkout.description}</p>

            <div className="mt-7 rounded-2xl border border-dashed border-line-strong bg-cream-50 dark:bg-canvas p-5">
              <p className="text-sm font-medium text-ink">Development payment simulator</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                No gateway credentials are configured, so this page stands in for the real hosted
                checkout. No card details are collected here, and none ever reach Be Whole Care —
                in production this is Peach Payments’ own secure page, where Apple Pay, Google Pay,
                Mastercard, Visa and PayShap are offered.
              </p>
            </div>

            <form action={settle} className="mt-7 space-y-3">
              <input type="hidden" name="checkoutId" value={checkout.id} />
              <Button type="submit" name="outcome" value="paid" size="lg" full>
                Approve payment
              </Button>
              <Button type="submit" name="outcome" value="failed" variant="dangerQuiet" size="lg" full>
                Simulate a declined card
              </Button>
              <Button type="submit" name="outcome" value="cancelled" variant="ghost" size="lg" full>
                Cancel and go back
              </Button>
            </form>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-faint">
            <ShieldCheck className="h-3.5 w-3.5" />
            Payment status is always verified server-side before a booking is confirmed.
          </p>
        </div>
      </main>
    </div>
  );
}
