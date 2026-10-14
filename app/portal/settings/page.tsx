import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, Lock } from 'lucide-react';

import { ChangePasswordForm } from '@/components/auth/forms';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
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
            {/* Reminders go out at 06:00; the settings only switch them on or off. */}
            {Boolean(settings.reminders.firstReminderHours) && (
              <li className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">First reminder</span>
                <Badge tone="neutral" size="sm">
                  The morning before
                </Badge>
              </li>
            )}
            {Boolean(settings.reminders.secondReminderHours) && (
              <li className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Second reminder</span>
                <Badge tone="neutral" size="sm">
                  The morning of your session
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

    </div>
  );
}
