import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays, MapPin, ShieldCheck, Video } from 'lucide-react';

import { LogoCompact } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { BUSINESS } from '@/config/business';
import { readLinkToken } from '@/lib/links';
import { displayTime, formatFullDate, parts } from '@/lib/date';
import { getAppointment, getLocation, getService } from '@/lib/db';
import { createCheckoutForAppointment } from '@/services/payment.service';
import { paymentsAreLive } from '@/services/payments';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Pay for your session', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Pay for a session from an email link, without signing in.
 *
 * Reached from the medical-aid decline message. Clients get passwordless
 * accounts at booking, so requiring a login here would strand exactly the
 * person we are asking to pay.
 *
 * The token is the credential: signed, expiring, and scoped to one appointment
 * (see lib/links.ts). It is checked before anything is read from the database,
 * and an appointment that no longer needs paying is reported as such rather
 * than being charged twice.
 *
 * Nothing about the session's clinical content appears on this page — service
 * name, time and venue only — because the link travels through email and may
 * be forwarded or sit in a shared inbox.
 */
export default async function AppointmentPaymentPage({
  params,
}: {
  params: { token: string };
}) {
  const appointmentId = readLinkToken('appointment-payment', params.token);
  if (!appointmentId) return <Notice title="This link is no longer valid" body={EXPIRED} />;

  const appointment = await getAppointment(appointmentId);
  if (!appointment) return <Notice title="This link is no longer valid" body={EXPIRED} />;

  if (appointment.status === 'cancelled') {
    return (
      <Notice
        title="This session was cancelled"
        body="There is nothing to pay. If you would like to book again, we would be glad to see you."
      />
    );
  }

  if (appointment.status !== 'pending_payment' || appointment.amountCents <= 0) {
    return (
      <Notice
        title="This session is already settled"
        body="No payment is outstanding. If you think that is wrong, please reply to the email we sent you and we will check."
      />
    );
  }

  if (!paymentsAreLive()) {
    return (
      <Notice
        title="Card payment is not available online yet"
        body={`Your session is still held. Please contact the practice on ${BUSINESS.phone} and we will arrange payment with you directly.`}
      />
    );
  }

  const [service, location] = await Promise.all([
    getService(appointment.serviceId),
    appointment.locationId ? getLocation(appointment.locationId) : Promise.resolve(null),
  ]);
  const when = parts(appointment.startAt);

  /**
   * The checkout is created on the server and the client is sent straight to
   * the gateway's own page — the card is never typed on this site.
   * createCheckoutForAppointment reuses a live checkout rather than opening a
   * second one, so a refresh cannot produce two ways to pay for one session.
   */
  const checkout = await createCheckoutForAppointment(appointment.id);

  if (checkout.ok) redirect(checkout.redirectUrl);

  return (
    <Shell>
      <h1 className="mt-6 font-display text-2xl text-ink">We could not open the payment page</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Your session is still held — nothing is lost. Please try again in a moment, or contact the
        practice on {BUSINESS.phone} and we will take it from there.
      </p>

      <dl className="mt-6 space-y-2.5 rounded-2xl border border-line bg-cream-50 p-5 text-sm dark:bg-canvas">
        <Row label="Session" value={service?.name ?? 'Counselling session'} />
        <Row
          label="When"
          value={`${formatFullDate(when.date)} at ${displayTime(when.time)}`}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
        />
        <Row
          label="Where"
          value={appointment.mode === 'online' ? 'Online' : (location?.name ?? 'At the practice')}
          icon={
            appointment.mode === 'online' ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )
          }
        />
        <Row label="Amount" value={money(appointment.amountCents)} />
        <Row label="Reference" value={appointment.reference} />
      </dl>

      <ButtonLink href={`/pay/appointment/${params.token}`} className="mt-6" full>
        Try again
      </ButtonLink>
    </Shell>
  );
}

const EXPIRED =
  'Payment links expire after two weeks for your security. Please reply to the email we sent you, or contact the practice, and we will send you a fresh one.';

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="mt-6 font-display text-2xl text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
      <ButtonLink href="/" variant="secondary" className="mt-6" full>
        Go to Be Whole Care
      </ButtonLink>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream-100 px-4 py-12 dark:bg-canvas">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-lifted">
        <LogoCompact />
        {children}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-2xs text-ink-faint">
          <ShieldCheck className="h-3 w-3" />
          Card details are handled by our payment provider, never by this site.
        </p>
      </div>
    </div>
  );
}
