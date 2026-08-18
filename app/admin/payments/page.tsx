import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';

import { PaymentActions } from '@/components/admin/payment-actions';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState, StatTile } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { addISODays, formatDayShort, parts, today } from '@/lib/date';
import { getSettings, hydrateAppointments, listAppointments, listClients, listPayments } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { money } from '@/lib/utils';
import type { AppointmentView, PaymentStatus } from '@/types';

export const metadata: Metadata = { title: 'Payments', robots: { index: false } };
export const dynamic = 'force-dynamic';

const TONES: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  paid: 'success',
  pending: 'warning',
  processing: 'info',
  failed: 'danger',
  refunded: 'neutral',
  cancelled: 'neutral',
};

export default async function AdminPaymentsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  // Same pattern as the other admin pages — capped so the page cannot hang.
  // Falls back to empty state instead of a permanently blank screen.
  const payments = await withTimeout(listPayments(), [], 9000);
  const appointments = await withTimeout(listAppointments(), [], 9000);
  const clients = await withTimeout(listClients(), [], 9000);
  const settings = await getSettings();
  const views = await withTimeout<AppointmentView[]>(hydrateAppointments(appointments), [], 9000);

  const nameOf = (userId: string) => {
    const c = clients.find((x) => x.user.id === userId);
    return c ? `${c.profile.firstName} ${c.profile.lastName}` : '—';
  };

  const monthStart = addISODays(today(), -30);
  const paid30 = payments
    .filter((p) => p.status === 'paid' && p.paidAt && parts(p.paidAt).date >= monthStart)
    .reduce((s, p) => s + p.amountCents, 0);
  const outstanding = payments.filter((p) => p.status === 'pending' || p.status === 'processing');
  const failed = payments.filter((p) => p.status === 'failed');

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Payments</h1>
            <p className="mt-2 text-ink-soft">
              Provider: <span className="capitalize text-ink">{settings.payments.provider}</span>
              {settings.payments.provider === 'mock' && ' — no live credentials configured'}
            </p>
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Received · 30 days" value={money(paid30)} />
        <StatTile
          label="Outstanding"
          value={money(outstanding.reduce((s, p) => s + p.amountCents, 0))}
          hint={`${outstanding.length} awaiting`}
          tone={outstanding.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Failed"
          value={failed.length}
          hint="Needs a retry or a call"
          tone={failed.length > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-8">
        {payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="No payments yet"
            description="Payments appear as soon as clients start booking."
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-4 font-medium text-ink-faint">Date</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Client</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">For</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Method</th>
                    <th className="px-5 py-4 text-right font-medium text-ink-faint">Amount</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Status</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const appointment = views.find((a) => a.id === p.appointmentId);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-line-soft transition-colors last:border-0 hover:bg-cream-50 dark:hover:bg-canvas"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                          {formatDayShort(parts(p.createdAt).date)}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/admin/clients/${p.clientUserId}`}
                            className="text-ink hover:text-forest-700 dark:hover:text-forest-300"
                          >
                            {nameOf(p.clientUserId)}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-ink-muted">
                          {appointment?.service.name ?? (p.followUpId ? 'Follow-up' : '—')}
                        </td>
                        <td className="px-5 py-4 capitalize text-ink-muted">
                          {p.method === 'card' ? 'Card' : 'Medical aid'}
                        </td>
                        <td className="px-5 py-4 text-right tabular text-ink">
                          {money(p.amountCents)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={TONES[p.status]} size="sm">
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <PaymentActions paymentId={p.id} status={p.status} isAdmin={isAdmin} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        Card details are never stored by Be Whole Care. Every status shown here comes from a
        server-side verification against the payment provider, never from a browser redirect.
      </p>
    </div>
  );
}
