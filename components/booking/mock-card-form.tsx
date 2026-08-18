'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { settleMockPayment } from '@/app/actions/booking';
import { useToast } from '@/components/ui/toast';

/**
 * Development stand-in for the gateway's hosted card fields.
 *
 * It exists so the booking flow can be built and reviewed without a gateway
 * account, and so the layout around the real widget is designed against
 * something the same shape.
 *
 * It accepts no real card data — the inputs are not even read. The banner says
 * so plainly, because a realistic-looking card form that quietly does nothing
 * is exactly the kind of thing someone could mistake for the real one.
 */
export function MockCardForm({
  checkoutId,
  resultUrl,
}: {
  checkoutId: string;
  resultUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function settle(outcome: 'paid' | 'failed') {
    setBusy(outcome);
    const result = await settleMockPayment(checkoutId, outcome);
    if (!result.ok) {
      setBusy(null);
      toast({ tone: 'error', title: 'Simulation failed', description: result.error });
      return;
    }
    if (outcome === 'failed') {
      setBusy(null);
      toast({
        tone: 'error',
        title: 'Payment declined (simulated)',
        description: 'Your time is still held — try again.',
      });
      return;
    }
    router.push(resultUrl);
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-dashed border-line-strong bg-cream-50 dark:bg-canvas p-4">
        <p className="text-sm font-medium text-ink">Development simulator</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          No gateway is configured, so these fields are inert — nothing you type is read or sent
          anywhere. With Peach credentials set, this is replaced by their secure card fields, with
          Apple&nbsp;Pay and Google&nbsp;Pay above them.
        </p>
      </div>

      {/* Wallet buttons, drawn to show the real layout. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-medium text-canvas opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.51-.71 2.84-.71s1.7.71 2.86.69c1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5M14.9 5.6c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.06 1.7-.93 2.7.97.08 1.97-.5 2.59-1.24" />
          </svg>
          Pay
        </button>
        <button
          type="button"
          disabled
          className="flex h-12 items-center justify-center rounded-xl border border-line bg-white text-sm font-medium text-ink opacity-50"
        >
          Google&nbsp;Pay
        </button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">or pay by card</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="mock-card">Card number</Label>
          <Input
            id="mock-card"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            icon={<CreditCard className="h-4 w-4" />}
            autoComplete="off"
            disabled
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mock-expiry">Expiry</Label>
            <Input id="mock-expiry" placeholder="MM / YY" autoComplete="off" disabled />
          </div>
          <div>
            <Label htmlFor="mock-cvv">CVV</Label>
            <Input id="mock-cvv" placeholder="123" autoComplete="off" disabled />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Button
          full
          size="lg"
          loading={busy === 'paid'}
          loadingText="Confirming…"
          onClick={() => settle('paid')}
        >
          Simulate a successful payment
        </Button>
        <Button
          full
          size="lg"
          variant="dangerQuiet"
          loading={busy === 'failed'}
          onClick={() => settle('failed')}
        >
          Simulate a declined card
        </Button>
      </div>
    </div>
  );
}
