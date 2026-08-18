import type { Metadata } from 'next';
import { ShieldCheck, UserCog } from 'lucide-react';

import { Reveal } from '@/components/motion';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth';
import { formatFullDate, parts, timeAgo } from '@/lib/date';
import { listAuditLogs, listStaff } from '@/lib/db';
import { initials } from '@/lib/utils';
import type { Role } from '@/types';

export const metadata: Metadata = { title: 'Staff', robots: { index: false } };
export const dynamic = 'force-dynamic';

const ROLE_DESCRIPTION: Record<Role, string> = {
  CLIENT: 'Can only see their own appointments and payments.',
  STAFF: 'Runs sessions: appointments, clients, follow-ups and notes.',
  ADMIN: 'Everything a staff member can do, plus pricing, refunds and settings.',
  SUPER_ADMIN: 'Full access, including staff roles.',
};

export default async function AdminStaffPage() {
  await requireAdmin();
  const [staff, audit] = await Promise.all([listStaff(), listAuditLogs({ limit: 40 })]);

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Staff & access</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Who can see what. Access is role-based and enforced on the server for every request — not
          just hidden in the interface.
        </p>
      </Reveal>

      <section className="mt-8 space-y-3">
        {staff.length === 0 ? (
          <EmptyState icon={<UserCog className="h-6 w-6" />} title="No staff accounts yet" />
        ) : (
          staff.map(({ user, profile }) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-5"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream-100">
                  {initials(profile?.firstName, profile?.lastName)}
                </span>
                <div>
                  <p className="font-medium text-ink">
                    {profile ? `${profile.firstName} ${profile.lastName}` : user.email}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">{user.email}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {user.lastLoginAt ? `Last signed in ${timeAgo(user.lastLoginAt)}` : 'Never signed in'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user.isDemo && (
                  <Badge tone="outline" size="sm">
                    Demo
                  </Badge>
                )}
                <Badge tone="forest" size="sm">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">What each role can do</h2>
        <div className="mt-4 space-y-2">
          {(['STAFF', 'ADMIN', 'SUPER_ADMIN'] as Role[]).map((role) => (
            <div
              key={role}
              className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5"
            >
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-forest-700 dark:text-forest-300" />
              <div>
                <p className="text-sm font-medium text-ink">{role.replace('_', ' ')}</p>
                <p className="mt-1 text-sm text-ink-soft">{ROLE_DESCRIPTION[role]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Recent activity</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Every action on a client record is written to an append-only audit log.
        </p>
        <div className="mt-4 max-h-96 overflow-y-auto rounded-3xl border border-line bg-white">
          <ul className="divide-y divide-line-soft">
            {audit.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {entry.action.replace(/[._]/g, ' ')}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {entry.entity}
                    {entry.actorRole ? ` · ${entry.actorRole.toLowerCase()}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {formatFullDate(parts(entry.createdAt).date).split(',')[1]?.trim()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
