import type { Metadata } from 'next';
import { Building2, GraduationCap, Church, Users } from 'lucide-react';

import { BotanicalLines, OrganicField } from '@/components/site/decor';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, SectionHeading } from '@/components/ui/primitives';
import { listWorkshops } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Workshops & wellness programs',
  description:
    'Interactive workshops for companies, schools, universities, churches and organisations — stress management, emotional resilience and spiritual renewal.',
};

const AUDIENCES = [
  { icon: Building2, label: 'Companies & teams' },
  { icon: GraduationCap, label: 'Schools & universities' },
  { icon: Church, label: 'Churches & faith groups' },
  { icon: Users, label: 'Community organisations' },
];

export default async function WorkshopsPage() {
  const workshops = await listWorkshops();

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
        <OrganicField className="-right-40 -top-32 h-[42rem] w-[42rem] opacity-60" />
        <div className="shell relative py-16 sm:py-20">
          <Reveal>
            <p className="eyebrow">Workshops & wellness programs</p>
            <h1 className="mt-6 max-w-3xl text-headline text-ink text-balance">
              Practical tools, delivered to the room that needs them.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
              Interactive sessions designed to equip your people with practical tools for stress
              management, emotional resilience and spiritual renewal.
            </p>
            <div className="mt-9">
              <ButtonLink href="/contact?topic=workshop" size="lg">
                Request a workshop
              </ButtonLink>
            </div>

            <div className="mt-12 flex flex-wrap gap-3">
              {AUDIENCES.map((audience) => (
                <span
                  key={audience.label}
                  className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink-muted"
                >
                  <audience.icon className="h-4 w-4 text-forest-600 dark:text-forest-300" />
                  {audience.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="shell pb-section">
        <Reveal>
          <SectionHeading
            eyebrow="Programs"
            title="Three programs, shaped around your organisation."
            lead="Each is scheduled directly with you — length, format and depth are agreed before anything is confirmed."
          />
        </Reveal>

        <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
          {workshops.map((workshop) => (
            <StaggerItem key={workshop.id} className="h-full">
              <div className="group relative flex h-full flex-col overflow-hidden rounded-4xl border border-line bg-white p-8 transition-all duration-350 ease-calm hover:-translate-y-1 hover:shadow-lifted">
                <BotanicalLines className="-right-12 -top-8 h-64 text-forest-400/10" />
                <div className="relative">
                  <Badge tone="cream" size="sm">
                    {workshop.status === 'by_request' ? 'By request' : 'Open'}
                  </Badge>
                  <h3 className="mt-6 font-display text-2xl text-ink text-balance">
                    {workshop.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft text-pretty">
                    {workshop.description}
                  </p>
                </div>
                <dl className="relative mt-auto space-y-3 border-t border-line pt-6 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-faint">For</dt>
                    <dd className="text-right text-ink-muted">{workshop.audience}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-faint">Format</dt>
                    <dd className="text-ink-muted capitalize">
                      {workshop.format === 'hybrid' ? 'Online or in person' : workshop.format}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-faint">Scheduling</dt>
                    <dd className="text-right text-ink-muted">{workshop.durationLabel}</dd>
                  </div>
                </dl>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.08}>
          <div className="mt-10 rounded-4xl bg-forest-900 p-8 text-cream-100 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <h2 className="font-display text-2xl text-cream-100 text-balance sm:text-3xl">
                  Bringing Be Whole Care to your organisation
                </h2>
                <p className="mt-4 max-w-lg leading-relaxed text-cream-100/70 text-pretty">
                  Tell us who the group is, roughly how many people, and what has been going on.
                  We’ll come back with a proposed shape and a quote — nothing is charged for the
                  conversation.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <ButtonLink href="/contact?topic=workshop" variant="onDark" size="lg">
                  Request a workshop
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
