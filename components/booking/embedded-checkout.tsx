'use client';

import * as React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { MockCardForm } from '@/components/booking/mock-card-form';

/**
 * In-page checkout.
 *
 * The gateway's script renders its own card fields as iframes inside the
 * container below. The client types their card number on our page, in our
 * layout — but the number goes from their browser straight to the gateway.
 * It never enters this component's state, our JavaScript, or our server.
 *
 * That is the whole point: it keeps the practice on the simplest PCI footing
 * while still feeling like one uninterrupted booking. Do not "improve" this by
 * reading the card fields — you cannot, and trying would break it.
 *
 * Apple Pay and Google Pay buttons are rendered by the same widget, and it
 * hides whichever the device cannot do, so nobody sees a dead button.
 */
export function EmbeddedCheckout({
  scriptUrl,
  brands,
  resultUrl,
  amountLabel,
  isMock,
  checkoutId,
}: {
  scriptUrl: string;
  brands: string;
  resultUrl: string;
  amountLabel: string;
  isMock: boolean;
  checkoutId: string;
}) {
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'failed'>(
    isMock ? 'ready' : 'loading',
  );

  React.useEffect(() => {
    if (isMock || !scriptUrl) return;

    // Style the widget to match the rest of the form. The gateway reads this
    // global when its script boots, so it has to be set before the script runs.
    (window as unknown as { wpwlOptions?: unknown }).wpwlOptions = {
      style: 'card',
      locale: 'en',
      // Apple Pay / Google Pay first — one tap beats typing sixteen digits.
      applePay: { displayName: 'Be Whole Care', total: { label: 'Be Whole Care' } },
      googlePay: { buttonColor: 'black' },
      onReady() {
        setStatus('ready');
      },
      onError() {
        setStatus('failed');
      },
    };

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onerror = () => setStatus('failed');
    document.body.appendChild(script);

    // If the gateway never calls onReady, don't leave a spinner forever.
    const timer = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'ready' : current));
    }, 6000);

    return () => {
      window.clearTimeout(timer);
      script.remove();
    };
  }, [scriptUrl, isMock]);

  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl text-ink">Payment details</h3>
        <p className="font-display text-2xl tabular text-ink">{amountLabel}</p>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Pay with Apple Pay, Google Pay, or your card. Your session is confirmed the moment payment
        clears.
      </p>

      <div className="mt-6">
        {isMock ? (
          <MockCardForm checkoutId={checkoutId} resultUrl={resultUrl} />
        ) : (
          <>
            {status === 'loading' && (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-cream-50 dark:bg-canvas px-5 py-6 text-sm text-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin text-forest-600 dark:text-forest-300" />
                Loading secure payment fields…
              </div>
            )}

            {status === 'failed' && (
              <div className="rounded-2xl border border-state-danger/25 bg-state-dangerSoft p-5">
                <p className="text-sm font-medium text-ink">
                  We couldn’t load the payment form.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Your time is still held. Refresh the page to try again, or call the practice on
                  063 883 7170 and we’ll take it from there.
                </p>
              </div>
            )}

            {/*
              The gateway's script finds this form by class name and replaces
              its contents with its own hosted fields.
            */}
            <form
              action={resultUrl}
              className="paymentWidgets"
              data-brands={brands}
              style={{ display: status === 'ready' ? 'block' : 'none' }}
            />
          </>
        )}
      </div>

      <p className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-ink-faint">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-600 dark:text-forest-300" />
        Your card details are entered directly into our payment provider’s secure fields. Be Whole
        Care never sees or stores your card number.
      </p>
    </div>
  );
}
