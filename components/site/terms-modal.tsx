'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileText, X } from 'lucide-react';

import { POLICY } from '@/config/business';
import { cn } from '@/lib/utils';

/**
 * Terms, as a modal that can be opened from anywhere.
 *
 * The practice's terms decide who pays when a session is missed, so they need
 * to be read rather than linked past. This asks for an explicit tick, and
 * remembers it.
 *
 * What it deliberately does NOT do:
 *
 *  - block the page behind a wall on first visit. Someone arriving in distress
 *    should reach the phone number without negotiating a consent gate.
 *  - disable the close button, or hide it until you scroll to the bottom.
 *  - reappear once acknowledged.
 *
 * The tick is a record that the terms were shown and accepted, not a lock. The
 * binding acceptance is taken again inside the booking flow, where it is tied
 * to a named person and stored against the booking.
 */

const STORAGE_KEY = 'bwc_terms_ack';

const SECTIONS: { title: string; body: string }[] = [
  { title: 'Cancellations & missed sessions', body: POLICY.cancellation },
  { title: 'Payment', body: POLICY.cardPayments },
  { title: 'Medical aid', body: POLICY.medicalAid },
  { title: 'Co-payments', body: POLICY.medicalAidCoPayment },
  { title: 'Who we can see', body: POLICY.eligibility },
  { title: 'What these services are', body: POLICY.nature },
  { title: 'Confidentiality', body: POLICY.confidentiality },
  // A policy with no wording (there is currently no co-payment) is left out
  // rather than shown as an empty heading.
].filter((section) => section.body);

interface TermsContextValue {
  open: () => void;
  acknowledged: boolean;
}

const TermsContext = React.createContext<TermsContextValue | null>(null);

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [ticked, setTicked] = React.useState(false);

  React.useEffect(() => {
    try {
      setAcknowledged(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      /* private browsing */
    }
  }, []);

  // Lock the page behind the dialog only while it is actually open.
  React.useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const open = React.useCallback(() => {
    setTicked(false);
    setIsOpen(true);
  }, []);

  const accept = React.useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* private browsing — the acknowledgement just won't persist */
    }
    setAcknowledged(true);
    setIsOpen(false);
  }, []);

  const value = React.useMemo(() => ({ open, acknowledged }), [open, acknowledged]);

  return (
    <TermsContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.button
              type="button"
              aria-label="Close terms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Terms and conditions"
              initial={{ opacity: 0, y: 24, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-float sm:max-h-[82vh] sm:rounded-3xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
                <div>
                  <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
                    <FileText className="h-3.5 w-3.5" />
                    Please read
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                    Terms &amp; conditions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas-sunk hover:text-ink"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* `overscroll-contain` stops a flick at the end of the terms
                  from scrolling the page underneath on iOS. */}
              <div className="scrollbar-slim flex-1 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8">
                <div className="space-y-6">
                  {SECTIONS.map((section) => (
                    <section key={section.title}>
                      <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{section.body}</p>
                    </section>
                  ))}

                  <section>
                    <h3 className="text-sm font-semibold text-ink">
                      When confidentiality may be broken
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {POLICY.confidentialityLimits.map((limit) => (
                        <li
                          key={limit}
                          className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                        >
                          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-forest-400" />
                          {limit}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <p className="border-t border-line pt-5 text-xs text-ink-soft">
                    This is the summary shown before booking.{' '}
                    <Link href="/terms" className="text-forest-700 underline underline-offset-4 dark:text-forest-300">
                      Open the full terms page
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="border-t border-line bg-canvas-sunk px-6 py-5 pb-safe sm:px-8">
                <label className="flex cursor-pointer items-start gap-3">
                  <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={ticked}
                      onChange={(e) => setTicked(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-forest-600 peer-focus-visible:ring-offset-2',
                        ticked ? 'border-forest-700 bg-forest-700' : 'border-line-strong bg-card',
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 text-pure transition-transform duration-200',
                          ticked ? 'scale-100' : 'scale-0',
                        )}
                        strokeWidth={3}
                      />
                    </span>
                  </span>
                  <span className="text-sm leading-relaxed text-ink">
                    I have read and understood the terms &amp; conditions.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={accept}
                  disabled={!ticked}
                  className={cn(
                    'mt-4 flex h-12 w-full items-center justify-center rounded-full text-sm font-medium transition-all duration-250',
                    ticked
                      ? 'bg-forest-800 text-cream-50 hover:bg-forest-900'
                      : 'cursor-not-allowed bg-line text-ink-faint',
                  )}
                >
                  {ticked ? 'Continue' : 'Tick the box to continue'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </TermsContext.Provider>
  );
}

export function useTerms() {
  const ctx = React.useContext(TermsContext);
  if (!ctx) throw new Error('useTerms must be used inside <TermsProvider>');
  return ctx;
}

/** Opens the terms dialog. Renders as a plain button so it can be styled anywhere. */
export function TermsTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, acknowledged } = useTerms();

  return (
    <button
      type="button"
      onClick={open}
      className={cn('inline-flex items-center gap-2', className)}
    >
      {children}
      {acknowledged && (
        <Check className="h-4 w-4 text-forest-600 dark:text-forest-300" aria-label="Acknowledged" />
      )}
    </button>
  );
}
