'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { ServiceIcon } from '@/components/site/service-icon';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ServiceCategory } from '@/types';

/**
 * Service discovery, not assessment.
 *
 * Picking a concern filters the published service catalogue — nothing is
 * interpreted, scored or diagnosed, and the copy says so plainly.
 */

const CONCERNS = [
  { id: 'stress', label: 'Stress & burnout' },
  { id: 'relationships', label: 'My relationship' },
  { id: 'family', label: 'My family' },
  { id: 'trauma', label: 'Trauma & healing' },
  { id: 'emotional-wellbeing', label: 'How I’ve been feeling' },
  { id: 'work', label: 'Work' },
  { id: 'career', label: 'Career direction' },
  { id: 'personal-growth', label: 'Personal growth' },
  { id: 'assessment', label: 'Testing & assessment' },
];

export function ConcernSelector({ categories }: { categories: ServiceCategory[] }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const reduced = useReducedMotion();

  const matches = React.useMemo(() => {
    if (!selected) return [];
    return categories.filter((c) => c.concerns.includes(selected));
  }, [categories, selected]);

  return (
    <section className="shell py-section">
      <div className="relative overflow-hidden rounded-4xl border border-line bg-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cream-200/50 dark:bg-cream-100/10 blur-3xl" />

        <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:p-16">
          <div>
            <p className="eyebrow">Find your starting point</p>
            <h2 className="mt-5 text-title text-ink text-balance">
              I’m looking for support with…
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft text-pretty">
              Choose whatever is closest. We’ll show you which of our services tends to fit — no
              questionnaire, no assessment, and nothing recorded.
            </p>

            <div
              className="mt-8 flex flex-wrap gap-2.5"
              role="radiogroup"
              aria-label="What are you looking for support with?"
            >
              {CONCERNS.map((concern) => {
                const active = selected === concern.id;
                return (
                  <button
                    key={concern.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(active ? null : concern.id)}
                    className={cn(
                      'rounded-full border px-4 py-2.5 text-sm transition-all duration-250 ease-calm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2',
                      active
                        ? 'border-forest-800 bg-forest-800 text-cream-100 shadow-subtle'
                        : 'border-line-strong bg-white text-ink-muted hover:-translate-y-0.5 hover:border-forest-300 hover:text-ink',
                    )}
                  >
                    {concern.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-8 max-w-md text-sm leading-relaxed text-ink-faint">
              This is a way to navigate our services — it is not a diagnosis or clinical advice. If
              you are in immediate danger, please contact emergency services on 112 or the SADAG
              24-hour helpline on 0800 456 789.
            </p>
          </div>

          <div className="min-h-[22rem] rounded-3xl border border-line bg-cream-50/70 dark:bg-card/70 p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {!selected ? (
                <motion.div
                  key="empty"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex h-full min-h-[18rem] flex-col items-center justify-center text-center"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-forest-500 dark:text-forest-300 shadow-subtle">
                    <ArrowRight className="h-5 w-5 -rotate-45" />
                  </span>
                  <p className="mt-5 font-display text-lg text-ink">Pick one to begin</p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
                    Not sure which fits? Most people start with individual counselling, or a free
                    screening conversation.
                  </p>
                  <ButtonLink href="/book?service=svc_screening" variant="secondary" size="sm" className="mt-6">
                    Book a free screening
                  </ButtonLink>
                </motion.div>
              ) : (
                <motion.div
                  key={selected}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-2xs font-medium uppercase tracking-[0.16em] text-forest-600 dark:text-forest-300">
                    {matches.length === 1 ? 'One service fits' : `${matches.length} services fit`}
                  </p>

                  <ul className="mt-5 space-y-3">
                    {matches.map((category, i) => (
                      <motion.li
                        key={category.id}
                        initial={reduced ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 * i, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <Link
                          href={`/services/${category.slug}`}
                          className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-4 transition-all duration-250 ease-calm hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-card"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                            <ServiceIcon name={category.icon} className="h-4.5 w-4.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{category.name}</span>
                            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                              {category.summary}
                            </span>
                          </span>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-250 group-hover:translate-x-0.5 group-hover:text-forest-600 dark:group-hover:text-forest-300" />
                        </Link>
                      </motion.li>
                    ))}
                  </ul>

                  <div className="mt-6 rounded-2xl border border-line bg-white p-5">
                    <p className="text-sm leading-relaxed text-ink-muted">
                      Still not sure? You don’t have to have it figured out before you book. A first
                      session is often just an hour of saying out loud what’s been going on.
                    </p>
                    <ButtonLink href="/book" size="sm" className="mt-4">
                      Book an appointment
                    </ButtonLink>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
