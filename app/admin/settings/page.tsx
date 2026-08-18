import type { Metadata } from 'next';

import { SettingsForm } from '@/components/admin/settings-form';
import { Reveal } from '@/components/motion';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/db';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const user = await requireStaff();
  const canEdit = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          The business rules the app runs on. Everything here is configurable —
          nothing that belongs to the practice is hardcoded.
          {!canEdit && ' You need administrator access to change these.'}
        </p>
      </Reveal>

      <div className="mt-8">
        <SettingsForm settings={settings} canEdit={canEdit} />
      </div>
    </div>
  );
}
