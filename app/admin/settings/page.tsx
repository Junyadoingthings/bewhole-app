import type { Metadata } from 'next';

import { SettingsForm } from '@/components/admin/settings-form';
import { Reveal } from '@/components/motion';
import { requireStaff } from '@/lib/auth';
import { getSettings, listAvailabilityRules } from '@/lib/db';
import { activeChannels } from '@/services/notifications';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const user = await requireStaff();
  const canEdit = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const [settings, rules] = await Promise.all([getSettings(), listAvailabilityRules()]);
  const emailLive = activeChannels().some((c) => c.channel === 'email' && c.live);

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Your opening hours, booking rules and the emails clients receive. Changes apply as soon
          as you save.
          {!canEdit && ' You need administrator access to change these.'}
        </p>
      </Reveal>

      <div className="mt-8">
        <SettingsForm settings={settings} rules={rules} canEdit={canEdit} emailLive={emailLive} />
      </div>
    </div>
  );
}
