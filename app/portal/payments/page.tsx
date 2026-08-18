import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, ShieldCheck } from 'lucide-react';

import { Reveal } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { formatFullDate, parts } from '@/lib/date';
import { hydrateAppointments, listAppointments, listPayments } from '@/lib/db';
import { money } from '@/lib/utils';
import type { PaymentStatus } from '@/types';

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

export default async function PaymentsPage() {
  const user = await requireUser();
  const [payments, appointments] = await Promise.all([
    listPayments({ clientUserId: user.id }),
    listAppointments({ clientUserId: user.id }),
  ]);
  const views = await hydrateAppointments(appointments);

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountCents, 0);
  const outstanding = payments.filter((p) => p.status === 'pending' || p.status === 'processing');

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Payments</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-soft">
          Every payment against your sessions. We never see or store your card details — payments
          are handled entirely on our provider’s secure checkout.
        </p>
      </Reveal>

      {payments.length > 0 && (
        <Reveal delay={0.05}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-white p-6">
              <p className="text-xs uppercase tracking-[0.1em] text-ink-faint">Paid to date</p>
              <p className="mt-2 font-display text-3xl tabular text-ink">{money(totalPaid)}</p>
            </div>
            <div className="rounded-3xl border border-line bg-white p-6">
              <p className="text-xs uppercase tracking-[0.1em] text-ink-faint">Outstanding</p>
              <p className="mt-2 font-display text-3xl tabular text-ink">
                {money(outstanding.reduce((s, p) => s + p.amountCents, 0))}
              </p>
            </div>
          </div>
        </Reveal>
      )}

      <div className="mt-8 space-y-3">
        {payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Nothing here yet"
            description="Payments appear once you book a session."
            action={
              <ButtonLink href="/book" size="sm">
                Book a session
              </ButtonLink>
            }
          />
        ) : (
          payments.map((payment) => {
            const appointment = views.find((a) => a.id === payment.appointmentId);
            return (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {appointment?.service.name ?? 'Follow-up session'}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {formatFullDate(parts(payment.createdAt).date)} ·{' '}
                    {payment.method === 'card' ? 'Card' : 'Medical aid'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display text-xl tabular text-ink">
                    {money(payment.amountCents)}
                  </span>
                  <Badge tone={TONES[payment.status]} size="sm">
                    {payment.status}
                  </Badge>
                  {payment.status === 'paid' && (
                    <Link
                      href={`/portal/receipts/${payment.id}`}
                      className="text-sm font-medium text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline"
                    >
                      Receipt
                    </Link>
                  )}
                  {appointment && (
                    <Link
                      href={`/portal/appointments/${appointment.id}`}
                      className="text-sm text-ink-soft underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-8 flex items-start gap-2.5 rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-6 text-sm leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-forest-700 dark:text-forest-300" />
          Card details are entered on our payment provider’s own secure page and never reach Be
          Whole Care. We keep only the amount, the date and a reference. Every paid session has a
          receipt you can download for your medical aid.
        </p>
      </Reveal>
    </div>
  );
}
