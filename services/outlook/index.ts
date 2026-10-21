import 'server-only';

import crypto from 'node:crypto';

import {
  audit,
  getAppointment,
  getOutlookConnection,
  getSettings,
  listCalendarEvents,
  nowISO,
  replaceOutlookBusy,
  rescheduleAppointment,
  saveOutlookConnection,
  tryLockOutlookSync,
  unlockOutlookSync,
  upsertCalendarEvent,
} from '@/lib/db';
import { addISODays, today } from '@/lib/date';
import { appUrl } from '@/lib/links';
import type { CalendarEventInput, CalendarProvider, CalendarResult } from '@/services/calendar';
import type { OutlookConnection, OutlookIssue, SessionUser } from '@/types';

import { graph, GraphError } from './graph';

/* -------------------------------------------------------------- colours */

/**
 * Bookings are coloured by service in Outlook (the practice's choice). These
 * are Outlook categories in her mailbox: she can recolour or rename them in
 * Outlook at any time and her choice is kept — the site only creates a
 * category that does not exist yet.
 */
const CATEGORY_BY_SERVICE: Record<string, { name: string; color: string }> = {
  svc_individual: { name: 'Be Whole Care · Individual', color: 'preset4' }, // green
  svc_couple: { name: 'Be Whole Care · Couples', color: 'preset8' }, // purple
  svc_family: { name: 'Be Whole Care · Family', color: 'preset1' }, // orange
  svc_pre_marital: { name: 'Be Whole Care · Pre-marital', color: 'preset9' }, // cranberry
  svc_trauma: { name: 'Be Whole Care · Trauma & grief', color: 'preset5' }, // teal
  svc_workplace: { name: 'Be Whole Care · Workplace', color: 'preset6' }, // olive
  svc_testing: { name: 'Be Whole Care · Assessment', color: 'preset7' }, // blue
};
const OTHER_CATEGORY = { name: 'Be Whole Care · Other', color: 'preset3' }; // yellow

export function categoryFor(serviceId?: string | null) {
  return (serviceId && CATEGORY_BY_SERVICE[serviceId]) || OTHER_CATEGORY;
}

export async function ensureCategories(): Promise<void> {
  const existing = await graph<{ value: { displayName: string }[] }>('/me/outlook/masterCategories');
  const names = new Set(existing.value.map((c) => c.displayName));
  for (const c of [...Object.values(CATEGORY_BY_SERVICE), OTHER_CATEGORY]) {
    if (names.has(c.name)) continue;
    await graph('/me/outlook/masterCategories', { method: 'POST', body: { displayName: c.name, color: c.color } });
  }
}

/* ------------------------------------------------------- website → Outlook */

interface GraphEvent {
  id: string;
  start: { dateTime: string };
  end: { dateTime: string };
  showAs?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
}

/** Graph returns UTC "2026-10-28T08:00:00.0000000" (no zone) because of the Prefer header. */
function graphTimeToISO(t: string): string {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(t) ? t : `${t}Z`).toISOString();
}

/**
 * Creates and updates the practice's sessions in Outlook. Used instead of the
 * Google provider once Outlook is connected (see services/calendar).
 */
