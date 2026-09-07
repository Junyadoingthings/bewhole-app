import Link from 'next/link';
import { ArrowRight, BookHeart, HeartHandshake } from 'lucide-react';

import { ResourceCover } from '@/components/resources/cover';
import { NAKED_VOWS, WELLNESS_JOURNAL } from '@/config/business';

/**
 * The two things someone can take away without booking a session: the
 * Wellness Journal, and Naked Vows.
 *
 * Replaces the daily-devotional subscription card that used to sit here. The
 * devotional itself has not disappeared — it is part of what the journal
 * contains, which is why the journal keeps the words in its subtitle.
 *
 * Rendered as links rather than forms: the home page stays short and queries
 * nothing, and each destination explains itself properly.
 */
export function ResourceCta() {
  const items = [
    {
      href: '/resources/wellness-journal',
      cover: WELLNESS_JOURNAL.cover,
      icon: BookHeart,
      eyebrow: 'Wellness journal',
      title: WELLNESS_JOURNAL.name,
      blurb: WELLNESS_JOURNAL.subtitle,
      cta: 'Purchase your wellness journal',
      tone: 'cream' as const,
    },
    {
      href: '/resources/naked-vows',
      cover: NAKED_VOWS.cover,
      icon: HeartHandshake,
      eyebrow: NAKED_VOWS.tagline,
      title: NAKED_VOWS.name,
      blurb: 'Marriage resources & empowerment sessions',
      cta: 'Find out more',
      tone: 'clay' as const,
    },
  ];

  return (
    <section className="border-t border-line-soft bg-canvas py-12 sm:py-16">
      <div className="shell grid gap-5 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex overflow-hidden rounded-3xl border border-line bg-canvas-sunk transition-colors hover:border-forest-300"
          >
            {/* The cover, cropped to a narrow spine so two cards fit a phone
                without either becoming a full-bleed image. */}
            <div className="relative w-24 shrink-0 bg-canvas sm:w-28">
              <ResourceCover
                src={item.cover}
                title={item.title}
                tone={item.tone}
                sizes="7rem"
              />
            </div>

            <div className="min-w-0 flex-1 p-5 sm:p-6">
              <p className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
                <item.icon className="h-3.5 w-3.5" />
                {item.eyebrow}
              </p>
              <p className="mt-2 font-display text-base font-semibold text-ink sm:text-lg">
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 dark:text-forest-300">
                {item.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
