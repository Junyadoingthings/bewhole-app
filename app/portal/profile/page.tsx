import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, LogOut, ShieldCheck } from 'lucide-react';

import { ProfileForm } from '@/components/portal/profile-form';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { logout } from '@/app/actions/auth';
import { requireUser } from '@/lib/auth';
import { formatFullDate, parts } from '@/lib/date';
import { getProfile, listConsents } from '@/lib/db';

export const metadata: Metadata = { title: 'Profile', robots: { index: false } };
export const dynamic = 'force-dynamic';

const MOBILE_LINKS = [
  { href: '/portal/follow-ups', label: 'Follow-ups' },
  { href: '/portal/payments', label: 'Payments' },
  { href: '/portal/settings', label: 'Settings' },
];

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, consents] = await Promise.all([getProfile(user.id), listConsents(user.id)]);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Your details</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          We keep only what a booking needs. You can change any of this at any time.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-8">
        <ProfileForm profile={profile} email={user.email} />
      </Reveal>

      {/* These live in the sidebar on desktop, so surface them here on mobile. */}
      <div className="mt-6 space-y-2 lg:hidden">
        {MOBILE_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 text-sm font-medium text-ink"
          >
            {link.label}
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        ))}
      </div>

      {profile.medicalAid && (
        <Reveal delay={0.08}>
          <div className="mt-6 rounded-3xl border border-line bg-white p-6">
            <h2 className="font-display text-lg text-ink">Medical aid on file</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Scheme</dt>
                <dd className="text-ink">{profile.medicalAid.scheme}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Membership number</dt>
                <dd className="tabular text-ink">{profile.medicalAid.memberNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-faint">Main member</dt>
                <dd className="text-ink">{profile.medicalAid.mainMember}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Held only to submit claims. Acceptance of these details does not guarantee payment by
              your scheme.
            </p>
          </div>
        </Reveal>
      )}

      {consents.length > 0 && (
        <Reveal delay={0.1}>
          <div className="mt-6 rounded-3xl border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 font-display text-lg text-ink">
              <ShieldCheck className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
              Your consents
            </h2>
            <ul className="mt-4 space-y-3">
              {consents.slice(-4).map((consent) => (
                <li key={consent.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="capitalize text-ink-muted">
                    {consent.type.replace(/_/g, ' ')}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-ink-faint">
                      {formatFullDate(parts(consent.grantedAt).date)}
                    </span>
                    <Badge tone={consent.granted ? 'success' : 'neutral'} size="sm">
                      {consent.granted ? 'Given' : 'Withdrawn'}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      <form action={logout} className="mt-6 lg:hidden">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3.5 text-sm font-medium text-ink-muted"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
