import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { listResources, listWorkshops } from '@/lib/db';

export const metadata: Metadata = { title: 'Resources', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PortalResourcesPage() {
  const [resources, workshops] = await Promise.all([listResources(), listWorkshops()]);

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Wellness resources</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">
          Articles, guided reflections and faith & wellness resources — useful on their own, whether
          or not you have a session coming up.
        </p>
      </Reveal>

      <Stagger className="mt-8 grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => (
          <StaggerItem key={resource.id} className="h-full">
            <Link
              href={`/resources/${resource.slug}`}
              className="group flex h-full flex-col rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-forest-200 hover:shadow-card"
            >
              <div className="flex items-center gap-3">
                <Badge tone="cream" size="sm">
                  {resource.kind === 'reflection' ? 'Reflection' : 'Article'}
                </Badge>
                <span className="text-xs text-ink-faint">{resource.readMinutes} min</span>
              </div>
              <h2 className="mt-4 font-display text-lg leading-snug text-ink text-balance">
                {resource.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft text-pretty">
                {resource.excerpt}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 dark:text-forest-300">
                Read
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.08}>
        <div className="mt-8 rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-forest-700 dark:text-forest-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-5 font-display text-xl text-ink">Workshops & wellness programs</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
            {workshops.length} programs run for companies, schools, universities, churches and other
            organisations — stress management, emotional resilience and spiritual renewal.
          </p>
          <ButtonLink href="/workshops" variant="secondary" size="sm" className="mt-5">
            See workshops
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  );
}
