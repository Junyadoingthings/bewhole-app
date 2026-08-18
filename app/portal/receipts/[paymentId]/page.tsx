import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

import { LeafMark } from '@/components/brand/logo';
import { PrintButton } from '@/components/portal/print-button';
import { requireUser } from '@/lib/auth';
import { displayTime, formatFullDate, parts } from '@/lib/date';
import {
  getAppointment,
  getPayment,
  getProfile,
  getService,
  getSettings,
  findUserById,
  getLocation,
} from '@/lib/db';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Receipt', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Payment receipt.
 *
 * Built for one specific job: South African clients claiming a counselling
 * session back from their medical aid, who need a document showing who was
 * seen, what for, when, what it cost and that it was paid.
 *
 * It prints to a clean A4 page straight from the browser, which is why there
 * is no PDF library here — the browser already makes a better PDF than a
 * server-side renderer would, and it keeps the dependency out of the bundle.
 *
 * It deliberately carries no diagnosis or clinical detail. Schemes that
 * require a diagnostic code get it from the practitioner directly, not from
 * an automated receipt.
 */
export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
  const user = await requireUser();
  const payment = await getPayment(params.paymentId);

  // Ownership, not obscurity: a receipt is only ever yours.
  if (!payment || payment.clientUserId !== user.id) notFound();
  if (payment.status !== 'paid') notFound();

  const [appointment, profile, account, settings] = await Promise.all([
    payment.appointmentId ? getAppointment(payment.appointmentId) : Promise.resolve(null),
    getProfile(user.id),
    findUserById(user.id),
    getSettings(),
  ]);

  const [service, location] = await Promise.all([
    appointment ? getService(appointment.serviceId) : Promise.resolve(null),
    appointment?.locationId ? getLocation(appointment.locationId) : Promise.resolve(null),
  ]);

  const paidOn = parts(payment.paidAt ?? payment.createdAt);
  const sessionOn = appointment ? parts(appointment.startAt) : null;
  const receiptNumber = `BWC-R-${payment.id.slice(-8).toUpperCase()}`;
  const banking = settings.banking;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/portal/payments"
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Payments
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl border border-line bg-white p-8 print:rounded-none print:border-0 print:p-0 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-8">
          <div className="flex items-start gap-3">
            <LeafMark className="h-10 w-10 text-forest-700 dark:text-forest-300" />
            <div>
              <p className="font-display text-lg font-semibold text-clay-600">be whole.</p>
              <p className="text-xs uppercase tracking-[0.22em] text-forest-700 dark:text-forest-300">Care</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {settings.business.email}
                <br />
                {settings.business.phone}
                <br />
                {settings.business.website}
              </p>
            </div>
          </div>

          <div className="text-right">
            <h1 className="font-display text-2xl text-ink">Receipt</h1>
            <p className="mt-1 text-sm tabular text-ink-soft">{receiptNumber}</p>
            <p className="mt-3 text-sm text-ink-soft">
              Issued {formatFullDate(paidOn.date)}
            </p>
          </div>
        </header>

        <section className="grid gap-8 border-b border-line py-8 sm:grid-cols-2">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Received from
            </p>
            <p className="mt-2 font-medium text-ink">
              {profile?.firstName} {profile?.lastName}
            </p>
            <p className="text-sm text-ink-soft">{account?.email}</p>
            {profile?.phone && <p className="text-sm text-ink-soft">{profile.phone}</p>}
          </div>

          {profile?.medicalAid && (
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                Medical aid
              </p>
              <p className="mt-2 font-medium text-ink">{profile.medicalAid.scheme}</p>
              <p className="text-sm tabular text-ink-soft">
                Member {profile.medicalAid.memberNumber}
              </p>
              <p className="text-sm text-ink-soft">Main member: {profile.medicalAid.mainMember}</p>
            </div>
          )}
        </section>

        <section className="py-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="pb-3 font-medium text-ink-faint">Description</th>
                <th className="pb-3 text-right font-medium text-ink-faint">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line-soft">
                <td className="py-4">
                  <p className="font-medium text-ink">
                    {service?.name ?? 'Counselling session'}
                  </p>
                  {sessionOn && (
                    <p className="mt-1 text-ink-soft">
                      {formatFullDate(sessionOn.date)} at {displayTime(sessionOn.time)} ·{' '}
                      {appointment?.durationMinutes} minutes ·{' '}
                      {appointment?.mode === 'online'
                        ? 'Online session'
                        : `In person, ${location?.name ?? 'practice'}`}
                    </p>
                  )}
                  {appointment && (
                    <p className="mt-1 text-xs tabular text-ink-faint">
                      Booking reference {appointment.reference}
                    </p>
                  )}
                </td>
                <td className="py-4 text-right tabular text-ink">{money(payment.amountCents)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-5 text-right font-medium text-ink">Total paid</td>
                <td className="pt-5 text-right font-display text-xl tabular text-ink">
                  {money(payment.amountCents)}
                </td>
              </tr>
            </tfoot>
          </table>

          <dl className="mt-8 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-line-soft py-2">
              <dt className="text-ink-faint">Paid on</dt>
              <dd className="text-ink">
                {formatFullDate(paidOn.date)}, {displayTime(paidOn.time)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line-soft py-2">
              <dt className="text-ink-faint">Method</dt>
              <dd className="text-ink">
                {payment.method === 'card' ? 'Card / wallet' : 'Medical aid'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line-soft py-2">
              <dt className="text-ink-faint">Status</dt>
              <dd className="font-medium text-forest-700 dark:text-forest-300">Paid in full</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line-soft py-2">
              <dt className="text-ink-faint">Reference</dt>
              <dd className="tabular text-ink">{receiptNumber}</dd>
            </div>
          </dl>
        </section>

        {banking?.showOnInvoices && banking.accountNumber && (
          <section className="border-t border-line py-6">
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Banking details
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {banking.accountName} · {banking.bank}
              <br />
              Account {banking.accountNumber}
              {banking.branchCode ? ` · Branch ${banking.branchCode}` : ''}
            </p>
          </section>
        )}

        <footer className="border-t border-line pt-6 text-xs leading-relaxed text-ink-faint">
          <p>
            This receipt confirms payment for the counselling session described above. It contains
            no clinical or diagnostic information. If your medical aid requires a diagnostic code or
            a practice number, please contact Be Whole Care directly on {settings.business.phone}.
          </p>
          <p className="mt-2">
            {settings.business.name} · {settings.business.website}
          </p>
        </footer>
      </article>

      <p className="no-print mt-6 flex items-center gap-2 text-sm text-ink-soft">
        <Printer className="h-4 w-4 text-forest-600 dark:text-forest-300" />
        Use your browser&rsquo;s print dialog and choose &ldquo;Save as PDF&rdquo; to keep a copy.
      </p>
    </div>
  );
}
