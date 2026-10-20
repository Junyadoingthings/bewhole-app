import 'server-only';

import crypto from 'node:crypto';

import { getSettings } from '@/lib/db';
import { addISODays, minutesToTime, parts, TZ, today } from '@/lib/date';
import { busyPeriodsFromICS, type BusyPeriod } from '@/lib/ical-import';
import { outboundTimeout } from '@/lib/outbound';
import type { AvailabilityBlock } from '@/types';

/**
 * "Add my calendar to BWC": the practitioner's own calendar (Google, Apple or
 * Outlook, via its private iCal link) decides when she is busy.
 *
 * Every event in it becomes blocked time — clients cannot book over it, and it
 * shows on the admin calendar exactly like a manual block. Nothing is written
 * back and nothing is stored except the link.
 *
 * The double-booking loop is broken here: BWC's own sessions, which already
 * sit in her calendar (through the "Add to my calendar" subscription or the
 * Google sync), are recognised by their ids and skipped — otherwise every
 * appointment would come back in as a block on top of itself.
 */

const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 5 * 1024 * 1024;

/** BWC's own events: the subscription feed uses `<id>@bewholecare`, the Google sync `bwc<hash>`. */
export function isOwnEvent(uid: string) {
  const u = uid.toLowerCase();
  return u.endsWith('@bewholecare') || /^bwc[0-9a-v]{6,}(@google\.com)?$/.test(u);
}

/** Normalises a pasted link and refuses anything that is not a public https address. */
export function normaliseCalendarUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const raw = input.trim().replace(/^webcals?:\/\//i, 'https://');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'That doesn’t look like a link. Paste the full calendar address.' };
  }
  // Local development only: allow a feed served from this machine, for testing.
  if (process.env.NODE_ENV === 'development' && url.protocol === 'http:' && url.hostname === 'localhost') {
    return { ok: true, url: url.toString() };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'The link must start with https:// or webcal://.' };
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) || // no raw IP addresses
    host.includes(':');                  // or IPv6 literals
  if (privateHost) return { ok: false, error: 'Use the calendar’s own web address, not an IP address.' };
  if (/bewholecare/i.test(host) || /\/api\/calendar\/feed\//.test(url.pathname)) {
    return { ok: false, error: 'That is the BWC calendar itself. Paste the link to your own calendar instead.' };
  }
  return { ok: true, url: url.toString() };
}

export interface ImportStatus {
  connected: boolean;
  ok: boolean;
  events: number;
  checkedAt: string | null;
  error?: string;
}

let cache: { url: string; at: number; periods: BusyPeriod[]; error?: string } | null = null;

async function fetchPeriods(url: string): Promise<BusyPeriod[]> {
  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: outboundTimeout(),
    headers: { Accept: 'text/calendar, */*;q=0.5', 'User-Agent': 'BeWholeCare-CalendarImport/1.0' },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404 || res.status === 403
        ? 'Your calendar app refused the link. It may have been reset — copy a fresh one.'
        : `Your calendar app did not answer (error ${res.status}).`,
    );
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('That calendar is too large to read.');
  const from = new Date(`${addISODays(today(), -7)}T00:00:00Z`);
  const to = new Date(`${addISODays(today(), 400)}T00:00:00Z`);
  return busyPeriodsFromICS(text, { timeZone: TZ, from, to, skipUid: isOwnEvent });
}

/** Reads the connected calendar (cached for a few minutes). Never throws. */
export async function readExternalCalendar(force = false): Promise<{ periods: BusyPeriod[]; status: ImportStatus }> {
  let url: string | undefined;
  try {
    url = (await getSettings()).calendarImport?.url;
  } catch {
    url = undefined;
  }
  if (!url) return { periods: [], status: { connected: false, ok: true, events: 0, checkedAt: null } };

  const fresh = cache && cache.url === url && Date.now() - cache.at < CACHE_MS;
  if (!fresh || force) {
    try {
      cache = { url, at: Date.now(), periods: await fetchPeriods(url) };
    } catch (err) {
      // Keep the last good read on a temporary failure so a blip doesn't open up booked time.
      const keep = cache && cache.url === url ? cache.periods : [];
      cache = { url, at: Date.now(), periods: keep, error: err instanceof Error ? err.message : 'Could not read your calendar.' };
    }
  }
  return {
    periods: cache!.periods,
    status: {
      connected: true,
      ok: !cache!.error,
      events: cache!.periods.length,
      checkedAt: new Date(cache!.at).toISOString(),
      error: cache!.error,
    },
  };
}

/** Test a link before saving it: fetch and parse it once. */
export async function testCalendarUrl(url: string): Promise<{ ok: true; events: number } | { ok: false; error: string }> {
  try {
    const periods = await fetchPeriods(url);
    cache = { url, at: Date.now(), periods };
    return { ok: true, events: periods.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not read that calendar.' };
  }
}

export function clearExternalCalendarCache() {
  cache = null;
}

const blockId = (p: BusyPeriod, date: string) =>
  `ext-${crypto.createHash('sha1').update(`${p.uid}|${p.start.toISOString()}|${date}`).digest('hex').slice(0, 16)}`;

/**
 * Busy periods as practice-local, per-day blocks — the same shape as a manual
 * block, so availability and the calendar treat them identically.
 */
export function periodsToBlocks(periods: BusyPeriod[]): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];
  const createdAt = new Date().toISOString();

  for (const p of periods) {
    if (p.allDay && p.allDayFrom && p.allDayTo) {
      for (let d = p.allDayFrom; d < p.allDayTo; d = addISODays(d, 1)) {
        blocks.push({ id: blockId(p, d), date: d, start: null, end: null, reason: p.summary, createdAt, source: 'external' });
      }
      continue;
    }
    const s = parts(p.start.toISOString());
    const e = parts(p.end.toISOString());
    for (let d = s.date; d <= e.date; d = addISODays(d, 1)) {
      const startMin = d === s.date ? s.hour * 60 + s.minute : 0;
      const endMin = d === e.date ? e.hour * 60 + e.minute : 24 * 60;
      if (endMin <= startMin) continue;
      const whole = startMin === 0 && endMin === 24 * 60;
      blocks.push({
        id: blockId(p, d),
        date: d,
        start: whole ? null : minutesToTime(startMin),
        end: whole ? null : endMin === 24 * 60 ? '23:59' : minutesToTime(endMin),
        reason: p.summary,
        createdAt,
        source: 'external',
      });
    }
  }
  return blocks;
}

/** Blocked time from the connected calendar. Empty when none is connected or it can't be read. */
export async function listExternalBlocks(): Promise<AvailabilityBlock[]> {
  const { periods } = await readExternalCalendar();
  return periodsToBlocks(periods);
}
