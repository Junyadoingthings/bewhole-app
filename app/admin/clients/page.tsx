import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Users } from 'lucide-react';

import { Reveal } from '@/components/motion';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { formatShortDate, parts, relativeDay } from '@/lib/date';
import { listAppointments, listClients } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { initials, money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Clients', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminClientsPage() {
  await requireStaff();
  // Never let the page hang. Empty results render as the "no clients yet"
  // state, which is honest and refreshable, not a blank screen.
  const clients = await withTimeout(listClients(), [], 9000);
  const appointments = await withTimeout(listAppointments(), [], 9000);
  const now = new Date().toISOString();

  const rows = clients
    .map((c) => {
      const theirs = appointments.filter((a) => a.clientUserId === c.user.id);
      const next = theirs
        .filter((a) => a.startAt >= now && ['confirmed', 'pending_payment'].includes(a.status))
        .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
      const completed = theirs.filter((a) => a.status === 'completed');
      return {
        ...c,
        sessions: completed.length,
        next,
        lifetimeCents: completed.reduce((s, a) => s + a.amountCents, 0),
        lastSeen: completed.sort((a, b) => b.startAt.localeCompare(a.startAt))[0],
      };
    })
    .sort((a, b) => {
      if (a.next && !b.next) return -1;
      if (!a.next && b.next) return 1;
      return a.profile.firstName.localeCompare(b.profile.firstName);
    });

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Clients</h1>
        <p className="mt-2 text-ink-soft">
          {rows.length} {rows.length === 1 ? 'person' : 'people'} · press ⌘K to search
        </p>
      </Reveal>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No clients yet"
            description="Client records are created automatically when someone books."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <Link
                key={row.user.id}
                href={`/admin/clients/${row.user.id}`}
                className="group rounded-3xl border border-line bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-forest-200 hover:shadow-card"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream-100">
                    {initials(row.profile.firstName, row.profile.lastName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {row.profile.firstName} {row.profile.lastName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">{row.user.email}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {row.next ? (
                    <Badge tone="success" size="sm">
                      Next {relativeDay(parts(row.next.startAt).date).toLowerCase()}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      No booking
                    </Badge>
                  )}
                  {row.profile.medicalAid && (
                    <Badge tone="info" size="sm">
                      Medical aid
                    </Badge>
                  )}
                  {row.user.isDemo && (
                    <Badge tone="outline" size="sm">
                      Demo
                    </Badge>
                  )}
                </div>

                <dl className="mt-5 flex justify-between border-t border-line pt-4 text-xs">
                  <div>
                    <dt className="text-ink-faint">Sessions</dt>
                    <dd className="mt-0.5 tabular text-ink">{row.sessions}</dd>
                  </div>
                  <div className="text-center">
                    <dt className="text-ink-faint">Last seen</dt>
                    <dd className="mt-0.5 text-ink">
                      {row.lastSeen ? formatShortDate(parts(row.lastSeen.startAt).date) : '—'}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-ink-faint">Billed</dt>
                    <dd className="mt-0.5 tabular text-ink">{money(row.lifetimeCents)}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
