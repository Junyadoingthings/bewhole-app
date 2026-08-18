import type { Metadata } from 'next';
import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { ArcMotif } from '@/components/site/decor';
import { ContactForm } from '@/components/site/contact-form';
import { Photo, PhotoReveal, PhotoScrim } from '@/components/site/photo';
import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS, CRISIS_SUPPORT, HOURS_SUMMARY, LOCATIONS } from '@/config/business';
import { PHOTOS } from '@/config/photos';
import { formatPhone } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Call or WhatsApp ${BUSINESS.phone}, email ${BUSINESS.email}, or send a message. Practices in Centurion and Tembisa.`,
};

export default function ContactPage({
  searchParams,
}: {
  searchParams: { topic?: string };
}) {
  const defaultTopic =
    searchParams.topic === 'workshop' ? 'Workshops & wellness programs' : undefined;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-leaf-fade" />
        <ArcMotif className="-left-32 -top-24 h-[30rem] w-[30rem] text-forest-300/25" />
        <div className="shell relative py-16 sm:py-20">
          <Reveal>
            <p className="eyebrow">Contact</p>
            <h1 className="mt-6 max-w-2xl text-headline text-ink text-balance">
              Talk to us before you book, if that’s easier.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
              Call, WhatsApp, email or send a message below. Someone replies during business hours —
              and you never have to explain the whole thing up front.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="shell pb-section">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
          <Reveal>
            <div className="space-y-4">
              <a
                href={`tel:${BUSINESS.phone}`}
                className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <Phone className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm text-ink-faint">Call us</span>
                  <span className="block font-display text-xl tabular text-ink">
                    {formatPhone(BUSINESS.phone)}
                  </span>
                </span>
              </a>

              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm text-ink-faint">WhatsApp</span>
                  <span className="block font-display text-xl tabular text-ink">
                    {formatPhone(BUSINESS.phone)}
                  </span>
                </span>
              </a>

              <a
                href={`mailto:${BUSINESS.email}`}
                className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-ink-faint">Email</span>
                  <span className="block truncate font-display text-lg text-ink">
                    {BUSINESS.email}
                  </span>
                </span>
              </a>

              <a
                href={BUSINESS.instagram}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-200 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300">
                  <Instagram className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm text-ink-faint">Instagram</span>
                  <span className="block font-display text-lg text-ink">@_bewhole</span>
                </span>
              </a>

              <div className="rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
                  <p className="font-medium text-ink">Business hours</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {HOURS_SUMMARY.map((row) => (
                    <li key={row.label} className="flex justify-between gap-4">
                      <span className="text-ink-soft">{row.label}</span>
                      <span className="tabular text-ink">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-line bg-white p-6">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
                  <p className="font-medium text-ink">Our practices</p>
                </div>
                <ul className="mt-4 space-y-4 text-sm">
                  {LOCATIONS.map((location) => (
                    <li key={location.slug}>
                      <p className="font-medium text-ink">{location.name}</p>
                      <p className="mt-1 leading-relaxed text-ink-soft">
                        {location.addressLine}, {location.city}, {location.postalCode}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-state-warning/25 bg-state-warningSoft p-6">
                <p className="text-sm font-medium text-ink">If this is an emergency</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{CRISIS_SUPPORT.note}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {CRISIS_SUPPORT.contacts.map((contact) => (
                    <li key={contact.value} className="flex justify-between gap-3">
                      <span className="text-ink-soft">{contact.label}</span>
                      <a href={contact.href} className="tabular font-medium text-ink underline">
                        {contact.value}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            {/* A face before a form — this page is often someone's first move. */}
            <PhotoReveal className="mb-5">
              <Photo
                photo={PHOTOS.individualSession}
                sizes="(min-width: 1024px) 38rem, 92vw"
                className="aspect-[16/9] w-full rounded-4xl shadow-card"
              >
                <PhotoScrim className="from-forest-950/80 via-transparent" />
                <p className="absolute inset-x-0 bottom-0 p-6 font-display text-xl text-cream-100 text-balance sm:text-2xl">
                  You don’t have to explain the whole thing up front.
                </p>
              </Photo>
            </PhotoReveal>

            <ContactForm defaultTopic={defaultTopic} />
            <div className="mt-5 rounded-3xl border border-line bg-cream-50 dark:bg-canvas p-6">
              <p className="text-sm leading-relaxed text-ink-soft">
                Ready to book instead? You don’t need to message first — the booking page shows real
                availability and takes about two minutes.
              </p>
              <ButtonLink href="/book" variant="secondary" size="sm" className="mt-4">
                Book an appointment
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
