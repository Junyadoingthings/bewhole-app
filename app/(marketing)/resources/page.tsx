import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, Headphones, Sparkles } from 'lucide-react';

import { PodcastInvite } from '@/components/home/welcome-sections';
import { ArcMotif } from '@/components/site/decor';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { listResources } from '@/lib/db';
import { formatShortDate } from '@/lib/date';
import { parts } from '@/lib/date';

export const metadata: Metadata = {
  title: 'Wellness resources',
  description:
    'Articles, guided reflections and faith & wellness resources from Be Whole Care — written to be useful on their own.',
};

const KIND_LABEL: Record<string, string> = {
  article: 'Article',
  reflection: 'Reflection',
  podcast: 'Podcast',
  worksheet: 'Worksheet',
};

export default async function ResourcesPage() {
  const resources = await listResources();
  const [lead, ...rest] = resources;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
        <ArcMotif className="-right-40 -top-20 h-[32rem] w-[32rem] text-forest-300/25" />
        <div className="shell relative py-16 sm:py-20">
          <Reveal>
            <p className="eyebrow">Wellness resources</p>
            <h1 className="mt-6 max-w-2xl text-headline text-ink text-balance">
              Something to read while you decide.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
              Articles, guided reflections and faith & wellness resources to encourage and
              strengthen you — whether or not you ever book a session.
            </p>
          </Reveal>
        </div>
      </section>

      {/*
        The podcast moved here from the home page. It belongs with the other
        things someone can use without booking anything — and the home page is
        deliberately down to three sections. It carries its own section and
        shell, so it is placed directly rather than wrapped.
      */}
      <PodcastInvite />

      <section className="shell pb-section">
        {resources.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="Resources are on their way"
            description="New articles and reflections are published here regularly."
            action={<ButtonLink href="/book">Book an appointment</ButtonLink>}
          />
        ) : (
          <>
            {lead && (
              <Reveal>
                <Link
                  href={`/resources/${lead.slug}`}
                  className="group grid gap-8 overflow-hidden rounded-4xl border border-line bg-white p-8 transition-all duration-350 ease-calm hover:border-forest-200 hover:shadow-lifted sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <Badge tone="cream" size="sm">
                        {KIND_LABEL[lead.kind]}
                      </Badge>
                      <span className="text-xs text-ink-faint">{lead.readMinutes} min read</span>
                      <span className="text-xs text-ink-faint">
                        {formatShortDate(parts(lead.publishedAt).date)}
                      </span>
                    </div>
                    <h2 className="mt-6 font-display text-3xl leading-tight text-ink text-balance sm:text-4xl">
                      {lead.title}
                    </h2>
                    <p className="mt-5 max-w-xl leading-relaxed text-ink-soft text-pretty">
                      {lead.excerpt}
                    </p>
                    <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300">
                      Read it
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="hidden rounded-3xl bg-cream-100 dark:bg-card p-8 lg:block">
                    <p className="font-display text-lg leading-relaxed text-forest-800 dark:text-forest-200">
                      {lead.topic}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                      Part of our wellness library — psychoeducational writing, not clinical advice.
                    </p>
                  </div>
                </Link>
              </Reveal>
            )}

            <Stagger className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((resource) => (
                <StaggerItem key={resource.id} className="h-full">
                  <Link
                    href={`/resources/${resource.slug}`}
                    className="group flex h-full flex-col rounded-3xl border border-line bg-white p-7 transition-all duration-350 ease-calm hover:-translate-y-1 hover:border-forest-200 hover:shadow-lifted"
                  >
                    <div className="flex items-center gap-3">
                      <Badge tone="outline" size="sm">
                        {KIND_LABEL[resource.kind]}
                      </Badge>
                      <span className="text-xs text-ink-faint">{resource.readMinutes} min</span>
                    </div>
                    <h3 className="mt-5 font-display text-xl leading-snug text-ink text-balance">
                      {resource.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft text-pretty">
                      {resource.excerpt}
                    </p>
                    <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                      <span className="text-xs text-ink-faint">{resource.topic}</span>
                      <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-forest-600 dark:group-hover:text-forest-300" />
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </>
        )}

        <Reveal delay={0.08}>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-forest-700 dark:text-forest-300">
                <Headphones className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl text-ink">Faith & wellness resources</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft text-pretty">
                Articles, podcasts and guided reflections to encourage and strengthen your walk with
                God, alongside the practical work of counselling.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-forest-700 dark:text-forest-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl text-ink">Workshops & wellness programs</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft text-pretty">
                Interactive sessions for companies, schools, universities, churches and other
                organisations.
              </p>
              <Link
                href="/workshops"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300"
              >
                See workshops
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
