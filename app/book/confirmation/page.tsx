import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  AlertCircle,
  CreditCard,
  MapPin,
  Video,
} from 'lucide-react';

import { ConfirmationActions } from '@/components/booking/confirmation-actions';
import { Reveal, SuccessMark } from '@/components/motion';
import { ButtonLink } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';
import { displayTime, formatFullDate, parts, relativeDay } from '@/lib/date';
import { getAppointmentByReference, hydrateAppointments } from '@/lib/db';
import { addressVisibleFor, joinLinkFor } from '@/lib/session-link';
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
  const pendingPayment = view.status === 'pending_payment';
  /**
   * Held, not confirmed: the practice checks the scheme first. This page used
   * to say "You're booked" here while the email that arrived a minute later
   * said the opposite — the email is right, so the page now agrees with it.
   */
  const pendingMedicalAid = view.status === 'pending_medical_aid';
  const joinLink = joinLinkFor(view);
  const addressConfirmed = addressVisibleFor(view);

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
            {pendingPayment
              ? 'Almost there'
              : // Every booking that is not waiting on a payment is provisional
                // until the counsellor has been in touch (the practice's wording, 2026-10).
                'Provisional Confirmation'}
          </h1>
          {pendingMedicalAid ? (
            // The practice's own wording (2026-09).
            <div className="mt-4 max-w-md space-y-3 leading-relaxed text-ink-soft text-pretty">
              <p>
                Your appointment has been provisionally confirmed, pending verification of your
                medical aid benefits.
              </p>
              <p>
                Once your medical aid has been verified, you will receive a confirmation email with
                the outcome of verification and the next steps.
              </p>
              <p>
                Please note that your appointment will only be fully confirmed once your medical aid
                benefits have been successfully verified. Should your medical aid not cover the
                consultation, you will be contacted regarding the available payment options.
              </p>
              <p>Thank you for your understanding.</p>
            </div>
          ) : (
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft text-pretty">
              {pendingPayment
                ? 'We’re holding this time for you. Your session is confirmed the moment payment clears.'
                : 'Please note that our Counsellor will get in touch with you shortly, to confirm the details of your booking.'}
            </p>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-10 overflow-hidden rounded-4xl border border-line bg-white">
          <div className="border-b border-line bg-cream-50 dark:bg-canvas px-7 py-6">
            {/* The Paid / Medical aid / Payment pending badge was removed at the practice's request (2026-10). */}
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">Reference</p>
            <p className="mt-1 font-display text-xl tabular text-ink">{view.reference}</p>
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
                      {view.location?.name} Practice
                      <span className="block text-sm text-ink-soft">
                        {addressConfirmed
                          ? `${view.location?.addressLine}, ${view.location?.city}`
                          : 'Address shared once your booking is confirmed'}
                      </span>
                    </span>
                  </span>
                )
              }
            />
            {view.practitioner && <Row label="With" value={view.practitioner.displayName} />}
            {view.participants && view.participants.length > 0 && (
              <Row
                label="Also attending"
                value={
                  <>
                    {view.participants.map((p, i) => (
                      <span key={i} className="block">
                        {p.firstName} {p.lastName}
                      </span>
                    ))}
                  </>
                }
              />
            )}
            <Row
              label={view.amountCents > 0 ? 'Amount' : 'Cost'}
              value={view.amountCents > 0 ? money(view.amountCents) : 'No charge'}
            />
          </dl>

          {view.mode === 'online' && (
            <div className="border-t border-line px-7 py-6">
              {joinLink ? (
                <>
                  <p className="text-sm font-medium text-ink">Your session link</p>
                  <a
                    href={joinLink}
                    className="mt-1.5 block break-all text-sm font-medium text-forest-700 underline underline-offset-4 dark:text-forest-300"
                  >
                    {joinLink}
                  </a>
                  <p className="mt-2 text-xs text-ink-faint">
                    It’s also in your confirmation email and on your appointment in the portal, and
                    we’ll send it again with your reminders.
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
                ? (joinLink ?? 'Online session')
                : addressConfirmed
                  ? `${view.location?.addressLine}, ${view.location?.city}, ${view.location?.postalCode}`
                  : `Be Whole Care — ${view.location?.name} Practice`,
            details: `Reference ${view.reference}. ${view.durationMinutes}-minute session with Be Whole Care.${
              joinLink ? ` Link: ${joinLink}` : ''
            }`,
            reference: view.reference,
          }}
        />
      </Reveal>

      {/* "What happens next" and its two buttons were removed at the practice's request (2026-10). */}
      {!user && (
        <Reveal delay={0.14}>
          <p className="mt-10 rounded-3xl border border-line bg-cream-50 p-6 text-sm leading-relaxed text-ink-soft dark:bg-canvas">
            We’ve created an account for {view.client?.email}.{' '}
            <Link href="/forgot-password" className="text-forest-700 dark:text-forest-300 underline-offset-4 hover:underline">
              Set a password
            </Link>{' '}
            to manage this appointment, see your session link and book again in one tap.
          </p>
        </Reveal>
      )}
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
