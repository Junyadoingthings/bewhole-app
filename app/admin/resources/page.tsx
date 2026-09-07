import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { ResourceToggle } from '@/components/admin/resource-toggle';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { formatFullDate, parts } from '@/lib/date';
import { listResources, listWorkshops } from '@/lib/db';

export const metadata: Metadata = { title: 'Resources', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminResourcesPage() {
  await requireStaff();
  const [resources, workshops] = await Promise.all([listResources(false), listWorkshops()]);

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Resources & workshops</h1>
            <p className="mt-2 max-w-xl text-ink-soft">
              What clients see under Resources. Unpublish anything you want to take down — it
              disappears from the site immediately.
            </p>
          </div>
        </div>
      </Reveal>

      <section className="mt-8 space-y-3">
        {resources.map((resource) => (
          <div key={resource.id} className="rounded-3xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-ink">{resource.title}</h2>
                  <Badge tone={resource.published ? 'success' : 'neutral'} size="sm">
                    {resource.published ? 'Published' : 'Draft'}
                  </Badge>
                  <Badge tone="outline" size="sm">
                    {resource.kind}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{resource.excerpt}</p>
                <p className="mt-2 text-xs text-ink-faint">
                  {resource.topic} · {resource.readMinutes} min read ·{' '}
                  {formatFullDate(parts(resource.publishedAt).date)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/resources/${resource.slug}`}
                  target="_blank"
                  className="flex items-center gap-1.5 text-sm text-forest-700 dark:text-forest-300"
                >
                  View
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <ResourceToggle resourceId={resource.id} published={resource.published} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl text-ink">Workshops</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Run for companies, schools, universities, churches and other organisations. Scheduled
          directly with each organisation.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {workshops.map((workshop) => (
            <div key={workshop.id} className="rounded-3xl border border-line bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-ink">{workshop.title}</h3>
                <Badge tone="cream" size="sm">
                  {workshop.status === 'by_request' ? 'By request' : workshop.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{workshop.summary}</p>
              <p className="mt-3 text-xs text-ink-faint">{workshop.audience}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
