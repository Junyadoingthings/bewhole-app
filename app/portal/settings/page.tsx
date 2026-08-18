import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, Download, Lock, Trash2 } from 'lucide-react';

import { ChangePasswordForm } from '@/components/auth/forms';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { BUSINESS } from '@/config/business';
import { requireUser } from '@/lib/auth';
import { getProfile, getSettings } from '@/lib/db';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PortalSettingsPage() {
  const user = await requireUser();
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings()]);

  return (
    <div className="mx-auto max-w-2xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Security, reminders and what happens to your information.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <Lock className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
            Password
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Changing your password signs you out on every other device.
          </p>
          <div className="mt-6">
            <ChangePasswordForm />
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <section className="mt-6 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <Bell className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
            Reminders
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            We send these automatically so a session never quietly slips past you.
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-muted">Booking confirmation</span>
              <Badge tone="success" size="sm">
                Immediately
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-muted">First reminder</span>
              <Badge tone="neutral" size="sm">
                {settings.reminders.firstReminderHours} hours before
              </Badge>
            </li>
            {settings.reminders.secondReminderHours && (
              <li className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Second reminder</span>
                <Badge tone="neutral" size="sm">
                  {settings.reminders.secondReminderHours} hours before
                </Badge>
              </li>
            )}
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-muted">Sent by</span>
              <span className="capitalize text-ink">
                {profile?.preferredContact ?? 'email'} & email
              </span>
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-ink-faint">
            Change your preferred channel on your{' '}
            <Link href="/portal/profile" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
              profile
            </Link>
            .
          </p>
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section className="mt-6 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <Download className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
            Your information
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Under POPIA you may ask what we hold about you, request a copy, have it corrected, or
            ask us to delete what we no longer need to keep.
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <a
              href={`mailto:${BUSINESS.email}?subject=Request%20a%20copy%20of%20my%20information`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4 transition-colors hover:border-forest-300"
            >
              <span className="text-ink">Request a copy of my information</span>
              <span className="text-ink-faint">Email us</span>
            </a>
            <a
              href={`mailto:${BUSINESS.email}?subject=Delete%20my%20information`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4 transition-colors hover:border-state-danger/40"
            >
              <span className="flex items-center gap-2 text-ink">
                <Trash2 className="h-4 w-4 text-state-danger" />
                Ask us to delete my information
              </span>
              <span className="text-ink-faint">Email us</span>
            </a>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Some records must be kept for a period after your last session to meet professional and
            legal obligations. We’ll tell you which, and for how long. Read the{' '}
            <Link href="/privacy" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
              privacy notice
            </Link>
            .
          </p>
        </section>
      </Reveal>
    </div>
  );
}
