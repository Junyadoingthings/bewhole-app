import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { ServiceIcon } from '@/components/site/service-icon';
import { ArcMotif, BotanicalLines } from '@/components/site/decor';
import { Photo } from '@/components/site/photo';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { SectionHeading } from '@/components/ui/primitives';
import { PHOTOS } from '@/config/photos';
import { cn } from '@/lib/utils';
import type { ServiceCategory } from '@/types';

/**
 * Editorial service grid.
 *
 * Deliberately uneven: the first card runs full width on large screens and the
 * rest fall into a 3-up rhythm, so the section reads as a spread rather than a
 * uniform tile wall.
 */
export function ServicesGrid({ categories }: { categories: ServiceCategory[] }) {
  const [lead, ...rest] = categories;

  return (
    <section id="services" className="shell scroll-mt-28 py-section">
      <Reveal>
        <SectionHeading
          eyebrow="Our services"
          title="Confidential, ethical, client-centred care."
          lead="We provide counselling services you can trust — for individuals, couples, families and organisations. Every session runs 60 minutes, online or in person."
          action={
            <Link
              href="/services"
              className="group inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300"
            >
              All services
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          }
        />
      </Reveal>

      {lead && (
        <Reveal delay={0.05} className="mt-12">
          <FeatureCard category={lead} />
        </Reveal>
      )}

      <Stagger className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((category) => (
          <StaggerItem key={category.id} className="h-full">
            <ServiceCard category={category} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function FeatureCard({ category }: { category: ServiceCategory }) {
  return (
    <Link
      href={`/services/${category.slug}`}
      className="group relative block overflow-hidden rounded-4xl bg-forest-900 text-cream-100 transition-shadow duration-400 ease-calm hover:shadow-float"
    >
      {/* Photograph sits behind the deep-green wash so the card has real depth. */}
      <Photo
        photo={PHOTOS.individualSession}
        sizes="(min-width: 1024px) 76rem, 100vw"
        tone="none"
        className="absolute inset-0 h-full w-full"
        imageClassName="transition-transform duration-1000 ease-calm group-hover:scale-[1.05]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-forest-950/95 via-forest-950/90 to-forest-900/70"
      />
      <BotanicalLines className="-right-6 -top-10 h-[130%] text-forest-300/20 transition-transform duration-700 ease-calm group-hover:scale-105" />
      <ArcMotif className="-bottom-24 left-10 h-72 w-72 text-forest-300/15" />

      <div className="relative grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:p-12">
        <div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100/10 text-forest-300">
            <ServiceIcon name={category.icon} className="h-5 w-5" />
          </span>
          <h3 className="mt-6 font-display text-3xl leading-tight text-cream-100 sm:text-4xl text-balance">
            {category.name}
          </h3>
          <p className="mt-4 max-w-md text-cream-100/70 leading-relaxed text-pretty">
            {category.description}
          </p>
          <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-cream-100">
            Explore this service
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {category.areas.map((area) => (
            <li
              key={area}
              className="rounded-xl border border-cream-100/10 bg-cream-100/5 px-3.5 py-2.5 text-sm text-cream-100/80"
            >
              {area}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

function ServiceCard({ category }: { category: ServiceCategory }) {
  const accent = {
    forest: 'bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300',
    clay: 'bg-clay-200/60 text-clay-700',
    cream: 'bg-cream-200 dark:bg-canvas-sunk text-forest-800 dark:text-forest-200',
  }[category.accent];

  return (
    <Link
      href={`/services/${category.slug}`}
      className={cn(
        'group flex h-full flex-col rounded-3xl border border-line bg-white p-7',
        'transition-all duration-350 ease-calm hover:-translate-y-1 hover:border-forest-200 hover:shadow-lifted',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', accent)}>
          <ServiceIcon name={category.icon} className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-ink-faint transition-all duration-300 ease-calm group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest-600 dark:group-hover:text-forest-300" />
      </div>

      <h3 className="mt-6 font-display text-xl text-ink text-balance">{category.name}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">{category.summary}</p>

      <ul className="mt-6 space-y-2 border-t border-line pt-5">
        {category.areas.slice(0, 4).map((area) => (
          <li key={area} className="flex items-start gap-2.5 text-sm text-ink-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest-400" />
            {area}
          </li>
        ))}
        {category.areas.length > 4 && (
          <li className="pl-4 text-sm text-ink-faint">
            +{category.areas.length - 4} more areas supported
          </li>
        )}
      </ul>
    </Link>
  );
}
