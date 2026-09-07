'use client';

import * as React from 'react';
import { Check, Printer, ShieldCheck } from 'lucide-react';

import { COUNSELLING_CONSENT, BUSINESS, PRACTITIONER } from '@/config/business';
import { cn } from '@/lib/utils';

/**
 * Informed consent, as a readable document rather than a wall of checkboxes.
 *
 * Each clause is its own card with its own agreement, so someone can see what
 * they are agreeing to at the moment they agree to it — rather than one blanket
 * "I accept the terms" at the bottom of text nobody reads. For a counselling
 * service that distinction is the whole point of the document.
 *
 * `onChange` reports whether ALL clauses are agreed. The caller decides what to
 * do with that; this component never gates anything itself.
 */
export function ConsentForm({
  value,
  onChange,
  showPrint = true,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  showPrint?: boolean;
}) {
  const allAgreed = COUNSELLING_CONSENT.items.every((item) => value[item.id]);

  return (
    <div className="print-consent">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Informed consent
          </p>
          <h2 className="mt-3 font-display text-2xl text-ink">
            Before your first session
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
            Please read each point and confirm you agree. You can print or save a copy for your
            own records.
          </p>
        </div>

        {showPrint && (
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-forest-300"
          >
            <Printer className="h-4 w-4" />
            Print or save
          </button>
        )}
      </div>

      <ol className="mt-6 space-y-3">
        {COUNSELLING_CONSENT.items.map((item, index) => {
          const agreed = Boolean(value[item.id]);
          return (
            <li
              key={item.id}
              className={cn(
                'rounded-3xl border p-5 transition-colors duration-200 sm:p-6',
                agreed ? 'border-forest-300 bg-forest-50/60 dark:bg-forest-900/20' : 'border-line bg-card',
              )}
            >
              <div className="flex gap-4">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    agreed
                      ? 'bg-forest-700 text-cream-50'
                      : 'bg-canvas-sunk text-ink-soft',
                  )}
                >
                  {agreed ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink-muted">{item.body}</p>

                  <label className="no-print mt-4 inline-flex cursor-pointer items-center gap-2.5">
                    <span className="relative flex h-5 w-5 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => onChange({ ...value, [item.id]: e.target.checked })}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200',
                          'peer-focus-visible:ring-2 peer-focus-visible:ring-forest-600 peer-focus-visible:ring-offset-2',
                          agreed ? 'border-forest-700 bg-forest-700' : 'border-line-strong bg-card',
                        )}
                      >
                        <Check
                          className={cn(
                            'h-3.5 w-3.5 text-pure transition-transform duration-200',
                            agreed ? 'scale-100' : 'scale-0',
                          )}
                          strokeWidth={3}
                        />
                      </span>
                    </span>
                    <span className="text-sm font-medium text-ink">{item.agreeLabel}</span>
                  </label>

                  {/* Print-only: a signature line replaces the checkbox on paper. */}
                  <p className="print-only mt-4 text-xs text-ink-faint">
                    {item.agreeLabel}: ________________________
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Print-only footer: who this consent is with, and room to sign it. */}
      <div className="print-only mt-8 border-t border-line pt-6 text-sm text-ink-muted">
        <p>
          {PRACTITIONER.name} — {PRACTITIONER.title} ({PRACTITIONER.council}{' '}
          {PRACTITIONER.registrationNumber})
        </p>
        <p className="mt-1">
          {BUSINESS.name} · {BUSINESS.phone} · {BUSINESS.email}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-8">
          <p>Client name: ______________________</p>
          <p>Date: ______________________</p>
          <p className="col-span-2">Signature: ______________________</p>
        </div>
      </div>

      {!allAgreed && (
        <p className="no-print mt-5 text-sm text-ink-soft">
          Please confirm all four points to continue.
        </p>
      )}
    </div>
  );
}

/** Whether every clause has been agreed. Exported so callers share one rule. */
export function isConsentComplete(value: Record<string, boolean>): boolean {
  return COUNSELLING_CONSENT.items.every((item) => value[item.id]);
}
