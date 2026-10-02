import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';

import { PaymentActions } from '@/components/admin/payment-actions';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState, StatTile } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { addISODays, formatDayShort, parts, today } from '@/lib/date';
import { hydrateAppointments, listAppointments, listClients, listPayments } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { money } from '@/lib/utils';
import type { AppointmentView, Payment } from '@/types';

export const metadata: Metadata = { title: 'Payments', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Who the money comes from, in words. */
function sourceOf(p: Payment) {
  if (p.method === 'medical_aid') return 'Medical aid claim';
  if (p.provider === 'manual') return 'Client · paid to practice';
  return 'Client · card online';
}

/** The status in words, for this kind of line. */
function statusOf(p: Payment): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' } {
  switch (p.status) {
    case 'paid':
      return { label: `Received ${p.paidAt ? formatDayShort(parts(p.paidAt).date) : ''}`.trim(), tone: 'success' };
    case 'pending':
      return { label: p.method === 'medical_aid' ? 'Awaiting scheme' : 'Awaiting payment', tone: 'warning' };
    case 'processing':
      return { label: 'Processing', tone: 'info' };
    case 'failed':
      return { label: 'Not paid', tone: 'danger' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' };
    default:
      return { label: 'Cancelled', tone: 'neutral' };
  }
}

/**
 * Every amount owed to or received by the practice: card checkouts, medical
 * aid claims, Yoco and EFT payments, and anything recorded by hand. Medical
 * aid claims are ticked off with the amount the scheme actually paid.
 */
export default async function AdminPaymentsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  // Same pattern as the other admin pages — capped so the page cannot hang.
  // Falls back to empty state instead of a permanently blank screen.
  const payments = await withTimeout(listPayments(), [], 9000);
  const appointments = await withTimeout(listAppointments(), [], 9000);
  const clients = await withTimeout(listClients(), [], 9000);
  const views = await withTimeout<AppointmentView[]>(hydrateAppointments(appointments), [], 9000);

  const nameOf = (userId: string) => {
    const c = clients.find((x) => x.user.id === userId);
    return c ? `${c.profile.firstName} ${c.profile.lastName}` : '—';
  };

  const since = addISODays(today(), -30);
  const received30 = payments.filter((p) => p.status === 'paid' && p.paidAt && parts(p.paidAt).date >= since);
  const sum = (list: Payment[]) => list.reduce((s, p) => s + p.amountCents, 0);
  const awaiting = payments.filter((p) => p.status === 'pending' || p.status === 'processing');
  const claimsAwaiting = awaiting.filter((p) => p.method === 'medical_aid');
  const clientsOwe = awaiting.filter((p) => p.method !== 'medical_aid');
  const notPaid = payments.filter((p) => p.status === 'failed');

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Payments</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Every amount owed to or received by the practice — card payments, medical aid claims,
          Yoco and EFT payments. Tick each one off with the amount that actually arrived.
        </p>
      </Reveal>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Received · 30 days"
          value={money(sum(received30))}
          hint={`${received30.length} payment${received30.length === 1 ? '' : 's'}, medical aid included`}
          tone="positive"
        />
        <StatTile
          label="Medical aid · awaiting"
          value={money(sum(claimsAwaiting))}
          hint={`${claimsAwaiting.length} claim${claimsAwaiting.length === 1 ? '' : 's'} not yet paid`}
          tone={claimsAwaiting.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Clients · awaiting"
          value={money(sum(clientsOwe))}
          hint={`${clientsOwe.length} payment${clientsOwe.length === 1 ? '' : 's'} outstanding`}
          tone={clientsOwe.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Not paid"
          value={notPaid.length}
          hint="Declined claims or unpaid sessions"
          tone={notPaid.length > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-8">
        {payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="No payments yet"
            description="Card payments, medical aid claims and payments to the practice appear here as clients book."
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-4 font-medium text-ink-faint">Date</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Client</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">For</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Paid by</th>
                    <th className="px-5 py-4 text-right font-medium text-ink-faint">Amount</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Status</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const appointment = views.find((a) => a.id === p.appointmentId);
                    const status = statusOf(p);
                    const name = nameOf(p.clientUserId);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-line-soft align-top transition-colors last:border-0 hover:bg-cream-50 dark:hover:bg-canvas"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                          {formatDayShort(parts(p.createdAt).date)}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/admin/clients/${p.clientUserId}`}
                            className="text-ink hover:text-forest-700 dark:hover:text-forest-300"
                          >
                            {name}
                          </Link>
                          {appointment && (
                            <span className="block text-xs text-ink-faint">{appointment.reference}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-ink-muted">
                          {appointment?.service.name ?? (p.followUpId ? 'Follow-up' : '—')}
                          {appointment && (
                            <span className="block text-xs text-ink-faint">
                              Session {formatDayShort(parts(appointment.startAt).date)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-ink-muted">{sourceOf(p)}</td>
                        <td className="px-5 py-4 text-right tabular text-ink">
                          {money(p.amountCents)}
                          {p.status !== 'paid' && p.method === 'medical_aid' && (
                            <span className="block text-xs text-ink-faint">expected</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={status.tone} size="sm">
                            {status.label}
                          </Badge>
                          {p.status === 'failed' && p.failureReason && (
                            <span className="mt-1 block max-w-[14rem] text-xs text-ink-faint">{p.failureReason}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <PaymentActions
                            paymentId={p.id}
                            status={p.status}
                            isAdmin={isAdmin}
                            method={p.method}
                            provider={p.provider}
                            amountCents={p.amountCents}
                            clientName={name}
                          />
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
        Card details are never stored by Be Whole Care. Card payments made online are confirmed by the
        payment provider; everything else is ticked off here when the money arrives. To record money
        taken directly for a session (EFT, cash, a quoted fee), use &ldquo;Record a payment&rdquo; on the
        appointment.
      </p>
    </div>
  );
}
