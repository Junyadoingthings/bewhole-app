import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Phone, ShieldCheck, Video } from 'lucide-react';

import { ClientTabs } from '@/components/admin/client-tabs';
import { FollowUpComposer } from '@/components/admin/follow-up-composer';
import { NoteComposer } from '@/components/admin/note-composer';
import { STATUS_META } from '@/components/portal/appointment-card';
import { Reveal } from '@/components/motion';
import { Badge, EmptyState, StatTile } from '@/components/ui/primitives';
import { requireStaff } from '@/lib/auth';
import { displayTime, formatFullDate, parts, timeAgo } from '@/lib/date';
import {
  findUserById,
  getProfile,
  hydrateAppointments,
  hydrateFollowUps,
  listAppointments,
  listAuditLogs,
  listClientNotes,
  listClients,
  listConsents,
  listFollowUps,
  listLocations,
  listNotificationLogsForUser,
  listPayments,
  listServices,
} from '@/lib/db';
import { initials, money } from '@/lib/utils';

export const metadata: Metadata = { title: 'Client', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminClientPage({ params }: { params: { id: string } }) {
  await requireStaff();

  const [user, profile] = await Promise.all([findUserById(params.id), getProfile(params.id)]);
  if (!user || !profile || user.role !== 'CLIENT') notFound();

  const [appointments, followUps, payments, notes, consents, comms, services, locations, clients] =
    await Promise.all([
      listAppointments({ clientUserId: params.id }),
      listFollowUps({ clientUserId: params.id }),
      listPayments({ clientUserId: params.id }),
      listClientNotes(params.id),
      listConsents(params.id),
      listNotificationLogsForUser(user.email),
      listServices(),
      listLocations(),
      listClients(),
    ]);

  const views = (await hydrateAppointments(appointments)).sort((a, b) =>
    b.startAt.localeCompare(a.startAt),
  );
  const followUpViews = await hydrateFollowUps(followUps);
  const audit = await listAuditLogs({ limit: 400 });

  const completed = views.filter((a) => a.status === 'completed');
  const lifetime = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountCents, 0);
  const outstanding = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((s, p) => s + p.amountCents, 0);

  const timeline = buildTimeline({ views, payments, followUps, notes, comms });

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Link>

      <Reveal className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forest-800 text-lg font-medium text-cream-100">
              {initials(profile.firstName, profile.lastName)}
            </span>
            <div>
              <h1 className="font-display text-3xl text-ink">
                {profile.firstName} {profile.lastName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 hover:text-ink">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </a>
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 hover:text-ink">
                    <Phone className="h-3.5 w-3.5" />
                    {profile.phone}
                  </a>
                )}
                <span className="text-ink-faint">
                  Client since {formatFullDate(parts(user.createdAt).date)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.medicalAid && <Badge tone="info" size="sm">Medical aid on file</Badge>}
                <Badge tone="outline" size="sm">
                  Prefers {profile.preferredContact}
                </Badge>
                {user.isDemo && <Badge tone="outline" size="sm">Demo record</Badge>}
              </div>
            </div>
          </div>

          <FollowUpComposer
            services={services}
            locations={locations}
            clients={clients.map((c) => ({
              id: c.user.id,
              name: `${c.profile.firstName} ${c.profile.lastName}`,
            }))}
            defaultClientUserId={params.id}
            triggerLabel="Follow-up"
          />
        </div>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <StatTile label="Sessions" value={completed.length} hint="Completed" />
        <StatTile label="Billed" value={money(lifetime)} hint="Paid to date" />
        <StatTile
          label="Outstanding"
          value={money(outstanding)}
          tone={outstanding > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Follow-ups"
          value={followUps.filter((f) => !['completed', 'cancelled'].includes(f.status)).length}
          hint="Open"
        />
      </div>

      <div className="mt-10">
        <ClientTabs
          tabs={[
            {
              id: 'timeline',
              label: 'Timeline',
              content: <Timeline items={timeline} />,
            },
            {
              id: 'appointments',
              label: 'Appointments',
              count: views.length,
              content:
                views.length === 0 ? (
                  <EmptyState compact title="No appointments yet" />
                ) : (
                  <div className="space-y-3">
                    {views.map((a) => {
                      const when = parts(a.startAt);
                      return (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5"
                        >
                          <div>
                            <p className="font-medium text-ink">{a.service.name}</p>
                            <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
                              {formatFullDate(when.date)} · {displayTime(when.time)}
                              {a.mode === 'online' ? (
                                <Video className="h-3.5 w-3.5" />
                              ) : (
                                <MapPin className="h-3.5 w-3.5" />
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {a.amountCents > 0 && (
                              <span className="tabular text-sm text-ink">
                                {money(a.amountCents)}
                              </span>
                            )}
                            <Badge tone={STATUS_META[a.status].tone} size="sm">
                              {STATUS_META[a.status].label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
            },
            {
              id: 'payments',
              label: 'Payments',
              count: payments.length,
              content:
                payments.length === 0 ? (
                  <EmptyState compact title="No payments yet" />
                ) : (
                  <div className="space-y-3">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5"
                      >
                        <div>
                          <p className="font-medium tabular text-ink">{money(p.amountCents)}</p>
                          <p className="mt-1 text-sm text-ink-soft">
                            {formatFullDate(parts(p.createdAt).date)} ·{' '}
                            {p.method === 'card' ? 'Card' : 'Medical aid'} · {p.provider}
                          </p>
                        </div>
                        <Badge
                          tone={
                            p.status === 'paid'
                              ? 'success'
                              : p.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                          size="sm"
                        >
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ),
            },
            {
              id: 'followups',
              label: 'Follow-ups',
              count: followUpViews.length,
              content:
                followUpViews.length === 0 ? (
                  <EmptyState
                    compact
                    title="No follow-ups"
                    description="Create one to schedule a reminder and payment request."
                  />
                ) : (
                  <div className="space-y-3">
                    {followUpViews.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5"
                      >
                        <div>
                          <p className="font-medium text-ink">{f.service.name}</p>
                          <p className="mt-1 text-sm text-ink-soft">
                            Due {formatFullDate(f.dueDate)} · remind{' '}
                            {formatFullDate(f.reminderDate)}
                          </p>
                          {f.notes && <p className="mt-2 text-sm text-ink-faint">{f.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {f.paymentRequired && (
                            <span className="tabular text-sm text-ink">{money(f.amountCents)}</span>
                          )}
                          <Badge tone="neutral" size="sm">
                            {f.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
            },
            {
              id: 'notes',
              label: 'Notes',
              count: notes.length,
              content: (
                <div className="space-y-4">
                  <NoteComposer clientUserId={params.id} />
                  {notes.length === 0 ? (
                    <EmptyState compact title="No notes yet" />
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="rounded-2xl border border-line bg-white p-5">
                          <div className="flex items-center justify-between gap-4">
                            <Badge tone="outline" size="sm">
                              {note.category.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-ink-faint">{timeAgo(note.createdAt)}</span>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: 'consent',
              label: 'Consent & comms',
              content: (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-line bg-white p-6">
                    <h3 className="flex items-center gap-2 font-display text-lg text-ink">
                      <ShieldCheck className="h-4.5 w-4.5 text-forest-700 dark:text-forest-300" />
                      Consent records
                    </h3>
                    {consents.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-soft">No consent records.</p>
                    ) : (
                      <ul className="mt-4 space-y-2.5 text-sm">
                        {consents.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-4">
                            <span className="capitalize text-ink-muted">
                              {c.type.replace(/_/g, ' ')} · v{c.version}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="text-xs text-ink-faint">
                                {formatFullDate(parts(c.grantedAt).date)}
                              </span>
                              <Badge tone={c.granted ? 'success' : 'neutral'} size="sm">
                                {c.granted ? 'Given' : 'Withdrawn'}
                              </Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-3xl border border-line bg-white p-6">
                    <h3 className="font-display text-lg text-ink">Communication history</h3>
                    {comms.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-soft">Nothing sent yet.</p>
                    ) : (
                      <ul className="mt-4 space-y-2.5 text-sm">
                        {comms.slice(0, 20).map((log) => (
                          <li key={log.id} className="flex items-center justify-between gap-4">
                            <span className="min-w-0">
                              <span className="block truncate text-ink-muted">{log.subject}</span>
                              <span className="text-xs capitalize text-ink-faint">
                                {log.channel} ·{' '}
                                {log.sentAt
                                  ? timeAgo(log.sentAt)
                                  : log.scheduledFor
                                    ? `scheduled ${formatFullDate(parts(log.scheduledFor).date)}`
                                    : 'queued'}
                              </span>
                            </span>
                            <Badge
                              tone={
                                log.status === 'sent'
                                  ? 'success'
                                  : log.status === 'failed'
                                    ? 'danger'
                                    : 'neutral'
                              }
                              size="sm"
                            >
                              {log.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {audit.length > 0 && (
        <p className="mt-10 text-xs text-ink-faint">
          Every action taken on this record is written to the audit log.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- timeline */

interface TimelineItem {
  at: string;
  title: string;
  detail?: string;
}

function buildTimeline({
  views,
  payments,
  followUps,
  notes,
  comms,
}: {
  views: Awaited<ReturnType<typeof hydrateAppointments>>;
  payments: Awaited<ReturnType<typeof listPayments>>;
  followUps: Awaited<ReturnType<typeof listFollowUps>>;
  notes: Awaited<ReturnType<typeof listClientNotes>>;
  comms: Awaited<ReturnType<typeof listNotificationLogsForUser>>;
}): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const a of views) {
    items.push({
      at: a.createdAt,
      title: 'Appointment booked',
      detail: `${a.service.name} · ${formatFullDate(parts(a.startAt).date)}`,
    });
    if (a.completedAt) {
      items.push({ at: a.completedAt, title: 'Session completed', detail: a.service.name });
    }
    if (a.cancelledAt) {
      items.push({
        at: a.cancelledAt,
        title: a.lateCancellation ? 'Cancelled inside 24 hours' : 'Appointment cancelled',
        detail: a.cancellationReason ?? undefined,
      });
    }
  }

  for (const p of payments) {
    if (p.paidAt) items.push({ at: p.paidAt, title: 'Payment received', detail: money(p.amountCents) });
    else if (p.status === 'failed')
      items.push({ at: p.updatedAt, title: 'Payment failed', detail: money(p.amountCents) });
  }

  for (const f of followUps) {
    items.push({ at: f.createdAt, title: 'Follow-up created', detail: `Due ${formatFullDate(f.dueDate)}` });
    if (f.reminderSentAt)
      items.push({ at: f.reminderSentAt, title: 'Follow-up reminder sent', detail: f.channel });
  }

  for (const n of notes) {
    items.push({ at: n.createdAt, title: 'Note added', detail: n.body.slice(0, 80) });
  }

  for (const c of comms.slice(0, 30)) {
    if (c.sentAt) items.push({ at: c.sentAt, title: c.subject, detail: `Sent by ${c.channel}` });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <EmptyState compact title="Nothing has happened yet" />;
  }

  return (
    <ol className="relative space-y-6 border-l border-line pl-6">
      {items.map((item, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.9rem] top-1.5 flex h-3 w-3 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-forest-500 ring-4 ring-cream-50" />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-sm font-medium text-ink">{item.title}</p>
            <p className="text-xs text-ink-faint">
              {formatFullDate(parts(item.at).date)} · {displayTime(parts(item.at).time)}
            </p>
          </div>
          {item.detail && <p className="mt-1 text-sm text-ink-soft">{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
