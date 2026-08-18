import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  CalendarPlus,
  CreditCard,
  MapPin,
  MessageCircle,
  Phone,
  Video,
} from 'lucide-react';

import { ConfirmationActions } from '@/components/booking/confirmation-actions';
import { Reveal, SuccessMark } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { BUSINESS } from '@/config/business';
import { getCurrentUser } from '@/lib/auth';
import { displayTime, formatFullDate, parts, relativeDay } from '@/lib/date';
import { getAppointmentByReference, hydrateAppointments } from '@/lib/db';
import { money } from '@/lib/utils';
import { verifyAndApplyPayment } from '@/services/payment.service';

export const metadata: Metadata = { title: 'Booking confirmed', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Confirmation screen.
 *
 * Arriving here with ?payment=<id> triggers a server-side verification against
 * the provider before anything is rendered — the redirect itself is never
 * treated as proof that a payment succeeded.
 */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: { ref?: string; payment?: string };
}) {
  const reference = searchParams.ref;
  if (!reference) notFound();

  if (searchParams.payment) {
    await verifyAndApplyPayment(searchParams.payment);
  }

  const appointment = await getAppointmentByReference(reference);
  if (!appointment) notFound();

  // Viewable by the browser that made the booking, or by its owner / staff.
  const user = await getCurrentUser();
  const cookieOwner = cookies().get(`bwc_booking_${reference}`)?.value;
  const permitted =
    cookieOwner === appointment.id ||
    (user && (user.role !== 'CLIENT' || user.id === appointment.clientUserId));
  if (!permitted) notFound();

  const [view] = await hydrateAppointments([appointment]);
  const when = parts(view.startAt);
  const paid = view.payment?.status === 'paid' || view.amountCents === 0;
  const pendingPayment = view.status === 'pending_payment';

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          {pendingPayment ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-state-warningSoft text-state-warning">
              <AlertCircle className="h-9 w-9" />
            </span>
          ) : (
            <SuccessMark />
          )}

          <h1 className="mt-7 font-display text-4xl text-ink text-balance sm:text-5xl">
            {pendingPayment ? 'Almost there' : 'You’re booked.'}
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-ink-soft text-pretty">
            {pendingPayment
              ? 'We’re holding this time for you. Your session is confirmed the moment payment clears.'
              : view.mode === 'online'
                ? 'Your confirmation is on its way, along with your session link.'
                : 'Your confirmation is on its way. We look forward to seeing you.'}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-10 overflow-hidden rounded-4xl border border-line bg-white">
          <div className="border-b border-line bg-cream-50 dark:bg-canvas px-7 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                  Reference
                </p>
                <p className="mt-1 font-display text-xl tabular text-ink">{view.reference}</p>
              </div>
              <Badge tone={paid ? 'success' : 'warning'}>
                {paid ? 'Paid' : view.paymentMethod === 'medical_aid' ? 'Medical aid' : 'Payment pending'}
              </Badge>
            </div>
          </div>

          <dl className="divide-y divide-line-soft px-7">
            <Row label="Service" value={view.service.name} />
            <Row
              label="Date"
              value={
                <>
                  {relativeDay(when.date)}
                  <span className="block text-sm text-ink-soft">{formatFullDate(when.date)}</span>
                </>
              }
            />
            <Row label="Time" value={`${displayTime(when.time)} · ${view.durationMinutes} minutes`} />
            <Row
              label="Where"
              value={
                view.mode === 'online' ? (
                  <span className="flex items-center justify-end gap-2">
                    <Video className="h-4 w-4 text-forest-600 dark:text-forest-300" /> Online session
                  </span>
                ) : (
                  <span className="flex items-start justify-end gap-2 text-right">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600 dark:text-forest-300" />
                    <span>
                      {view.location?.name}
                      <span className="block text-sm text-ink-soft">
                        {view.location?.addressLine}, {view.location?.city}
                      </span>
                    </span>
                  </span>
                )
              }
            />
            {view.practitioner && <Row label="With" value={view.practitioner.displayName} />}
            <Row
              label={view.amountCents > 0 ? 'Amount' : 'Cost'}
              value={view.amountCents > 0 ? money(view.amountCents) : 'No charge'}
            />
          </dl>

          {view.mode === 'online' && (
            <div className="border-t border-line px-7 py-6">
              {view.sessionLink ? (
                <>
                  <p className="text-sm font-medium text-ink">Your session link</p>
                  <p className="mt-1.5 break-all text-sm text-ink-soft">{view.sessionLink}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    It’s also saved on your appointment in the portal, and we’ll send it again before
                    the session.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-ink-soft">
                  Your private session link will appear here and in your portal once the booking is
                  confirmed. We also send it with your reminder.
                </p>
              )}
            </div>
          )}
        </div>
      </Reveal>

      {pendingPayment && (
        <Reveal delay={0.1}>
          <div className="mt-5 rounded-3xl border border-state-warning/25 bg-state-warningSoft p-6">
            <p className="flex items-center gap-2 font-medium text-ink">
              <CreditCard className="h-4.5 w-4.5 text-state-warning" />
              Payment outstanding — {money(view.amountCents)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              This time is held for you but is not confirmed until payment clears. You can complete
              it from your appointment page whenever you’re ready.
            </p>
            <ButtonLink href={`/portal/appointments/${view.id}`} size="sm" className="mt-4">
              Complete payment
            </ButtonLink>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.12}>
        <ConfirmationActions
          appointment={{
            id: view.id,
            title: `${view.service.name} — Be Whole Care`,
            start: view.startAt,
            end: view.endAt,
            location:
              view.mode === 'online'
                ? (view.sessionLink ?? 'Online session')
                : `${view.location?.addressLine}, ${view.location?.city}, ${view.location?.postalCode}`,
            details: `Reference ${view.reference}. ${view.durationMinutes}-minute session with Be Whole Care.${
              view.sessionLink ? ` Link: ${view.sessionLink}` : ''
            }`,
            reference: view.reference,
          }}
        />
      </Reveal>

      <Reveal delay={0.14}>
        <div className="mt-10 rounded-3xl border border-line bg-cream-50 dark:bg-canvas p-7">
          <h2 className="font-display text-lg text-ink">What happens next</h2>
          <ol className="mt-5 space-y-4">
            {[
              {
                icon: CalendarPlus,
                text: 'Your confirmation email arrives now, and your session goes onto our practice calendar.',
              },
              {
                icon: MessageCircle,
                text: 'We send a reminder 24 hours before, and again a couple of hours before your session.',
              },
              {
                icon: Phone,
                text: `Need to change something? Manage it from your portal, or call or WhatsApp ${BUSINESS.phone}. Please give us at least 24 hours' notice.`,
              },
            ].map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-forest-700 dark:text-forest-300 shadow-subtle">
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="pt-1.5 text-sm leading-relaxed text-ink-muted">{item.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/portal/appointments" size="sm">
              View my appointments
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">
              Back to Be Whole Care
            </ButtonLink>
          </div>

          {!user && (
            <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-soft">
              We’ve created an account for {view.client?.email}.{' '}
              <Link href="/forgot-password" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
                Set a password
              </Link>{' '}
              to manage this appointment, see your session link and book again in one tap.
            </p>
          )}
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
