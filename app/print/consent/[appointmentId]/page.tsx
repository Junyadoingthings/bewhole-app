import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, X } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { PrintButton } from '@/components/portal/print-button';
import { BUSINESS, COUNSELLING_CONSENT, PRACTITIONER } from '@/config/business';
import { requireStaff } from '@/lib/auth';
import { displayTime, formatFullDate, parts } from '@/lib/date';
import { audit, getAppointment, getProfile, hydrateAppointments, listConsents } from '@/lib/db';
import type { Consent } from '@/types';

export const metadata: Metadata = { title: 'Consent record', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** "14 May 1990": a birthday, so no weekday. */
function birthDate(isoDate?: string | null) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Friday, 2 October 2026 at 9:00 AM", in the practice's time zone. */
function when(iso: string) {
  const p = parts(iso);
  return `${formatFullDate(p.date)} at ${displayTime(p.time)}`;
}

/**
 * The informed consent given online for one booking, as a document the
 * practice can print or save as PDF.
 *
 * Consent is recorded at the moment the booking is saved, with the same
 * timestamp as the appointment, so the record is the client's informed
 * consent closest to that moment (within a few minutes). A booking made by
 * staff has none, and the page says so rather than implying a signature.
 *
 * Lives outside /admin so the console's sidebar and menus never reach the
 * page, but is staff-only all the same.
 */
export default async function ConsentRecordPage({ params }: { params: { appointmentId: string } }) {
  const staff = await requireStaff();
  const appointment = await getAppointment(params.appointmentId);
  if (!appointment) notFound();

  const [[view], profile, consents] = await Promise.all([
    hydrateAppointments([appointment]),
    getProfile(appointment.clientUserId),
    listConsents(appointment.clientUserId),
  ]);

  const bookedAt = new Date(appointment.createdAt).getTime();
  const consent: Consent | null =
    consents
      .filter((c) => c.type === 'informed_consent')
      .map((c) => ({ c, gap: Math.abs(new Date(c.grantedAt).getTime() - bookedAt) }))
      .filter(({ gap }) => gap < 5 * 60_000)
      .sort((a, b) => a.gap - b.gap)[0]?.c ?? null;

  // Viewing a client's consent is a look at their record, so it is logged.
  await audit({
    actorUserId: staff.id,
    actorRole: staff.role,
    action: 'consent_record.viewed',
    entity: 'appointment',
    entityId: appointment.id,
    meta: { reference: appointment.reference },
  });

  const clientName = view.client?.name ?? 'Client';
  const agreed = Boolean(consent?.granted);
  const sameWording = !consent || consent.version === COUNSELLING_CONSENT.version;
  const people = view.participants ?? [];
  const where =
    view.mode === 'online'
      ? 'Online session'
      : [view.location?.name, view.location?.addressLine, view.location?.city].filter(Boolean).join(', ');

  return (
    <div className="min-h-dvh bg-canvas-sunk px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] items-center justify-between gap-3">
        <Link
          href={`/admin/clients/${appointment.clientUserId}`}
          className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {clientName}
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-[210mm] rounded-3xl border border-line bg-white p-8 shadow-lifted sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Letterhead. Plain blocks, not <header>: print CSS hides header elements. */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <Logo />
          <div className="text-right text-xs leading-relaxed text-ink-soft">
            <p className="font-medium text-ink">
              {PRACTITIONER.name} ({PRACTITIONER.qualification})
            </p>
            <p>
              {PRACTITIONER.title} ({PRACTITIONER.council}) · {PRACTITIONER.registrationNumber}
            </p>
            <p>Practice No: {PRACTITIONER.practiceNumber}</p>
            <p>
              {BUSINESS.email} · {BUSINESS.phone}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-forest-700">
            Consent record · {view.reference}
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Informed Consent for Counselling</h1>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <Facts
            title="Client"
            rows={[
              ['Name', clientName],
              ['Email', view.client?.email],
              ['Mobile', profile?.phone ?? view.client?.phone],
              ['Address', profile?.address],
              ['Date of birth', birthDate(profile?.medicalAid?.dateOfBirth)],
            ]}
          />
          <Facts
            title="Session"
            rows={[
              ['Reference', view.reference],
              ['Service', view.service.name],
              ['Date and time', when(view.startAt)],
              ['Duration', `${view.durationMinutes} minutes`],
              ['Where', where],
            ]}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Points agreed</h2>
          <ol className="mt-4 space-y-3">
            {COUNSELLING_CONSENT.items.map((item, i) => (
              <li key={item.id} className="flex gap-4 rounded-2xl border border-line p-4 break-inside-avoid">
                <span
                  className={
                    agreed
                      ? 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-forest-700 text-forest-700'
                      : 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line-strong text-ink-faint'
                  }
                  aria-label={agreed ? 'Agreed' : 'Not agreed'}
                >
                  {agreed ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-medium text-ink-faint">{i + 1}</p>
                  <p className="text-sm leading-relaxed text-ink">{item.body}</p>
                  <p className="mt-1 text-xs font-medium text-forest-700">
                    {agreed ? item.agreeLabel : 'Not agreed online'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 rounded-2xl bg-cream-50 p-5 break-inside-avoid print:border print:border-line print:bg-white">
          <h2 className="font-display text-lg text-ink">Agreement</h2>
          {consent ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {agreed ? (
                <>
                  <span className="font-medium text-ink">{clientName}</span> agreed to every point above
                  online, through the {BUSINESS.name} booking form, on{' '}
                  <span className="font-medium text-ink">{when(consent.grantedAt)}</span> (South African
                  time).
                </>
              ) : (
                <>
                  {clientName} did not agree to all of the points above online. Consent should be taken
                  in person before the session.
                </>
              )}{' '}
              Consent form version {consent.version}.
              {!sameWording &&
                ` The wording shown is the current version (${COUNSELLING_CONSENT.version}); it may differ slightly from the version agreed.`}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              No online consent was recorded for this booking — for example, because it was made by the
              practice on the client&rsquo;s behalf. Please take consent in person and sign below.
            </p>
          )}
        </section>

        {people.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="font-display text-lg text-ink">Also attending</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Each person below ticked &ldquo;I have read and agree to the informed consent&rdquo; on the
              booking form.
            </p>
            <table className="mt-4 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink-faint">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Contact</th>
                  <th className="py-2 font-medium">Agreed</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => (
                  <tr key={i} className="border-b border-line-soft align-top">
                    <td className="py-3 pr-4 font-medium text-ink">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="py-3 pr-4 text-ink-muted">
                      {[p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-3 text-ink-muted">{when(p.consentedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="mt-12 grid gap-10 sm:grid-cols-2 print:grid-cols-2 break-inside-avoid">
          <SignatureLine label={`Counsellor — ${PRACTITIONER.name}`} />
          <SignatureLine label="Date" />
        </div>

        <p className="mt-10 border-t border-line pt-4 text-2xs leading-relaxed text-ink-faint">
          Produced from the {BUSINESS.name} practice console on {when(new Date().toISOString())}. Online
          agreement is given by ticking each point on the booking form; no handwritten signature is
          collected online. This record is confidential.
        </p>
      </article>
    </div>
  );
}

function Facts({ title, rows }: { title: string; rows: [string, string | null | undefined][] }) {
  return (
    <div className="rounded-2xl border border-line p-5 break-inside-avoid">
      <h2 className="text-2xs font-medium uppercase tracking-[0.16em] text-ink-faint">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3">
            <dt className="text-ink-faint">{label}</dt>
            <dd className="break-words text-ink">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-ink/40" />
      <p className="mt-2 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
