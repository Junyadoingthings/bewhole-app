import type { PaymentMethodMark } from '@/services/payments/types';
import { cn } from '@/lib/utils';

/**
 * Accepted payment methods.
 *
 * The list is supplied by the active gateway, never hardcoded in a page — so
 * this can't end up promising Apple Pay after someone switches provider.
 *
 * The marks are drawn rather than fetched: Apple's and Google's brand assets
 * have licence terms about hosting and modification, and a wordmark drawn in
 * our own type sidesteps that while still being instantly recognisable.
 */

const LABELS: Record<PaymentMethodMark, string> = {
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  samsung_pay: 'Samsung Pay',
  mastercard: 'Mastercard',
  visa: 'Visa',
  amex: 'Amex',
  instant_eft: 'Instant EFT',
  payshap: 'PayShap',
  scan_to_pay: 'Scan to Pay',
  snapscan: 'SnapScan',
  zapper: 'Zapper',
};

function MastercardMark({ muted }: { muted?: boolean }) {
  /**
   * Muted keeps the two interlocking circles — the part that makes the mark
   * readable at a glance — and drops the red/orange, which cannot sit on a
   * dark ground without shouting. Two opacities preserve the overlap.
   */
  if (muted) {
    return (
      <svg viewBox="0 0 32 20" className="h-5 w-8" aria-hidden>
        <circle cx="12.5" cy="10" r="7" fill="currentColor" opacity="0.55" />
        <circle cx="19.5" cy="10" r="7" fill="currentColor" opacity="0.85" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 20" className="h-5 w-8" aria-hidden>
      <circle cx="12.5" cy="10" r="7" fill="#EB001B" />
      <circle cx="19.5" cy="10" r="7" fill="#F79E1B" />
      <path
        d="M16 4.6a7 7 0 0 0 0 10.8 7 7 0 0 0 0-10.8Z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function VisaMark({ muted }: { muted?: boolean }) {
  return (
    <span
      className={cn(
        'font-display text-[0.8rem] font-bold italic tracking-tight',
        muted ? 'text-current' : 'text-[#1A1F71]',
      )}
    >
      VISA
    </span>
  );
}

function AppleMark({ muted }: { muted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-0.5', muted ? 'text-current' : 'text-ink')}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.51-.71 2.84-.71s1.7.71 2.86.69c1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5M14.9 5.6c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.06 1.7-.93 2.7.97.08 1.97-.5 2.59-1.24" />
      </svg>
      <span className="text-[0.78rem] font-medium">Pay</span>
    </span>
  );
}

function GoogleMark({ muted }: { muted?: boolean }) {
  if (muted) {
    return <span className="text-[0.78rem] font-medium text-current">Google Pay</span>;
  }
  return (
    <span className="flex items-center gap-0.5">
      <span className="text-[0.78rem] font-medium">
        <span className="text-[#4285F4]">G</span>
        <span className="text-[#EA4335]">o</span>
        <span className="text-[#FBBC05]">o</span>
        <span className="text-[#4285F4]">g</span>
        <span className="text-[#34A853]">l</span>
        <span className="text-[#EA4335]">e</span>
      </span>
      <span className="text-[0.78rem] font-medium text-ink">Pay</span>
    </span>
  );
}

function TextMark({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={cn('text-[0.72rem] font-medium', muted ? 'text-current' : 'text-ink-muted')}>
      {label}
    </span>
  );
}

function Mark({ method, muted }: { method: PaymentMethodMark; muted?: boolean }) {
  switch (method) {
    case 'mastercard':
      return <MastercardMark muted={muted} />;
    case 'visa':
      return <VisaMark muted={muted} />;
    case 'apple_pay':
      return <AppleMark muted={muted} />;
    case 'google_pay':
      return <GoogleMark muted={muted} />;
    default:
      return <TextMark label={LABELS[method]} muted={muted} />;
  }
}

export function PaymentMethods({
  methods,
  className,
  compact,
  tone = 'brand',
}: {
  methods: readonly PaymentMethodMark[];
  className?: string;
  compact?: boolean;
  /**
   * 'brand' — the marks in their own colours on white chips. Correct in the
   *   booking flow, where they sit on a light card and need to read as the
   *   real thing at the moment someone is deciding to pay.
   * 'muted' — monochrome, no chips, inheriting the surrounding text colour.
   *   For the footer band, where a row of white tiles would punch a hole in a
   *   dark ground and pull attention away from the page above it.
   */
  tone?: 'brand' | 'muted';
}) {
  if (!methods.length) return null;
  const muted = tone === 'muted';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {!compact && (
        <span className={cn('mr-1 text-xs', muted ? 'text-current opacity-70' : 'text-ink-faint')}>
          Accepted
        </span>
      )}
      <ul className={cn('flex flex-wrap items-center', muted ? 'gap-x-5 gap-y-3' : 'gap-1.5')}>
        {methods.map((method) => (
          <li
            key={method}
            className={cn(
              'flex items-center justify-center',
              muted
                ? 'h-6'
                : 'h-8 rounded-lg border border-line bg-white px-2.5',
            )}
            title={LABELS[method]}
          >
            <Mark method={method} muted={muted} />
            <span className="sr-only">{LABELS[method]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
