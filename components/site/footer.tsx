import Link from 'next/link';
import { Instagram, Mail, MapPin, Phone } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { BUSINESS, CRISIS_SUPPORT, HOURS_SUMMARY, LOCATIONS } from '@/config/business';
import { cn } from '@/lib/utils';

/**
 * The footer used to list every individual service. That is gone on purpose:
 * a directory of clinical services repeated at the bottom of every page reads
 * as marketing, and the same list is one tap away under Services. What belongs
 * here is the practical information someone scrolls to the bottom looking for
 * — where we are, when we are open, how to reach us, and the terms.
 */
const COLUMNS = [
  {
    title: 'Practice',
    links: [
      { href: '/services', label: 'Services' },
      { href: '/about', label: 'About Be Whole Care' },
      { href: '/contact', label: 'Contact' },
      { href: '/book', label: 'Book an appointment' },
    ],
  },
  {
    title: 'Account & policies',
    links: [
      { href: '/sign-in', label: 'Sign in' },
      { href: '/portal', label: 'Client portal' },
      { href: '/terms', label: 'Terms & conditions' },
      { href: '/privacy', label: 'Privacy & POPIA' },
    ],
  },
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'site-footer relative mt-section overflow-hidden bg-forest-900 text-cream-100',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-forest-800/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-forest-700/25 blur-3xl" />

      <div className="shell relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo variant="light" />
            <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-cream-200 text-balance">
              {BUSINESS.mission}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream-100/65">
              {BUSINESS.promise}
            </p>

            <div className="mt-8 space-y-3 text-sm">
              <a
                href={`tel:${BUSINESS.phone}`}
                className="flex items-center gap-3 text-cream-100/80 transition-colors hover:text-cream-100"
              >
                <Phone className="h-4 w-4 shrink-0 text-forest-300" />
                {BUSINESS.phone} <span className="text-cream-100/40">· Call or WhatsApp</span>
              </a>
              <a
                href={`mailto:${BUSINESS.email}`}
                className="flex items-center gap-3 text-cream-100/80 transition-colors hover:text-cream-100"
              >
                <Mail className="h-4 w-4 shrink-0 text-forest-300" />
                {BUSINESS.email}
              </a>
              <a
                href={BUSINESS.instagram}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 text-cream-100/80 transition-colors hover:text-cream-100"
              >
                <Instagram className="h-4 w-4 shrink-0 text-forest-300" />
                @_bewhole
              </a>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-300">
                  {column.title}
                </p>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-cream-100/70 transition-colors hover:text-cream-100"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 border-t border-cream-100/10 pt-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-300">
              Where to find us
            </p>
            <ul className="mt-4 space-y-3">
              {LOCATIONS.map((location) => (
                <li key={location.slug} className="flex gap-3 text-sm text-cream-100/70">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-300" />
                  <span>
                    <span className="block text-cream-100">{location.name}</span>
                    {location.addressLine}, {location.city}, {location.postalCode}
                  </span>
                </li>
              ))}
            </ul>

            {/*
              A small map, sunk into the footer rather than sitting on it.
              `loading="lazy"` keeps an iframe and a third-party request off the
              critical path — nobody lands on this page for the map, they scroll
              to it. The overlay tints Google's white tiles toward the footer's
              green so it reads as part of the panel; pointer-events-none so it
              never blocks a pinch or a drag on the map itself.
            */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${LOCATIONS[0].full}, South Africa`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative mt-5 block overflow-hidden rounded-2xl border border-cream-100/10"
              aria-label={`Open ${LOCATIONS[0].name} in Google Maps`}
            >
              <iframe
                title={`Map showing ${LOCATIONS[0].name}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${LOCATIONS[0].full}, South Africa`,
                )}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-40 w-full border-0 grayscale-[0.35]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-forest-950/25 transition-colors duration-300 group-hover:bg-forest-950/10"
              />
            </a>
          </div>

          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-300">Hours</p>
            <ul className="mt-4 space-y-2 text-sm">
              {HOURS_SUMMARY.map((row) => (
                <li key={row.label} className="flex justify-between gap-4 text-cream-100/70">
                  <span>{row.label}</span>
                  <span className="tabular text-cream-100">{row.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-cream-100/45">Sessions are by appointment only.</p>
          </div>

          {/* Crisis routing sits in the footer of every page, not buried. */}
          <div className="rounded-2xl border border-cream-100/10 bg-forest-950/40 p-5">
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-300">
              In an emergency
            </p>
            <p className="mt-3 text-sm leading-relaxed text-cream-100/70">{CRISIS_SUPPORT.note}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {CRISIS_SUPPORT.contacts.slice(0, 3).map((contact) => (
                <li key={contact.value} className="flex justify-between gap-3">
                  <span className="text-cream-100/60">{contact.label}</span>
                  <a href={contact.href} className="tabular text-cream-100 hover:underline">
                    {contact.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-cream-100/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg text-cream-200">{BUSINESS.tagline}</p>
          <p className="text-xs text-cream-100/45">
            © {new Date().getFullYear()} {BUSINESS.legalName}. {BUSINESS.website}
          </p>
        </div>
      </div>
    </footer>
  );
}
