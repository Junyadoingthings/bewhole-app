import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Phone, ShieldCheck, Video } from 'lucide-react';

import { AppointmentActions } from '@/components/portal/appointment-actions';
import { ConfirmationActions } from '@/components/booking/confirmation-actions';
import { STATUS_META } from '@/components/portal/appointment-card';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/primitives';
import { BUSINESS } from '@/config/business';
import { requireUser } from '@/lib/auth';
import { displayTime, formatFullDate, parts, relativeDay } from '@/lib/date';
import { getAppointment, hydrateAppointments, listPaymentEvents } from '@/lib/db';
import { money } from '@/lib/utils';
import { checkCancellationPolicy } from '@/services/booking.service';

export const metadata: Metadata = { title: 'Appointment', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { payment?: string };
}) {
  const user = await requireUser();
  const appointment = await getAppointment(params.id);

  // Ownership is enforced here, not by the URL being hard to guess.
  if (!appointment || appointment.clientUserId !== user.id) notFound();

  const [view] = await hydrateAppointments([appointment]);
  const policy = await checkCancellationPolicy(appointment.id);
  const events = view.payment ? await listPaymentEvents(view.payment.id) : [];

  const when = parts(view.startAt);
  const status = STATUS_META[view.status];
  const isOver = view.startAt < new Date().toISOString();
  const canModify = !isOver && ['confirmed', 'pending_payment'].includes(view.status);
  const needsPayment = view.status === 'pending_payment' && view.amountCents > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/portal/appointments"
        className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Appointments
      </Link>

      {searchParams.payment === 'failed' && (
        <div className="mt-6 rounded-3xl border border-state-danger/25 bg-state-dangerSoft p-6">
          <p className="font-medium text-ink">Your payment didn’t go through.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Nothing was charged and your time is still held. You can try again below.
          </p>
        </div>
      )}
      {searchParams.payment === 'cancelled' && (
        <div className="mt-6 rounded-3xl border border-line bg-cream-100 dark:bg-card p-6">
          <p className="font-medium text-ink">Payment cancelled.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Your time is still held — you can complete payment whenever you’re ready.
          </p>
        </div>
      )}

      <Reveal className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-sm tabular text-ink-faint">{view.reference}</span>
        </div>

        <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl text-balance">
          {view.service.name}
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          {relativeDay(when.date)} · {displayTime(when.time)}
        </p>

        <div className="mt-8">
          <AppointmentActions
            appointmentId={view.id}
            serviceId={view.serviceId}
            mode={view.mode}
            locationId={view.locationId ?? null}
            amountCents={view.amountCents}
            needsPayment={needsPayment}
            canModify={canModify}
            policy={policy}
          />
        </div>
      </Reveal>

      {view.mode === 'online' && view.sessionLink && view.status === 'confirmed' && (
        <Reveal delay={0.05}>
          <div className="mt-8 rounded-3xl bg-forest-900 p-6 text-cream-100 sm:p-8">
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-forest-300">
              Your session link
            </p>
            <a
              href={view.sessionLink}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex h-13 items-center gap-2 rounded-full bg-cream-100 dark:bg-card px-6 text-[0.95rem] font-medium text-forest-900 dark:text-forest-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
            >
              <Video className="h-4 w-4" />
              Join session
            </a>
            <p className="mt-4 break-all text-sm text-cream-100/55">{view.sessionLink}</p>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.08}>
        <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
          <dl className="divide-y divide-line-soft px-6">
            <Row label="Date" value={formatFullDate(when.date)} />
            <Row
              label="Time"
              value={
                <span className="flex items-center justify-end gap-2">
                  <Clock className="h-4 w-4 text-forest-600 dark:text-forest-300" />
                  {displayTime(when.time)} · {view.durationMinutes} minutes
                </span>
              }
            />
            <Row
              label="Where"
              value={
                view.mode === 'online' ? (
                  <span className="flex items-center justify-end gap-2">
                    <Video className="h-4 w-4 text-forest-600 dark:text-forest-300" /> Online
                  </span>
                ) : (
                  <span className="flex items-start justify-end gap-2 text-right">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
                    <span>
                      {view.location?.name}
                      <span className="block text-sm font-normal text-ink-soft">
                        {view.location?.addressLine}, {view.location?.city},{' '}
                        {view.location?.postalCode}
                      </span>
                    </span>
                  </span>
                )
              }
            />
            {view.practitioner && <Row label="With" value={view.practitioner.displayName} />}
            <Row
              label="Payment"
              value={
                view.amountCents === 0
                  ? 'No charge'
                  : `${money(view.amountCents)} · ${view.paymentMethod === 'card' ? 'Card' : 'Medical aid'}`
              }
            />
            {view.payment && (
              <Row
                label="Payment status"
                value={
                  <Badge
                    tone={
                      view.payment.status === 'paid'
                        ? 'success'
                        : view.payment.status === 'failed'
                          ? 'danger'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {view.payment.status}
                  </Badge>
                }
              />
            )}
            {view.reason && <Row label="What you told us" value={view.reason} />}
          </dl>
        </div>
      </Reveal>

      {view.status !== 'cancelled' && (
        <Reveal delay={0.1}>
          <ConfirmationActions
            appointment={{
              id: view.id,
              title: `${view.service.name} — Be Whole Care`,
              start: view.startAt,
              end: view.endAt,
              location:
                view.mode === 'online'
                  ? (view.sessionLink ?? 'Online session')
                  : `${view.location?.addressLine}, ${view.location?.city}`,
              details: `Reference ${view.reference}.`,
              reference: view.reference,
            }}
          />
        </Reveal>
      )}

      {events.length > 0 && (
        <Reveal delay={0.12}>
          <div className="mt-8 rounded-3xl border border-line bg-white p-6">
            <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Payment history
            </h2>
            <ol className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
                  <span className="text-ink-muted">
                    {readableEvent(event.type)}
                    <span className="ml-2 text-xs text-ink-faint">
                      {formatFullDate(parts(event.createdAt).date)} ·{' '}
                      {displayTime(parts(event.createdAt).time)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.14}>
        <div className="mt-8 rounded-3xl border border-line bg-cream-100/70 dark:bg-card/70 p-6">
          <p className="flex items-center gap-2 font-medium text-ink">
            <ShieldCheck className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
            Our cancellation policy
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Cancellations must be made at least 24 hours before the scheduled session. Late
            cancellations or missed appointments may be charged in full. Exceptions may be
            considered in cases of genuine emergency.
          </p>
          <a
            href={`tel:${BUSINESS.phone}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300"
          >
            <Phone className="h-3.5 w-3.5" />
            Call the practice on {BUSINESS.phone}
          </a>
        </div>
      </Reveal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <dt className="shrink-0 text-sm text-ink-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function readableEvent(type: string) {
  const map: Record<string, string> = {
    'checkout.created': 'Secure checkout opened',
    'checkout.failed': 'Could not open checkout',
    'verify.paid': 'Payment received and verified',
    'verify.failed': 'Payment declined',
    'verify.cancelled': 'Payment cancelled',
    'verify.processing': 'Payment processing',
    'verify.amount_mismatch': 'Amount mismatch — flagged for review',
    'refund.success': 'Refunded',
    'manual.marked_paid': 'Marked as received by the practice',
  };
  return map[type] ?? type.replace(/[._]/g, ' ');
}
