import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

import { LeafRule } from '@/components/site/decor';
import { Prose } from '@/components/site/prose';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { CRISIS_SUPPORT } from '@/config/business';
import { formatFullDate, parts } from '@/lib/date';
import { getResourceBySlug, listResources } from '@/lib/db';

export async function generateStaticParams() {
  const resources = await listResources();
  return resources.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const resource = await getResourceBySlug(params.slug);
  if (!resource) return { title: 'Resource' };
  return { title: resource.title, description: resource.excerpt };
}

export default async function ResourcePage({ params }: { params: { slug: string } }) {
  const resource = await getResourceBySlug(params.slug);
  if (!resource || !resource.published) notFound();

  const all = await listResources();
  const more = all.filter((r) => r.id !== resource.id).slice(0, 2);

  return (
    <article className="shell py-14 sm:py-18">
      <Link
        href="/resources"
        className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All resources
      </Link>

      <Reveal className="mx-auto mt-10 max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="cream" size="sm">
            {resource.topic}
          </Badge>
          <span className="text-xs text-ink-faint">{resource.readMinutes} min read</span>
          <span className="text-xs text-ink-faint">
            {formatFullDate(parts(resource.publishedAt).date)}
          </span>
        </div>

        <h1 className="mt-6 font-display text-4xl leading-[1.08] text-ink text-balance sm:text-5xl">
          {resource.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted text-pretty">{resource.excerpt}</p>

        <LeafRule className="my-10" />

        <Prose body={resource.body} className="text-[1.0625rem]" />

        {/* Every resource ends by routing outward, never by claiming to treat. */}
        <div className="mt-12 rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-7">
          <p className="text-sm leading-relaxed text-ink-muted">
            This is psychoeducational writing from Be Whole Care. It is not a diagnosis, treatment or
            clinical advice, and it is no substitute for speaking with a qualified professional who
            knows your situation.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {CRISIS_SUPPORT.note} Emergency services: 112 · SADAG 24hr helpline: 0800 456 789.
          </p>
          <ButtonLink href="/book" className="mt-6">
            Book a session
          </ButtonLink>
        </div>
      </Reveal>

      {more.length > 0 && (
        <div className="mx-auto mt-16 max-w-2xl">
          <p className="eyebrow">Keep reading</p>
          <div className="mt-6 space-y-3">
            {more.map((item) => (
              <Link
                key={item.id}
                href={`/resources/${item.slug}`}
                className="group flex items-center justify-between gap-6 rounded-2xl border border-line bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{item.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{item.topic}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
