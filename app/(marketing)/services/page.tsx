import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Clock, MapPin, Video } from 'lucide-react';

import { PHOTOS } from '@/config/photos';
import { ServiceIcon } from '@/components/site/service-icon';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { BUSINESS } from '@/config/business';
import { listCategories, listServices } from '@/lib/db';

const APPOINTMENT_STEPS = [
  {
    title: 'Choose a service',
    detail: 'Pick what fits, or start with the free mental health screening if you are unsure.',
  },
  {
    title: 'Pick a time',
    detail: 'Online or in person, from real availability — you only ever see slots that are open.',
  },
  {
    title: 'Confirm and pay',
    detail:
      'The fee for your session is shown before you pay. Medical aid details can be entered instead.',
  },
  {
    title: 'Meet your practitioner',
    detail:
      'A confirmation and a reminder are emailed to you. Online sessions get a private link beforehand.',
  },
];

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Individual counselling, marriage and family counselling, trauma and grief support, workplace stress management, psychometric testing and more — online or in person.',
};

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([listCategories(), listServices()]);

  return (
    <>
      {/*
        The consulting room, not a stock idea of one. A photograph here does
        the work a paragraph cannot: it shows what a session actually looks
        like before anyone has to imagine it.
      */}
      <section className="bg-canvas-sunk">
        <div className="shell grid items-center gap-10 py-14 sm:py-16 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:py-20">
          <Reveal>
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-forest-700 dark:text-forest-300">
              Our services
            </p>
            <h1 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,3rem)] font-bold uppercase leading-[1.1] text-forest-800 dark:text-forest-200">
              Professional counselling services
              <span className="mt-2 block text-[0.62em] font-semibold normal-case tracking-normal text-ink">
                &amp; psychological support
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted text-pretty sm:text-lg">
              {BUSINESS.servicesPromise} Every session is 60 minutes, by appointment, online or at
              one of our two practices.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <Badge tone="cream" size="lg">
                <Clock className="h-3.5 w-3.5" /> 60 minutes
              </Badge>
              <Badge tone="cream" size="lg">
                <Video className="h-3.5 w-3.5" /> Online
              </Badge>
              <Badge tone="cream" size="lg">
                <MapPin className="h-3.5 w-3.5" /> Centurion &amp; Tembisa
              </Badge>
            </div>
          </Reveal>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-lifted">
            <Image
              src={PHOTOS.coupleSession.src}
              alt={PHOTOS.coupleSession.alt}
              fill
              priority
              quality={86}
              sizes="(min-width: 1024px) 32rem, 92vw"
              style={{ objectPosition: PHOTOS.coupleSession.position }}
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="shell pb-section">
        <Stagger className="grid gap-5 lg:grid-cols-2">
          {categories.map((category) => {
            const inCategory = services.filter((s) => s.categoryId === category.id);
            return (
              <StaggerItem key={category.id} className="h-full">
                <Link
                  href={`/services/${category.slug}`}
                  className="group flex h-full flex-col rounded-4xl border border-line bg-white p-8 transition-all duration-350 ease-calm hover:-translate-y-1 hover:border-forest-200 hover:shadow-lifted sm:p-10"
                >
                  <div className="flex items-start justify-between gap-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300 transition-colors duration-300 group-hover:bg-forest-800 group-hover:text-cream-100">
                      <ServiceIcon name={category.icon} className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest-600 dark:group-hover:text-forest-300" />
                  </div>

                  <h2 className="mt-7 font-display text-2xl text-ink text-balance">{category.name}</h2>
                  <p className="mt-3 leading-relaxed text-ink-soft text-pretty">{category.description}</p>

                  <ul className="mt-7 grid gap-2 sm:grid-cols-2">
                    {category.areas.map((area) => (
                      <li key={area} className="flex items-start gap-2.5 text-sm text-ink-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-forest-400" />
                        {area}
                      </li>
                    ))}
                  </ul>

                  {inCategory.length > 0 && (
                    <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-line pt-5 text-sm">
                      {inCategory.map((service) => (
                        <span
                          key={service.id}
                          className="rounded-full bg-cream-100 dark:bg-card px-3 py-1.5 text-xs text-ink-muted"
                        >
                          {/* Fees are quoted at booking, not advertised here. */}
                          {service.name}
                          {service.rateBand === 'free' && (
                            <span className="ml-1.5 text-forest-600 dark:text-forest-300">free</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/*
          Was a published rate card. Fees are now quoted during booking, once
          the service and whether it is online or in person are known — which is
          also when medical aid details are collected, so the figure shown is
          the one that actually applies.
        */}
        <Reveal delay={0.08}>
          <div className="mt-10 rounded-4xl border border-line bg-canvas-sunk p-8 sm:p-10">
            <h2 className="font-display text-2xl text-ink">How an appointment works</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft text-pretty">
              Every session is 60 minutes and by appointment, online or at one of our two
              practices. Booking takes about two minutes.
            </p>

            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {APPOINTMENT_STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-line bg-card p-6">
                  <span className="font-display text-lg text-forest-700 dark:text-forest-300 tabular">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-sm font-medium text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.detail}</p>
                </li>
              ))}
            </ol>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="/book">Book an appointment</ButtonLink>
              <Link href="/terms" className="text-sm text-ink-soft underline-offset-4 hover:underline">
                Fees, cancellations &amp; medical aid — read the terms
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
