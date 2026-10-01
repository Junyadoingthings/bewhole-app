import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { Reveal } from '@/components/motion';
import { requireStaff } from '@/lib/auth';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** "bewholecare@gmail.com" → "be•••••••e@gmail.com": enough to recognise, not to copy. */
function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain || local.length < 3) return email;
  return `${local.slice(0, 2)}${'•'.repeat(Math.min(local.length - 3, 8))}${local.slice(-1)}@${domain}`;
}

/** Only the console password, and only for the practice administrator. */
export default async function AdminSettingsPage() {
  const user = await requireStaff();
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/admin');

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 max-w-xl text-ink-soft">Change the password you use to sign in to the console.</p>
      </Reveal>

      <div className="mt-8">
        <ChangePasswordForm maskedEmail={maskEmail(user.email)} />
      </div>
    </div>
  );
}
