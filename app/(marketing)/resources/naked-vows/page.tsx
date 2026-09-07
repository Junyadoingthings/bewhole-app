import type { Metadata } from 'next';
import { HeartHandshake, MessageCircle } from 'lucide-react';

import { NakedVowsInterestForm } from '@/components/naked-vows/interest-form';
import { ResourceCover } from '@/components/resources/cover';
import { Reveal } from '@/components/motion';
import { BUSINESS, NAKED_VOWS, PRACTITIONER } from '@/config/business';

export const metadata: Metadata = {
  title: 'Naked Vows',
  description:
    'Naked Vows — marriage resources, empowerment sessions and an annual gathering for ' +
    'married couples, with Be Whole Care.',
};

/**
 * Naked Vows — two ways in, at different levels of commitment.
 *
 *   1. The WhatsApp channel: ongoing marriage resources, open to anyone.
 *   2. Registering interest in the annual gathering, which is
 *      invitation-based — the practitioner speaks to a couple first.
 *
 * The channel button only renders once a URL exists in config. A "join the
 * channel" button that goes nowhere would be worse than waiting.
 */
export default function NakedVowsPage() {
  const channelUrl = NAKED_VOWS.whatsappChannelUrl;
  const fallbackMessage = `Hi Be Whole Care, we're interested in Naked Vows marriage resources.`;

  return (
    <div className="shell py-14 sm:py-20">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[2rem] bg-canvas-sunk shadow-lifted">
            <ResourceCover
              src={NAKED_VOWS.cover}
              title={NAKED_VOWS.name}
              subtitle={NAKED_VOWS.tagline}
              tone="clay"
              priority
              sizes="(min-width: 1024px) 24rem, 90vw"
            />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
            <HeartHandshake className="h-3.5 w-3.5" />
            {NAKED_VOWS.tagline}
          </p>

          <h1 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,3rem)] font-bold leading-[1.08] text-ink">
            {NAKED_VOWS.name}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted text-pretty">
            {NAKED_VOWS.intro}
          </p>

          {/* 1 — Ongoing resources. */}
          <div className="mt-9 rounded-3xl border border-line bg-canvas-sunk p-6 sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink">
              Marriage resources &amp; empowerment sessions
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Ongoing encouragement for couples, shared as it is published.
            </p>

            <a
              href={
                channelUrl ??
                `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(fallbackMessage)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#1FBE5A] sm:w-auto"
            >
              <MessageCircle className="h-4 w-4" />
              {channelUrl ? 'Click here for marriage resources' : 'Message us on WhatsApp'}
            </a>
          </div>

          {/* 2 — The annual gathering. */}
          <div className="mt-5 rounded-3xl border border-line bg-card p-6 sm:p-7">
            <h2 className="font-display text-lg font-semibold text-ink">
              The annual gathering
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Naked Vows runs once a year for a small number of couples. Leave your details and
              {' '}
              {PRACTITIONER.name.split(' ')[0]} will be in touch before the next one.
            </p>

            <div className="mt-6">
              <NakedVowsInterestForm />
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
