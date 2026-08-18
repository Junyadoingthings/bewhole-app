import 'server-only';

import {
  getService,
  getSettings,
  listAvailabilityBlocks,
  listAvailabilityRules,
  listBookedIntervals,
  listPractitioners,
} from '@/lib/db';
import {
  addISODays,
  daysBetween,
  fromLocalParts,
  minutesToTime,
  timeToMinutes,
  today,
  weekdayOf,
} from '@/lib/date';
import type { DayAvailability, ID, TimeSlot } from '@/types';

/**
 * Availability engine.
 *
 * This is the only source of truth for what can be booked. The wizard renders
 * whatever it returns, and the booking action calls it again before writing —
 * a slot the client saw is re-checked at the moment of commit, so a stale tab
 * can never take a time that has since gone.
 *
 * Inputs considered: business hours, per-practitioner rules, blocked dates and
 * part-days, existing appointments, session duration, buffer, minimum notice,
 * booking horizon, and whether the service supports the requested mode.
 */

export interface AvailabilityQuery {
  serviceId: ID;
  mode: 'online' | 'in_person';
  locationId?: ID | null;
  practitionerId?: ID | null;
}

interface Window {
  practitionerId: ID | null;
  startMin: number;
  endMin: number;
}

async function windowsForDate(date: ISODateLike, query: AvailabilityQuery): Promise<Window[]> {
  const [rules, blocks, practitioners] = await Promise.all([
    listAvailabilityRules(),
    listAvailabilityBlocks(),
    listPractitioners(),
  ]);

  const weekday = weekdayOf(date);
  const eligible = practitioners.filter((p) => {
    if (query.practitionerId && p.id !== query.practitionerId) return false;
    if (query.mode === 'online') return p.offersOnline;
    return query.locationId ? p.locationIds.includes(query.locationId) : true;
  });
  const eligibleIds = new Set(eligible.map((p) => p.id));

  let windows: Window[] = rules
    .filter((r) => r.weekday === weekday)
    .filter((r) => r.mode === 'any' || r.mode === query.mode)
    .filter((r) => !r.locationId || r.locationId === query.locationId)
    .filter((r) => !r.practitionerId || eligibleIds.has(r.practitionerId))
    .map((r) => ({
      practitionerId: r.practitionerId ?? null,
      startMin: timeToMinutes(r.start),
      endMin: timeToMinutes(r.end),
    }));

  // Subtract blocked periods. A whole-day block removes the day entirely.
  for (const block of blocks.filter((b) => b.date === date)) {
    if (block.practitionerId && !eligibleIds.has(block.practitionerId)) continue;
    if (!block.start || !block.end) {
      windows = windows.filter((w) =>
        block.practitionerId ? w.practitionerId !== block.practitionerId : false,
      );
      continue;
    }
    const bStart = timeToMinutes(block.start);
    const bEnd = timeToMinutes(block.end);
    windows = windows.flatMap((w) => {
      if (block.practitionerId && w.practitionerId !== block.practitionerId) return [w];
      if (bEnd <= w.startMin || bStart >= w.endMin) return [w];
      const pieces: Window[] = [];
      if (bStart > w.startMin) pieces.push({ ...w, endMin: bStart });
      if (bEnd < w.endMin) pieces.push({ ...w, startMin: bEnd });
      return pieces;
    });
  }

  return windows;
}

type ISODateLike = string;

export async function getDaySlots(
  date: ISODateLike,
  query: AvailabilityQuery,
): Promise<TimeSlot[]> {
  const [service, settings] = await Promise.all([getService(query.serviceId), getSettings()]);
  if (!service || !service.active) return [];
  if (query.mode === 'online' && !service.allowsOnline) return [];
  if (query.mode === 'in_person' && !service.allowsInPerson) return [];

  const t = today();
  if (date < t) return [];
  if (daysBetween(t, date) > settings.scheduling.maxAdvanceDays) return [];

  const duration = service.durationMinutes || settings.scheduling.durationMinutes;
  const step = settings.scheduling.slotIntervalMinutes;
  const buffer = settings.scheduling.bufferMinutes;
  const earliest = Date.now() + settings.scheduling.minNoticeHours * 3_600_000;

  const windows = await windowsForDate(date, query);
  if (!windows.length) return [];

  const dayStart = fromLocalParts(date, '00:00').toISOString();
  const dayEnd = fromLocalParts(addISODays(date, 1), '00:00').toISOString();
  const booked = await listBookedIntervals(dayStart, dayEnd);

  const slots: TimeSlot[] = [];
  const seen = new Set<string>();

  for (const window of windows) {
    // Align the first slot to the step grid relative to the window start.
    for (let m = window.startMin; m + duration <= window.endMin; m += step) {
      const label = minutesToTime(m);
      if (seen.has(label)) continue;

      const start = fromLocalParts(date, label);
      const end = new Date(start.getTime() + duration * 60_000);
      if (start.getTime() < earliest) continue;

      // Buffer applies on both sides so sessions never run back-to-back.
      const guardStart = new Date(start.getTime() - buffer * 60_000).toISOString();
      const guardEnd = new Date(end.getTime() + buffer * 60_000).toISOString();

      const clash = booked.some(
        (b) =>
          (window.practitionerId === null ||
            b.practitionerId === null ||
            b.practitionerId === window.practitionerId) &&
          b.start < guardEnd &&
          b.end > guardStart,
      );

      seen.add(label);
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label,
        available: !clash,
        practitionerId: window.practitionerId,
      });
    }
  }

  return slots.sort((a, b) => a.label.localeCompare(b.label));
}

/** Per-day summary used to paint the calendar. */
export async function getRangeAvailability(
  fromDate: string,
  toDate: string,
  query: AvailabilityQuery,
): Promise<DayAvailability[]> {
  const t = today();
  const out: DayAvailability[] = [];

  for (let date = fromDate; date <= toDate; date = addISODays(date, 1)) {
    if (date < t) {
      out.push({ date, status: 'past', openSlots: 0 });
      continue;
    }
    const slots = await getDaySlots(date, query);
    if (!slots.length) {
      out.push({ date, status: 'closed', openSlots: 0 });
      continue;
    }
    const open = slots.filter((s) => s.available).length;
    out.push({
      date,
      status: open === 0 ? 'full' : open <= 2 ? 'limited' : 'open',
      openSlots: open,
    });
  }

  return out;
}

/**
 * Authoritative re-check at write time.
 * Returns the resolved slot (with practitioner) or a reason it cannot be taken.
 */
export async function resolveSlot(
  date: string,
  time: string,
  query: AvailabilityQuery,
): Promise<{ ok: true; slot: TimeSlot } | { ok: false; reason: string }> {
  const slots = await getDaySlots(date, query);
  const slot = slots.find((s) => s.label === time);
  if (!slot) return { ok: false, reason: 'That time is no longer offered on this day.' };
  if (!slot.available) return { ok: false, reason: 'That time has just been taken.' };
  return { ok: true, slot };
}

/** First bookable date at or after `from`, for calendar defaults. */
export async function firstAvailableDate(
  from: string,
  query: AvailabilityQuery,
  horizonDays = 60,
): Promise<string | null> {
  for (let i = 0; i <= horizonDays; i++) {
    const date = addISODays(from, i);
    const slots = await getDaySlots(date, query);
    if (slots.some((s) => s.available)) return date;
  }
  return null;
}
