import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight, Clock, MapPin, ShieldCheck, Video } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, HOURS_SUMMARY, LOCATIONS } from '@/config/business';
import { PHOTOS } from '@/config/photos';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Be Whole Care provides confidential, ethical and client-centred counselling in Centurion and Tembisa, online or in person.',
};

/**
 * About.
 *
 * This page used to run 180 lines of narrative — values, philosophy, an
 * approach section. It has been cut to the four things someone actually needs
 * before deciding to book: who they will see, what happens in a session, where
 * we are, and when we are open.
 *
 * Everything stated here is on the practice's own published material. Nothing
 * about qualifications, registrations or clinical approach is asserted, because
 * inventing those on a health page would be dishonest — and dangerous.
 */

const FACTS = [
  { icon: Clock, label: '60 minutes', detail: 'Every session, by appointment.' },
  { icon: Video, label: 'Online or in person', detail: 'Whichever suits you.' },
  { icon: MapPin, label: 'Two practices', detail: 'Centurion and Tembisa.' },
  { icon: ShieldCheck, label: 'Confidential', detail: 'Handled ethically and lawfully.' },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-canvas-sunk">
        <div className="shell grid items-center gap-10 py-14 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-forest-700">
              About us
            </p>
            <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.06] tracking-[-0.02em] text-ink">
              Counselling you can
              <br />
              <span className="text-forest-800">actually get to.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              {BUSINESS.promise}
            </p>
          </div>

          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-[2rem] shadow-lifted">
            <Image
              src={PHOTOS.individualSession.src}
              alt={PHOTOS.individualSession.alt}
              fill
              priority
              quality={86}
              sizes="(min-width: 1024px) 32rem, 92vw"
              style={{ objectPosition: PHOTOS.individualSession.position }}
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="shell py-14 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.label} className="rounded-2xl border border-line bg-card p-6">
              <fact.icon className="h-5 w-5 text-forest-700" />
              <p className="mt-4 font-display text-base font-semibold text-ink">{fact.label}</p>
              <p className="mt-1 text-sm text-ink-muted">{fact.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell pb-16 sm:pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-line bg-canvas-sunk p-7 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-ink">Where to find us</h2>
            <ul className="mt-5 space-y-4">
              {LOCATIONS.map((location) => (
                <li key={location.slug} className="text-sm">
                  <p className="font-medium text-ink">{location.name}</p>
                  <p className="mt-0.5 leading-relaxed text-ink-muted">{location.full}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-line bg-canvas-sunk p-7 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-ink">Opening hours</h2>
            <ul className="mt-5 space-y-2.5">
              {HOURS_SUMMARY.map((row) => (
                <li key={row.label} className="flex justify-between gap-4 text-sm">
                  <span className="text-ink-muted">{row.label}</span>
                  <span className="tabular font-medium text-ink">{row.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-ink-soft">Sessions are by appointment only.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/book" size="lg" className="group">
            Schedule an appointment
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-calm group-hover:translate-x-1" />
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary" size="lg">
            Contact us
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
