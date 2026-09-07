import type { Metadata } from 'next';
import Link from 'next/link';
import { BookHeart, Check, MessageCircle } from 'lucide-react';

import { ResourceCover } from '@/components/resources/cover';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, PRACTITIONER, WELLNESS_JOURNAL } from '@/config/business';
import { money } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Be Whole Wellness Journal',
  description:
    'A 30-day guided journal pairing a daily devotional with counselling-style reflection ' +
    'exercises — for low mood, hopelessness and discouragement.',
};

/**
 * The Wellness Journal — a purchasable digital workbook.
 *
 * Replaces the subscriber-only daily devotional that used to live here. The
 * devotional content itself is not gone; it is part of what the journal
 * contains, which is why the subtitle keeps the words.
 *
 * The call to action depends on whether a price has been set in config. Until
 * it has, the page invites an enquiry rather than showing a Buy button that
 * cannot take money — see the note on WELLNESS_JOURNAL.
 */
export default function WellnessJournalPage() {
  const onSale = typeof WELLNESS_JOURNAL.priceCents === 'number';
  const enquiryMessage = `Hi Be Whole Care, I'd like to order the ${WELLNESS_JOURNAL.name}.`;

  return (
    <div className="shell py-14 sm:py-20">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* The cover. */}
        <Reveal>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[2rem] bg-canvas-sunk shadow-lifted">
            <ResourceCover
              src={WELLNESS_JOURNAL.cover}
              title={WELLNESS_JOURNAL.name}
              subtitle={WELLNESS_JOURNAL.subtitle}
              priority
              sizes="(min-width: 1024px) 24rem, 90vw"
            />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
            <BookHeart className="h-3.5 w-3.5" />
            Wellness journal
          </p>

          <h1 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,3rem)] font-bold leading-[1.08] text-ink">
            {WELLNESS_JOURNAL.name}
          </h1>
          <p className="mt-2 font-display text-base font-semibold uppercase tracking-[0.02em] text-forest-700 dark:text-forest-300 sm:text-lg">
            {WELLNESS_JOURNAL.subtitle}
          </p>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted text-pretty">
            {WELLNESS_JOURNAL.intro}
          </p>

          <ul className="mt-7 space-y-2.5">
            {WELLNESS_JOURNAL.includes.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 rounded-3xl border border-line bg-canvas-sunk p-6 sm:p-7">
            {onSale ? (
              <>
                <p className="font-display text-3xl font-semibold text-ink">
                  {money(WELLNESS_JOURNAL.priceCents as number)}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  One payment. Yours to download and keep.
                </p>
                <ButtonLink href="/resources/wellness-journal/buy" size="lg" className="mt-5 w-full sm:w-auto">
                  Purchase your wellness journal
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-semibold text-ink">Available soon</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  The journal is being prepared for release. Message us and we will let you know
                  the moment it is ready.
                </p>
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(enquiryMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:bg-forest-900 sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enquire on WhatsApp
                </a>
              </>
            )}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-ink-faint">
            Written by {PRACTITIONER.name}, {PRACTITIONER.title} ({PRACTITIONER.council}).
            A journal is a companion to counselling, not a replacement for it — if you are
            struggling, please{' '}
            <Link href="/book" className="underline underline-offset-4 hover:text-ink">
              book a session
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </div>
  );
}
