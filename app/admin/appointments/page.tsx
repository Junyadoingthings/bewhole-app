import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, MapPin, Video } from 'lucide-react';

import { AppointmentRowActions } from '@/components/admin/appointment-row-actions';
import { MedicalAidActions } from '@/components/admin/medical-aid-actions';
import { STATUS_META } from '@/components/portal/appointment-card';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { displayTime, formatDayShort, parts, today } from '@/lib/date';
import { getProfile, hydrateAppointments, listAppointments } from '@/lib/db';
import { withTimeout } from '@/lib/db/with-timeout';
import { cn, money } from '@/lib/utils';
import type { AppointmentStatus, AppointmentView } from '@/types';

export const metadata: Metadata = { title: 'Appointments', robots: { index: false } };
export const dynamic = 'force-dynamic';

const FILTERS: { key: string; label: string; statuses?: AppointmentStatus[] }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'pending', label: 'Awaiting payment', statuses: ['pending_payment'] },
  { key: 'medical_aid', label: 'Medical aid to verify', statuses: ['pending_medical_aid'] },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled & missed', statuses: ['cancelled', 'no_show'] },
  { key: 'all', label: 'All' },
];

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: { filter?: string; ref?: string };
}) {
  await requireStaff();
  // Neither load may hang the page — after 9 seconds we render whatever we
  // have, which is preferable to a permanently blank page. Empty arrays mean
  // the page's normal "no appointments" state shows.
  const all = await withTimeout(listAppointments(), [], 9000);
  const views = await withTimeout<AppointmentView[]>(hydrateAppointments(all), [], 9000);

  const now = new Date().toISOString();
  const filter = searchParams.filter ?? (searchParams.ref ? 'all' : 'upcoming');

  /**
   * Medical aid details, fetched only for the sessions actually awaiting a
   * decision.
   *
   * Two reasons not to hydrate these onto every row: a scheme and member
   * number are sensitive and should not be shipped to the browser for
   * appointments nobody is verifying, and this page can list hundreds of rows
   * — a profile lookup each would be the slowest thing on it.
   */
  const awaitingAid = views.filter((a) => a.status === 'pending_medical_aid');
  const aidProfiles = new Map(
    (
      await withTimeout(
        Promise.all(
          awaitingAid.map(async (a) => [a.clientUserId, await getProfile(a.clientUserId)] as const),
        ),
        [],
        6000,
      )
    ).map(([id, profile]) => [id, profile?.medicalAid ?? null]),
  );

  /** The private fee this session would cost if the scheme declines it. */
  const privateFee = (a: AppointmentView) =>
    a.mode === 'online' ? a.service.priceOnlineCents : a.service.priceInPersonCents;

  let rows = views;
  if (searchParams.ref) {
    rows = views.filter((a) => a.reference === searchParams.ref);
  } else if (filter === 'upcoming') {
    rows = views
      .filter(
        (a) =>
          a.startAt >= now &&
          ['confirmed', 'pending_payment', 'pending_medical_aid'].includes(a.status),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  } else if (filter === 'today') {
    rows = views
      .filter((a) => parts(a.startAt).date === today())
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  } else if (filter === 'past') {
    rows = views
      .filter((a) => a.startAt < now)
      .sort((a, b) => b.startAt.localeCompare(a.startAt));
  } else {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
    rows = views
      .filter((a) => (statuses ? statuses.includes(a.status) : true))
      .sort((a, b) => b.startAt.localeCompare(a.startAt));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h1 className="font-display text-3xl text-ink">Appointments</h1>
        <p className="mt-2 text-ink-soft">
          {rows.length} {rows.length === 1 ? 'session' : 'sessions'}
          {searchParams.ref ? ` matching ${searchParams.ref}` : ''}
        </p>
      </Reveal>

      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/appointments?filter=${f.key}`}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-200',
              filter === f.key && !searchParams.ref
                ? 'border-forest-800 bg-forest-800 text-cream-100'
                : 'border-line bg-white text-ink-soft hover:border-forest-300 hover:text-ink',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title="Nothing here"
            description="Try a different filter — or the calendar view for a wider look."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-3xl border border-line bg-white lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-4 font-medium text-ink-faint">When</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Client</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Service</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Where</th>
                    <th className="px-5 py-4 text-right font-medium text-ink-faint">Amount</th>
                    <th className="px-5 py-4 font-medium text-ink-faint">Status</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const when = parts(a.startAt);
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-line-soft transition-colors last:border-0 hover:bg-cream-50 dark:hover:bg-canvas"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="block text-ink">{formatDayShort(when.date)}</span>
                          <span className="block text-xs tabular text-ink-faint">
                            {displayTime(when.time)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/admin/clients/${a.clientUserId}`}
                            className="text-ink hover:text-forest-700 dark:hover:text-forest-300"
                          >
                            {a.client?.name ?? '—'}
                          </Link>
                          <span className="block text-xs text-ink-faint">{a.reference}</span>
                          {a.status === 'pending_medical_aid' && (
                            <MedicalAidActions
                              appointmentId={a.id}
                              clientName={a.client?.name ?? 'This client'}
                              scheme={aidProfiles.get(a.clientUserId)?.scheme}
                              memberNumber={aidProfiles.get(a.clientUserId)?.memberNumber}
                              mainMember={aidProfiles.get(a.clientUserId)?.mainMember}
                              coPaymentCents={a.amountCents}
                              privateFeeCents={privateFee(a)}
                            />
                          )}
                        </td>
                        <td className="px-5 py-4 text-ink-muted">{a.service?.name ?? 'Session'}</td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-ink-muted">
                            {a.mode === 'online' ? (
                              <>
                                <Video className="h-3.5 w-3.5" /> Online
                              </>
                            ) : (
                              <>
                                <MapPin className="h-3.5 w-3.5" /> {a.location?.name}
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right tabular text-ink">
                          {a.amountCents > 0 ? money(a.amountCents) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={STATUS_META[a.status].tone} size="sm">
                            {STATUS_META[a.status].label}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <AppointmentRowActions
                            appointmentId={a.id}
                            clientUserId={a.clientUserId}
                            status={a.status}
                            mode={a.mode}
                            sessionLink={a.sessionLink ?? null}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 lg:hidden">
              {rows.map((a) => {
                const when = parts(a.startAt);
                return (
                  <div key={a.id} className="rounded-3xl border border-line bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{a.client?.name ?? '—'}</p>
                        <p className="mt-1 text-sm text-ink-soft">{a.service?.name ?? 'Session'}</p>
                        {a.status === 'pending_medical_aid' && (
                          <MedicalAidActions
                            appointmentId={a.id}
                            clientName={a.client?.name ?? 'This client'}
                            scheme={aidProfiles.get(a.clientUserId)?.scheme}
                            memberNumber={aidProfiles.get(a.clientUserId)?.memberNumber}
                            mainMember={aidProfiles.get(a.clientUserId)?.mainMember}
                            coPaymentCents={a.amountCents}
                            privateFeeCents={privateFee(a)}
                          />
                        )}
                      </div>
                      <AppointmentRowActions
                        appointmentId={a.id}
                        clientUserId={a.clientUserId}
                        status={a.status}
                        mode={a.mode}
                        sessionLink={a.sessionLink ?? null}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-faint">
                      <span className="tabular">
                        {formatDayShort(when.date)} · {displayTime(when.time)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {a.mode === 'online' ? (
                          <>
                            <Video className="h-3 w-3" /> Online
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3 w-3" /> {a.location?.name}
                          </>
                        )}
                      </span>
                      {a.amountCents > 0 && <span className="tabular">{money(a.amountCents)}</span>}
                      <Badge tone={STATUS_META[a.status].tone} size="sm">
                        {STATUS_META[a.status].label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}