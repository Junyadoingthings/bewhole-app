import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { OutlookCard } from '@/components/admin/outlook-card';
import { getOutlookConnection } from '@/lib/db';
import { timeAgo } from '@/lib/date';
import { outlookConfigured } from '@/services/outlook/graph';
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
const NOTICES: Record<string, string> = {
  connected: 'Outlook is connected. Your upcoming sessions are being added to it now.',
  cancelled: 'Connecting Outlook was cancelled — nothing was changed.',
  expired: 'That sign-in took too long or was opened in another browser. Please try again.',
  denied: 'Only the practice administrator can connect Outlook.',
  failed: 'Outlook could not be connected. Please try again.',
  not_configured: 'Outlook is not set up on the website yet.',
};

export default async function AdminSettingsPage({ searchParams }: { searchParams: { outlook?: string } }) {
  const user = await requireStaff();
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/admin');
  const outlook = await getOutlookConnection();

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Settings</h1>
        <p className="mt-2 max-w-xl text-ink-soft">Your Outlook calendar and your console password.</p>
      </Reveal>

      <div className="mt-8">
        <OutlookCard
          status={{
            configured: outlookConfigured(),
            connected: Boolean(outlook),
            accountEmail: outlook?.accountEmail,
            lastSyncedLabel: outlook?.lastSyncedAt ? timeAgo(outlook.lastSyncedAt) : null,
            lastSyncError: outlook?.lastSyncError ?? null,
            issues: (outlook?.issues ?? []).slice(0, 6).map((i) => ({ at: i.at, message: i.message })),
            notice: searchParams.outlook ? (NOTICES[searchParams.outlook] ?? null) : null,
          }}
        />
      </div>

      <div className="mt-8">
        <ChangePasswordForm maskedEmail={maskEmail(user.email)} />
      </div>
    </div>
  );
}
