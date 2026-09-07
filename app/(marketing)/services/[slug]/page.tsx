import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Check, Clock, MapPin, Video } from 'lucide-react';

import { BotanicalLines, OrganicField } from '@/components/site/decor';
import { Photo, PhotoReveal } from '@/components/site/photo';
import { ServiceIcon } from '@/components/site/service-icon';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { POLICY } from '@/config/business';
import { PHOTOS } from '@/config/photos';
import { getCategoryBySlug, listCategories, listServices } from '@/lib/db';

/**
 * Revalidated, not frozen.
 *
 * This page reads the catalogue from the database, but without this export
 * Next prerenders it once at build time and serves that snapshot forever —
 * so a service deactivated, renamed or repriced in the admin dashboard would
 * never appear on the public site until someone happened to redeploy. That is
 * exactly what happened when "Trauma, Grief & Healing" stayed visible after
 * being switched off in the database.
 *
 * 300s keeps the page effectively static for speed (served from the CDN,
 * regenerated in the background) while guaranteeing an admin change shows up
 * within five minutes without a deploy.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await listCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Service' };
  return { title: category.name, description: category.summary };
}

export default async function ServiceCategoryPage({ params }: { params: { slug: string } }) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const [allServices, allCategories] = await Promise.all([listServices(), listCategories()]);
  const services = allServices.filter((s) => s.categoryId === category.id);
  const others = allCategories.filter((c) => c.id !== category.id).slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
        <OrganicField className="-right-32 -top-40 h-[40rem] w-[40rem] opacity-60" />

        <div className="shell relative py-14 sm:py-18">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            All services
          </Link>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <Reveal>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-800 text-cream-100">
                <ServiceIcon name={category.icon} className="h-6 w-6" />
              </span>
              <h1 className="mt-7 text-headline text-ink text-balance">{category.name}</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
                {category.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`/book?category=${category.slug}`} size="lg">
                  Book this service
                </ButtonLink>
                <ButtonLink href="/contact" variant="secondary" size="lg">
                  Ask a question first
                </ButtonLink>
              </div>
            </Reveal>

            <PhotoReveal delay={0.08}>
              <Photo
                photo={category.slug === 'marriage-and-family-counselling'
                  ? PHOTOS.coupleSession
                  : PHOTOS.individualSession}
                priority
                sizes="(min-width: 1024px) 30rem, 92vw"
                className="aspect-[4/3] w-full rounded-4xl shadow-card lg:aspect-[4/5]"
              />
            </PhotoReveal>
          </div>
        </div>
      </section>

      <section className="shell py-section">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <h2 className="text-title text-ink text-balance">What this covers</h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft text-pretty">
              These are the areas people most often bring to this kind of session. You don’t need to
              fit neatly into one of them to book.
            </p>
          </Reveal>

          <Stagger className="grid gap-3 sm:grid-cols-2">
            {category.areas.map((area) => (
              <StaggerItem key={area}>
                <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-ink">{area}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="relative overflow-hidden bg-cream-100/60 dark:bg-card/60 py-section">
        <BotanicalLines className="-left-16 top-8 h-[85%] text-forest-400/15" />
        <div className="shell relative">
          <Reveal>
            <h2 className="text-title text-ink text-balance">Book a session</h2>
            <p className="mt-4 max-w-lg leading-relaxed text-ink-soft text-pretty">
              Choose the format that suits you. Sessions run 60 minutes and begin and end at the
              agreed time.
            </p>
          </Reveal>

          <Stagger className="mt-10 grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <StaggerItem key={service.id} className="h-full">
                <div className="flex h-full flex-col rounded-3xl border border-line bg-white p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl text-ink">{service.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{service.summary}</p>
                    </div>
                    {service.rateBand === 'free' && <Badge tone="success">Free</Badge>}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge tone="outline" size="sm">
                      <Clock className="h-3 w-3" /> {service.durationMinutes} min
                    </Badge>
                    {service.allowsOnline && (
                      <Badge tone="outline" size="sm">
                        <Video className="h-3 w-3" /> Online
                      </Badge>
                    )}
                    {service.allowsInPerson && (
                      <Badge tone="outline" size="sm">
                        <MapPin className="h-3 w-3" /> In person
                      </Badge>
                    )}
                  </div>

                  {service.intakeNote && (
                    <p className="mt-5 rounded-2xl bg-cream-100 dark:bg-card p-4 text-sm leading-relaxed text-ink-muted">
                      {service.intakeNote}
                    </p>
                  )}

                  <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                    <div>
                      {/* Fees are quoted during booking rather than advertised,
                          so the figure reflects the service, the mode and any
                          medical aid arrangement. */}
                      {service.requiresQuote ? (
                        <p className="text-sm text-ink-soft">Quoted after intake</p>
                      ) : service.rateBand === 'free' ? (
                        <p className="font-display text-2xl text-forest-700 dark:text-forest-300">Free</p>
                      ) : (
                        <p className="text-sm text-ink-soft">
                          {service.durationMinutes} minutes · online or in person
                        </p>
                      )}
                    </div>
                    <ButtonLink href={`/book?service=${service.id}`} size="sm">
                      Book
                    </ButtonLink>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.06}>
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-faint">
              {POLICY.nature} {POLICY.eligibility}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="shell py-section">
        <Reveal>
          <h2 className="text-title text-ink">Other ways we can help</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 md:grid-cols-3">
          {others.map((other) => (
            <StaggerItem key={other.id}>
              <Link
                href={`/services/${other.slug}`}
                className="group flex items-start gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-forest-200 hover:shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 dark:bg-card text-forest-700 dark:text-forest-300">
                  <ServiceIcon name={other.icon} className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{other.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                    {other.summary}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}
