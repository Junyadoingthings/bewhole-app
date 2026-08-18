import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';

import { LogoCompact } from '@/components/brand/logo';
import { getAppointment, getPayment, getProfile, findUserById, getService } from '@/lib/db';
import { buildPayfastForm, getPaymentProvider } from '@/services/payments';
import { money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Redirecting to payment', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Payfast hand-off.
 *
 * Payfast has no "create checkout" API — you post a signed form to them. This
 * page builds that form server-side (so the merchant key and passphrase never
 * reach the browser) and submits it immediately.
 *
 * There is a real submit button underneath for anyone with JavaScript off, and
 * because the auto-submit occasionally loses a race with slow connections.
 */
export default async function PayfastRedirectPage({
  params,
}: {
  params: { reference: string };
}) {
  const provider = getPaymentProvider();
  if (provider.name !== 'payfast') notFound();

  const payment = await getPayment(params.reference);
  if (!payment || payment.status !== 'pending') notFound();

  const [appointment, client, profile] = await Promise.all([
    payment.appointmentId ? getAppointment(payment.appointmentId) : Promise.resolve(null),
    findUserById(payment.clientUserId),
    getProfile(payment.clientUserId),
  ]);
  const service = appointment ? await getService(appointment.serviceId) : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:5600';

  const { action, fields } = buildPayfastForm({
    amountCents: payment.amountCents,
    reference: payment.id,
    description: appointment
      ? `${service?.name ?? 'Session'} — ${appointment.reference}`
      : 'Be Whole Care session',
    successUrl: appointment
      ? `${appUrl}/book/confirmation?ref=${appointment.reference}&payment=${payment.id}`
      : `${appUrl}/portal/follow-ups?payment=${payment.id}`,
    cancelUrl: appointment
      ? `${appUrl}/portal/appointments/${appointment.id}?payment=cancelled`
      : `${appUrl}/portal/follow-ups?payment=cancelled`,
    webhookUrl: `${appUrl}/api/payments/webhook`,
    customerEmail: client?.email ?? null,
    customerFirstName: profile?.firstName ?? null,
    customerLastName: profile?.lastName ?? null,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-cream-100 dark:bg-card">
      <header className="border-b border-line bg-white">
        <div className="shell flex h-16 items-center justify-between">
          <LogoCompact />
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <Lock className="h-3.5 w-3.5 text-forest-600 dark:text-forest-300" />
            Secure payment
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="rounded-4xl border border-line bg-white p-8 shadow-card">
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Taking you to Payfast
            </p>
            <p className="mt-3 font-display text-4xl tabular text-ink">
              {money(payment.amountCents)}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              You’ll choose how to pay — card, Apple Pay, Instant EFT and more — on Payfast’s secure
              page.
            </p>

            <form id="payfast" action={action} method="post" className="mt-7">
              {fields.map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button
                type="submit"
                className="flex h-13 w-full items-center justify-center rounded-full bg-forest-800 px-6 text-[0.95rem] font-medium text-cream-100 transition-colors hover:bg-forest-900"
              >
                Continue to Payfast
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs text-ink-faint">
            Be Whole Care never sees your card details.
          </p>
        </div>
      </main>

      {/* Auto-submit, with the button above as the fallback. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('payfast').submit();`,
        }}
      />
    </div>
  );
}
