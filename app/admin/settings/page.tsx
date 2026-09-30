import type { Metadata } from 'next';

import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { Reveal } from '@/components/motion';
import { requireStaff } from '@/lib/auth';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Only the console password, at the practice's request. */
export default async function AdminSettingsPage() {
  await requireStaff();

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 max-w-xl text-ink-soft">Change the password you use to sign in to the console.</p>
      </Reveal>

      <div className="mt-8">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