export const outlookProvider: CalendarProvider = {
  name: 'outlook',
  live: true,
  calendarId: 'outlook',
  async createOrUpdate(input: CalendarEventInput): Promise<CalendarResult> {
    const category = categoryFor(input.serviceId);
    const body = {
      subject: input.summary,
      body: { contentType: 'text', content: `${input.description}\n\nOpen in the console: ${appUrl('/admin/appointments')}` },
      start: { dateTime: input.startISO.replace(/Z$/, ''), timeZone: 'UTC' },
      end: { dateTime: input.endISO.replace(/Z$/, ''), timeZone: 'UTC' },
      location: { displayName: input.location },
      categories: [category.name],
      showAs: 'busy',
      // Her phone's reminder comes from this.
      isReminderOn: true,
      reminderMinutesBeforeStart: 60,
    };
    try {
      if (input.existingId) {
        try {
          const updated = await graph<GraphEvent>(`/me/events/${encodeURIComponent(input.existingId)}`, {
            method: 'PATCH',
            body,
          });
          return { ok: true, externalId: updated.id };
        } catch (error) {
          // Deleted in Outlook meanwhile: fall through and create it afresh.
          if (!(error instanceof GraphError && error.status === 404)) throw error;
        }
      }
      const created = await graph<GraphEvent>('/me/events', { method: 'POST', body });
      return { ok: true, externalId: created.id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Outlook update failed' };
    }
  },
  async cancel(externalId: string): Promise<CalendarResult> {
    try {
      await graph(`/me/events/${encodeURIComponent(externalId)}`, { method: 'DELETE' });
      return { ok: true };
    } catch (error) {
      if (error instanceof GraphError && error.status === 404) return { ok: true };
      return { ok: false, error: error instanceof Error ? error.message : 'Outlook delete failed' };
    }
  },
};

/* ------------------------------------------------------- Outlook → website */

/** More deletions than this in one sync are held for the practice to confirm. */
const MAX_DELETIONS_PER_SYNC = 3;

function newIssue(message: string, appointmentId?: string | null): OutlookIssue {
  return { at: nowISO(), message, appointmentId: appointmentId ?? null };
}

async function recordResult(patch: Partial<OutlookConnection>, issues: OutlookIssue[]) {
  const c = await getOutlookConnection();
  if (!c) return;
  await saveOutlookConnection({
    ...c,
    ...patch,
    issues: [...issues, ...c.issues].slice(0, 20),
  });
}

/** The practice account the sync acts as (cancellation emails go out as from staff). */
function practiceActor(c: OutlookConnection): SessionUser {
  return { id: c.connectedByUserId, role: 'ADMIN', email: '', firstName: 'Outlook', lastName: 'sync' };
}

export interface SyncSummary {
  ok: boolean;
  skipped?: 'not_connected' | 'locked';
  moved: number;
  cancelled: number;
  busy: number;
  issues: number;
  error?: string;
}

/**
 * Read the practitioner's Outlook calendar and bring the website into line:
 *
 *  - Her own events (not Be Whole Care sessions) become busy times that the
 *    booking page will not offer. Only their times are stored.
 *  - A session she moved in Outlook is rescheduled on the website (the client
 *    is emailed, as for any reschedule) — unless the new time clashes with
 *    another booking, which is flagged instead.
 *  - A session she deleted in Outlook is cancelled on the website (the client
 *    is emailed) — but only after Outlook confirms the event is gone, and never
 *    more than a few at once (see MAX_DELETIONS_PER_SYNC).
 *
 * Only upcoming, confirmed sessions are ever changed. One sync runs at a time.
 */
export async function syncFromOutlook(): Promise<SyncSummary> {
  const empty = { moved: 0, cancelled: 0, busy: 0, issues: 0 };
  const connection = await getOutlookConnection();
  if (!connection) return { ok: true, skipped: 'not_connected', ...empty };
  if (!(await tryLockOutlookSync(120))) return { ok: true, skipped: 'locked', ...empty };

  const issues: OutlookIssue[] = [];
  try {
    const settings = await getSettings();
    const from = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const to = new Date(`${addISODays(today(), settings.scheduling.maxAdvanceDays + 7)}T00:00:00Z`).toISOString();

    // Every event in the window, all pages.
    const events: GraphEvent[] = [];
    let next: string | null =
      `/me/calendarView?startDateTime=${encodeURIComponent(from)}&endDateTime=${encodeURIComponent(to)}` +
      '&$select=id,start,end,showAs,isCancelled,isAllDay&$top=200';
    while (next) {
      const page: { value: GraphEvent[]; '@odata.nextLink'?: string } = await graph(next);
      events.push(...page.value);
      next = page['@odata.nextLink'] ?? null;
    }
    const byId = new Map(events.map((e) => [e.id, e]));

    // Sessions the website put in Outlook.
    const links = (await listCalendarEvents()).filter(
      (l) => l.provider === 'outlook' && l.status === 'synced' && l.externalId,
    );
    // Never count a session the website put in her calendar as her own busy
    // time, whichever provider row recorded it.
    const linkedIds = new Set((await listCalendarEvents()).map((l) => l.externalId).filter(Boolean));

    const now = nowISO();
    const actor = practiceActor(connection);
    const deletions: { link: (typeof links)[number]; appointmentId: string }[] = [];
    let moved = 0;

    for (const link of links) {
      const appointment = await getAppointment(link.appointmentId);
      if (!appointment || appointment.status !== 'confirmed' || appointment.startAt <= now) continue;

      let event = byId.get(link.externalId);
      if (!event) {
        // Not in the window: moved far away, or deleted. Ask Outlook directly.
        try {
          event = await graph<GraphEvent>(
            `/me/events/${encodeURIComponent(link.externalId)}?$select=id,start,end,showAs,isCancelled,isAllDay`,
          );
        } catch (error) {
          if (error instanceof GraphError && error.status === 404) {
            deletions.push({ link, appointmentId: appointment.id });
          } else {
            throw error;
          }
          continue;
        }
      }
      if (event.isCancelled) {
        deletions.push({ link, appointmentId: appointment.id });
        continue;
      }

      const start = graphTimeToISO(event.start.dateTime);
      const end = graphTimeToISO(event.end.dateTime);
      if (start === appointment.startAt && end === appointment.endAt) continue;
      if (start <= now) {
        issues.push(newIssue(`${appointment.reference} was moved to a time that has passed in Outlook — not changed on the website.`, appointment.id));
        continue;
      }

      const result = await rescheduleAppointment(appointment.id, start, end);
      if (!result.ok) {
        issues.push(
          newIssue(
            `${appointment.reference} was moved in Outlook to a time that clashes with another booking — not changed on the website. Please choose another time.`,
            appointment.id,
          ),
        );
        continue;
      }
      await audit({
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'appointment.rescheduled_in_outlook',
        entity: 'appointment',
        entityId: appointment.id,
        meta: { from: appointment.startAt, to: start },
      });
      const { emit } = await import('@/services/events');
      await emit({ type: 'appointment.rescheduled', appointmentId: appointment.id, previousStart: appointment.startAt });
      moved += 1;
    }

    let cancelled = 0;
    if (deletions.length > MAX_DELETIONS_PER_SYNC) {
      issues.push(
        newIssue(
          `${deletions.length} sessions disappeared from Outlook at once, so none were cancelled automatically. If you meant to cancel them, cancel them in Appointments.`,
        ),
      );
    } else {
      const { cancelAppointment } = await import('@/services/booking.service');
      for (const d of deletions) {
        const result = await cancelAppointment(d.appointmentId, actor, 'Removed from the practice calendar');
        if (result.ok) {
          cancelled += 1;
          await upsertCalendarEvent({ ...d.link, status: 'cancelled', updatedAt: nowISO() });
        } else {
          issues.push(newIssue(`A session deleted in Outlook could not be cancelled: ${result.error}`, d.appointmentId));
        }
      }
    }

    // Her own time: everything else that is not free.
    const busy = events
      .filter((e) => !linkedIds.has(e.id) && !e.isCancelled && (e.showAs ?? 'busy') !== 'free')
      .map((e) => ({ id: e.id, startAt: graphTimeToISO(e.start.dateTime), endAt: graphTimeToISO(e.end.dateTime) }));
    await replaceOutlookBusy(busy);

    await recordResult({ lastSyncedAt: nowISO(), lastSyncError: null }, issues);
    return { ok: true, moved, cancelled, busy: busy.length, issues: issues.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outlook sync failed';
    await recordResult({ lastSyncError: message }, issues);
    return { ok: false, ...empty, error: message };
  } finally {
    await unlockOutlookSync();
  }
}

/** Sync if the last one is older than `maxAgeSeconds` (called from busy pages). */
export async function syncIfStale(maxAgeSeconds = 120): Promise<void> {
  const c = await getOutlookConnection();
  if (!c) return;
  const age = c.lastSyncedAt ? (Date.now() - new Date(c.lastSyncedAt).getTime()) / 1000 : Infinity;
  if (age < maxAgeSeconds) return;
  await syncFromOutlook().catch(() => undefined);
}

/* ------------------------------------------------- change notifications */

/** Microsoft allows at most ~3 days for event subscriptions; renewed daily by the cron job. */
const SUBSCRIPTION_HOURS = 60;

export function newClientState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Ask Microsoft to call /api/outlook/notify whenever her calendar changes,
 * so edits in Outlook reach the website within moments. Creates the
 * subscription, or renews it when it is due.
 */
export async function ensureSubscription(): Promise<void> {
  const c = await getOutlookConnection();
  if (!c) return;
  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_HOURS * 3_600_000).toISOString();

  if (c.subscriptionId) {
    try {
      await graph(`/subscriptions/${encodeURIComponent(c.subscriptionId)}`, {
        method: 'PATCH',
        body: { expirationDateTime },
      });
      await saveOutlookConnection({ ...c, subscriptionExpiresAt: expirationDateTime });
      return;
    } catch (error) {
      if (!(error instanceof GraphError && error.status === 404)) throw error;
    }
  }
  const created = await graph<{ id: string; expirationDateTime: string }>('/subscriptions', {
    method: 'POST',
    body: {
      changeType: 'created,updated,deleted',
      notificationUrl: appUrl('/api/outlook/notify'),
      resource: 'me/events',
      expirationDateTime,
      clientState: c.clientState,
    },
  });
  const latest = (await getOutlookConnection()) ?? c;
  await saveOutlookConnection({
    ...latest,
    subscriptionId: created.id,
    subscriptionExpiresAt: created.expirationDateTime,
  });
}

export async function removeSubscription(): Promise<void> {
  const c = await getOutlookConnection();
  if (!c?.subscriptionId) return;
  await graph(`/subscriptions/${encodeURIComponent(c.subscriptionId)}`, { method: 'DELETE' }).catch(() => undefined);
}

/**
 * Put every upcoming confirmed session in Outlook — on first connecting, so
 * her calendar starts complete rather than only with bookings made afterwards.
 */
export async function pushUpcomingToOutlook(): Promise<number> {
  const { listAppointments } = await import('@/lib/db');
  const { emit } = await import('@/services/events');
  const upcoming = await listAppointments({ from: nowISO(), statuses: ['confirmed'] });
  const links = new Map((await listCalendarEvents()).map((l) => [l.appointmentId, l]));
  let pushed = 0;
  for (const a of upcoming) {
    const link = links.get(a.id);
    if (link?.provider === 'outlook' && link.status === 'synced') continue;
    await emit({ type: 'appointment.calendar_sync', appointmentId: a.id });
    pushed += 1;
  }
  return pushed;
}
