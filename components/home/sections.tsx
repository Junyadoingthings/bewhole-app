import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  FileLock2,
  Headphones,
  MapPin,
  MessageCircle,
  Repeat,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';

import { ArcMotif, BotanicalLines, LeafRule, OrganicField } from '@/components/site/decor';
import { Photo, ParallaxPhoto, PhotoReveal, PhotoScrim } from '@/components/site/photo';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, SectionHeading } from '@/components/ui/primitives';
import { BUSINESS, LOCATIONS, POLICY, RATES } from '@/config/business';
import { PHOTOS } from '@/config/photos';
import { money } from '@/lib/utils';
import type { Resource } from '@/types';

/* ------------------------------------------------------------ in the room */

/**
 * The editorial centrepiece: what an hour here actually looks like.
 * Two overlapping photographs, a pull quote, and the three facts people most
 * want confirmed before they book.
 */
export function InTheRoom() {
  return (
    <section className="shell py-section">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div className="relative">
          <PhotoReveal>
            <Photo
              photo={PHOTOS.individualSession}
              sizes="(min-width: 1024px) 40rem, 92vw"
              className="aspect-[5/4] w-full rounded-4xl shadow-card"
            />
          </PhotoReveal>

          {/* Overlapping portrait — the practitioner, not a stock idea of one. */}
          <PhotoReveal
            delay={0.14}
            className="absolute -bottom-10 -right-2 hidden w-44 sm:block lg:-right-10 lg:w-52"
          >
            <Photo
              photo={PHOTOS.practitioner}
              sizes="14rem"
              className="aspect-[3/4] w-full rounded-3xl border-[6px] border-cream-50 shadow-lifted"
            />
          </PhotoReveal>
        </div>

        <Reveal delay={0.06} className="lg:pl-4">
          <p className="eyebrow">What an hour looks like</p>
          <h2 className="mt-5 text-title text-ink text-balance">
            Mostly, it is being listened to properly.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-ink-soft text-pretty">
            You will not be asked to produce your whole history in order. You will be asked what
            brought you here, and given room to answer however it comes out. Confidentiality and its
            limits are explained at the start — before you decide what to share.
          </p>

          <blockquote className="mt-8 border-l-2 border-forest-300 pl-5">
            <p className="font-display text-xl leading-snug text-forest-800 dark:text-forest-200 text-balance">
              “I’m not ready to talk about that yet” is a complete and acceptable answer.
            </p>
          </blockquote>

          {/* Deliberately not animated. These are facts about the practice —
              a counter that stalls would state them wrongly. */}
          <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-line pt-7">
            {[
              { label: 'Every session', value: '60 min' },
              { label: 'Practices', value: 'Two' },
              { label: 'Notice to cancel', value: '24 hrs' },
            ].map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs uppercase tracking-[0.1em] text-ink-faint">{fact.label}</dt>
                <dd className="mt-1.5 font-display text-2xl tabular text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ how it works */

const STEPS = [
  {
    n: '01',
    title: 'Choose your support',
    body: 'Tell us what you’re looking for. If you’re unsure, start with individual counselling or a free screening.',
    icon: Sparkles,
  },
  {
    n: '02',
    title: 'Book your appointment',
    body: 'Pick online or in person, then a date and time that actually works. You’ll see real availability only.',
    icon: CalendarCheck,
  },
  {
    n: '03',
    title: 'Meet your practitioner',
    body: 'Sixty minutes, beginning and ending at the agreed time. Online sessions get a private link beforehand.',
    icon: Video,
  },
  {
    n: '04',
    title: 'Continue at your pace',
    body: 'Book again when you’re ready, or let us set up a follow-up. There’s no obligation to commit to a course.',
    icon: Repeat,
  },
];

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-cream-100/60 dark:bg-card/60 py-section">
      <ArcMotif className="-left-32 top-10 h-[28rem] w-[28rem] text-forest-300/25" />

      <div className="shell relative">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Four steps, and none of them are a form."
            lead="Booking with Be Whole Care should feel easier than sending a WhatsApp — and give you more certainty at the end of it."
            align="center"
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <StaggerItem key={step.n} className="h-full">
              <div className="group relative flex h-full flex-col rounded-3xl border border-line bg-white p-7 transition-all duration-350 ease-calm hover:-translate-y-1 hover:shadow-lifted">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm tabular text-forest-600 dark:text-forest-300">{step.n}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 dark:bg-card text-forest-700 dark:text-forest-300 transition-colors duration-300 group-hover:bg-forest-800 group-hover:text-cream-100">
                    <step.icon className="h-4.5 w-4.5" />
                  </span>
                </div>
                <h3 className="mt-6 font-display text-lg text-ink">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-soft text-pretty">{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} className="mt-10 flex justify-center">
          <ButtonLink href="/book" size="lg">
            Start booking
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- online + in person */

export function MeetingModes() {
  return (
    <section className="shell py-section">
      <Reveal>
        <SectionHeading
          eyebrow="Online & in person"
          title="Meet us where it’s easiest to be honest."
          lead="Both formats run the same length and cost the same to book. Choose whichever makes it more likely you’ll actually keep the appointment."
        />
      </Reveal>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <div className="relative h-full overflow-hidden rounded-4xl border border-line bg-white p-8 sm:p-10">
            <OrganicField className="-right-24 -top-24 h-80 w-80 opacity-60" />
            <div className="relative">
              <Badge tone="cream" size="sm">
                <Video className="h-3 w-3" /> Online
              </Badge>
              <h3 className="mt-6 font-display text-2xl text-ink">From wherever you are</h3>
              <p className="mt-3 max-w-md leading-relaxed text-ink-soft text-pretty">
                A private session link is sent to you before we meet. All you need is a quiet space
                and a stable connection — many clients take theirs from a parked car.
              </p>
              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream-50 dark:bg-canvas p-4">
                  <dt className="text-xs uppercase tracking-[0.1em] text-ink-faint">Individual</dt>
                  <dd className="mt-1 font-display text-2xl tabular text-ink">
                    {money(RATES.individual.online)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-cream-50 dark:bg-canvas p-4">
                  <dt className="text-xs uppercase tracking-[0.1em] text-ink-faint">Couple / family</dt>
                  <dd className="mt-1 font-display text-2xl tabular text-ink">
                    {money(RATES.couple.online)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="relative h-full overflow-hidden rounded-4xl bg-forest-900 p-8 text-cream-100 sm:p-10">
            <div className="absolute inset-0 bg-forest-deep" />
            <BotanicalLines className="-right-10 top-0 h-full text-forest-300/20" />
            <div className="relative">
              <Badge tone="forest" size="sm" className="border border-cream-100/20">
                <MapPin className="h-3 w-3" /> In person
              </Badge>
              <h3 className="mt-6 font-display text-2xl text-cream-100">Two practices in Gauteng</h3>
              <ul className="mt-5 space-y-4">
                {LOCATIONS.map((location) => (
                  <li key={location.slug} className="rounded-2xl border border-cream-100/10 bg-cream-100/5 p-4">
                    <p className="text-sm font-medium text-cream-100">{location.name}</p>
                    <p className="mt-1 text-sm text-cream-100/65">
                      {location.addressLine}, {location.city}, {location.postalCode}
                    </p>
                  </li>
                ))}
              </ul>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-cream-100/10 bg-cream-100/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.1em] text-cream-100/50">Individual</dt>
                  <dd className="mt-1 font-display text-2xl tabular text-cream-100">
                    {money(RATES.individual.centurion)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-cream-100/10 bg-cream-100/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.1em] text-cream-100/50">
                    Couple / family
                  </dt>
                  <dd className="mt-1 font-display text-2xl tabular text-cream-100">
                    {money(RATES.couple.centurion)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.05}>
        <div className="mt-5 grid gap-5 rounded-3xl border border-line bg-cream-50 dark:bg-canvas p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-forest-700 dark:text-forest-300 shadow-subtle">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-ink">Medical aid is accepted</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft text-pretty">
              A {money(RATES.medicalAidCoPaymentInPerson)} co-payment applies to in-person
              consultations using medical aid benefits. Claims are subject to your scheme’s rules
              and benefits.
            </p>
          </div>
          <Link
            href="/terms#payment"
            className="group inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300"
          >
            Payment terms
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- resources */

export function ResourcesPreview({ resources }: { resources: Resource[] }) {
  return (
    <section className="shell py-section">
      <Reveal>
        <SectionHeading
          eyebrow="Wellness resources"
          title="Something to read while you decide."
          lead="Articles, guided reflections and faith & wellness resources — written to be useful on their own, not as a sales funnel."
          action={
            <Link
              href="/resources"
              className="group inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300"
            >
              All resources
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          }
        />
      </Reveal>

      <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
        {resources.slice(0, 3).map((resource) => (
          <StaggerItem key={resource.id} className="h-full">
            <Link
              href={`/resources/${resource.slug}`}
              className="group flex h-full flex-col rounded-3xl border border-line bg-white p-7 transition-all duration-350 ease-calm hover:-translate-y-1 hover:border-forest-200 hover:shadow-lifted"
            >
              <div className="flex items-center gap-3">
                <Badge tone="cream" size="sm">
                  {resource.kind === 'reflection' ? 'Reflection' : 'Article'}
                </Badge>
                <span className="text-xs text-ink-faint">{resource.readMinutes} min read</span>
              </div>
              <h3 className="mt-5 font-display text-xl leading-snug text-ink text-balance">
                {resource.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft text-pretty">
                {resource.excerpt}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300">
                Read
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.06}>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Headphones, label: 'Podcasts & guided reflections', href: '/resources' },
            { icon: MessageCircle, label: 'Online support groups', href: '/services/additional-services' },
            { icon: Sparkles, label: 'Workshops & wellness programs', href: '/workshops' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-cream-50 dark:bg-canvas px-5 py-4 text-sm text-ink-muted transition-colors duration-250 hover:border-forest-200 hover:text-ink"
            >
              <item.icon className="h-4.5 w-4.5 shrink-0 text-forest-600 dark:text-forest-300" />
              <span className="flex-1">{item.label}</span>
              <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform duration-250 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------- trust */

const TRUST = [
  {
    icon: FileLock2,
    title: 'Confidential by default',
    body: POLICY.confidentiality,
    detail: 'Its limits are explained to you during informed consent, before you share anything.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data stays minimal',
    body: 'We collect what a booking actually needs and nothing more. Medical aid details are only requested if you choose to claim.',
    detail: 'Handled in line with POPIA principles. You can request your information at any time.',
  },
  {
    icon: BadgeCheck,
    title: 'Clear about what this is',
    body: POLICY.nature,
    detail: 'Sessions are 60 minutes, by appointment, and clients must be 16 or have guardian consent.',
  },
];

export function TrustSection() {
  return (
    <section className="relative overflow-hidden bg-cream-100/60 dark:bg-card/60 py-section">
      <div className="shell relative">
        <Reveal>
          <SectionHeading
            eyebrow="Privacy & professionalism"
            title="What you tell us stays between us."
            lead="Counselling only works if you can be honest in the room. Here is exactly how that is protected — including where the limits sit."
            align="center"
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
          {TRUST.map((item) => (
            <StaggerItem key={item.title} className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-line bg-white p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 font-display text-lg text-ink">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft text-pretty">
                  {item.body}
                </p>
                <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-faint">
                  {item.detail}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.08}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-ink-soft">
            Read the full{' '}
            <Link href="/terms" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
              terms & conditions
            </Link>{' '}
            and our{' '}
            <Link href="/privacy" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
              privacy notice
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- final CTA */

export function ClosingCta() {
  return (
    <section className="shell py-section">
      <Reveal>
        <div className="relative overflow-hidden rounded-4xl text-center text-cream-100">
          {/* The photograph is texture here, not subject: softened and sunk
              well behind the type so the headline is never competing. */}
          <ParallaxPhoto
            photo={PHOTOS.coupleSession}
            sizes="(min-width: 1024px) 76rem, 100vw"
            tone="forest"
            distance={50}
            className="absolute inset-0 h-full w-full scale-105 blur-[3px]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-forest-950/95 via-forest-950/90 to-forest-900/90"
          />
          <ArcMotif className="-right-24 bottom-0 h-96 w-96 text-forest-300/20" />

          <div className="relative mx-auto max-w-2xl px-8 py-16 sm:px-16 sm:py-24">
            <LeafRule className="mx-auto mb-8 max-w-[10rem] text-forest-300/40 [&>span]:bg-cream-100/20" />
            <h2 className="text-headline text-cream-100 text-balance">
              Take the first step toward feeling whole.
            </h2>
            <p className="mx-auto mt-6 max-w-lg leading-relaxed text-cream-100/70 text-pretty">
              You don’t need the right words, or a plan, or to be at breaking point. You just need an
              hour and somewhere to start.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/book" variant="onDark" size="lg">
                Book an appointment
              </ButtonLink>
              <ButtonLink href="/contact" variant="onDarkGhost" size="lg">
                Talk to us first
              </ButtonLink>
            </div>
            <p className="mt-8 text-sm text-cream-100/50">
              Call or WhatsApp {BUSINESS.phone} · Mon–Fri 08:00–17:00, Sat 08:00–12:00
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
