/**
 * Reads someone else's calendar (an iCal/ICS feed from Google, Apple or
 * Outlook) and turns it into busy periods.
 *
 * Self-contained on purpose — no imports — so it can be exercised directly
 * with Node. Only what busy-time needs is parsed: start, end, all-day,
 * transparency, status and recurrence. Titles are kept for the admin view.
 *
 * Recurrence support covers what calendar apps actually emit for personal
 * events: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL,
 * BYDAY (weekly, and monthly like 2TU / -1FR), BYMONTHDAY, EXDATE, and edited
 * single occurrences (RECURRENCE-ID).
 */

export interface BusyPeriod {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** For all-day events: the calendar dates covered, end exclusive (YYYY-MM-DD). */
  allDayFrom?: string;
  allDayTo?: string;
}

interface RawProp { value: string; params: Record<string, string> }
interface RawEvent { props: Map<string, RawProp[]> }

/* ----------------------------------------------------------------- parsing */

function unfold(text: string): string[] {
  // RFC 5545 folds long lines: a line starting with a space or tab continues the previous one.
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  // NAME;PARAM=VALUE;PARAM="quoted:value":content
  let i = 0, inQuote = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i), value = line.slice(i + 1);
  const [name, ...rawParams] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

function parseEvents(text: string): RawEvent[] {
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // ignore nested components (VALARM) inside an event
  for (const line of unfold(text)) {
    if (!line) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && !cur) { cur = { props: new Map() }; depth = 0; continue; }
      if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && p.value.toUpperCase() === 'VEVENT' && depth === 0) { events.push(cur); cur = null; continue; }
      if (cur) depth--;
      continue;
    }
    if (cur && depth === 0) {
      const list = cur.props.get(p.name) ?? [];
      list.push({ value: p.value, params: p.params });
      cur.props.set(p.name, list);
    }
  }
  return events;
}

const first = (e: RawEvent, name: string) => e.props.get(name)?.[0];

function unescapeText(v: string) {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/* --------------------------------------------------------------- date math */

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffsetMs(tz: string, at: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const m: Record<string, number> = {};
    for (const part of fmt.formatToParts(at)) if (part.type !== 'literal') m[part.type] = Number(part.value);
    const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour === 24 ? 0 : m.hour, m.minute, m.second);
    return asUTC - at.getTime();
  } catch {
    return 0; // unknown zone id: treat as UTC rather than failing the whole feed
  }
}

/** Wall-clock time in a zone → the real instant. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffsetMs(tz, new Date(guess));
  // Second pass settles the hour around a DST change.
  return new Date(guess - tzOffsetMs(tz, new Date(first)));
}

interface ParsedTime { date: Date; allDay: boolean; ymd: string }

/** Parses DTSTART/DTEND/EXDATE/RECURRENCE-ID values. `fallbackTz` is used for floating times. */
function parseTime(prop: RawProp | undefined, fallbackTz: string): ParsedTime | null {
  if (!prop) return null;
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s, z] = m;
  const ymd = `${Y}-${Mo}-${D}`;
  if (!h || prop.params.VALUE === 'DATE') {
    return { date: zonedToDate(+Y, +Mo, +D, 0, 0, 0, fallbackTz), allDay: true, ymd };
  }
  if (z) return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +(s ?? 0))), allDay: false, ymd };
  const tz = prop.params.TZID || fallbackTz;
  return { date: zonedToDate(+Y, +Mo, +D, +h, +mi, +(s ?? 0), tz), allDay: false, ymd };
}

function addDaysYMD(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parses an iCal DURATION like PT1H30M or P1D. */
function durationMs(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+(w ?? 0) * 7 + +(d ?? 0)) * 86400 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) * 1000;
  return sign === '-' ? -ms : ms;
}

/* -------------------------------------------------------------- recurrence */

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Wall-clock parts of an instant in a zone. */
function wallParts(at: Date, tz: string) {
  const shifted = new Date(at.getTime() + tzOffsetMs(tz, at));
  return {
    y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
    h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(), s: shifted.getUTCSeconds(),
    wd: shifted.getUTCDay(),
  };
}

function daysInMonth(y: number, mo: number) { return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }

/** Occurrence start instants for an RRULE, limited to [from, to). Includes the DTSTART occurrence. */
function expandRule(rule: string, start: Date, tz: string, from: Date, to: Date, hardCap = 1500): Date[] {
  const r: Record<string, string> = {};
  for (const kv of rule.split(';')) {
    const [k, v] = kv.split('=');
    if (k && v) r[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = r.FREQ;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [start];
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = Infinity;
  if (r.UNTIL) {
    const u = parseTime({ value: r.UNTIL, params: {} }, tz);
    if (u) until = u.allDay ? u.date.getTime() + 86_400_000 - 1 : u.date.getTime();
  }
  const sp = wallParts(start, tz);
  const at = (y: number, mo: number, d: number) => zonedToDate(y, mo, d, sp.h, sp.mi, sp.s, tz);
  const byday = (r.BYDAY ?? '').split(',').filter(Boolean);
  const bymonthday = (r.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number);

  const out: Date[] = [];
  let produced = 0;
  const push = (d: Date) => {
    if (d.getTime() < start.getTime()) return true;
    if (d.getTime() > until || produced >= count) return false;
    produced++;
    if (d >= from && d < to) out.push(d);
    return d < to && out.length < hardCap;
  };

  if (freq === 'DAILY') {
    for (let i = 0; ; i += interval) {
      const d0 = new Date(Date.UTC(sp.y, sp.mo - 1, sp.d + i));
      if (!push(at(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate()))) break;
    }
  } else if (freq === 'WEEKLY') {
    const days = byday.length ? byday.map((b) => WEEKDAYS.indexOf(b.slice(-2))).filter((x) => x >= 0).sort() : [sp.wd];
    // Weeks start on Monday (WKST default) — anchor on the Monday of DTSTART's week.
    const mondayOffset = (sp.wd + 6) % 7;
    for (let w = 0; ; w += interval) {
      let keep = true;
      const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      for (const wd of ordered) {
        const delta = w * 7 - mondayOffset + ((wd + 6) % 7);
        const d0 = new Date(Date.UTC(sp.y, sp.mo - 1, sp.d + delta));
        if (!push(at(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate()))) { keep = false; break; }
      }
      if (!keep) break;
    }
  } else if (freq === 'MONTHLY') {
    for (let k = 0; ; k += interval) {
      const y = sp.y + Math.floor((sp.mo - 1 + k) / 12), mo = ((sp.mo - 1 + k) % 12) + 1;
      const dim = daysInMonth(y, mo);
      const dates: number[] = [];
      if (byday.length) {
        for (const b of byday) {
          const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(b);
          if (!m) continue;
          const wd = WEEKDAYS.indexOf(m[2]), n = m[1] ? Number(m[1]) : 0;
          const matches: number[] = [];
          for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === wd) matches.push(d);
          if (n === 0) dates.push(...matches);
          else { const pick = n > 0 ? matches[n - 1] : matches[matches.length + n]; if (pick) dates.push(pick); }
        }
      } else if (bymonthday.length) {
        for (const md of bymonthday) { const d = md < 0 ? dim + md + 1 : md; if (d >= 1 && d <= dim) dates.push(d); }
      } else if (sp.d <= dim) dates.push(sp.d);
      let keep = true;
      for (const d of dates.sort((a, b) => a - b)) if (!push(at(y, mo, d))) { keep = false; break; }
      if (!keep || y > 2200) break;
    }
  } else {
    for (let k = 0; ; k += interval) {
      const y = sp.y + k;
      if (sp.d > daysInMonth(y, sp.mo)) continue;
      if (!push(at(y, sp.mo, sp.d)) || y > 2200) break;
    }
  }
  return out;
}

/* -------------------------------------------------------------------- main */

export interface ImportOptions {
  timeZone: string;
  from: Date;
  to: Date;
  /** UIDs for events that should not count as busy (e.g. our own appointments echoed back). */
  skipUid?: (uid: string) => boolean;
}

export function busyPeriodsFromICS(text: string, opts: ImportOptions): BusyPeriod[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That link did not return a calendar.');
  const events = parseEvents(text);
  const tz = opts.timeZone;

  // Edited single occurrences replace the generated one with the same start.
  const overrides = new Map<string, Set<number>>();
  for (const e of events) {
    const rid = parseTime(first(e, 'RECURRENCE-ID'), tz);
    const uid = first(e, 'UID')?.value ?? '';
    if (rid && uid) {
      const set = overrides.get(uid) ?? new Set<number>();
      set.add(rid.date.getTime());
      overrides.set(uid, set);
    }
  }

  const out: BusyPeriod[] = [];
  for (const e of events) {
    const uid = first(e, 'UID')?.value ?? '';
    if (opts.skipUid?.(uid)) continue;
    if ((first(e, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') continue;
    // "Show me as: free" events never block time.
    if ((first(e, 'TRANSP')?.value ?? '').toUpperCase() === 'TRANSPARENT') continue;

    const start = parseTime(first(e, 'DTSTART'), tz);
    if (!start) continue;
    const endProp = parseTime(first(e, 'DTEND'), tz);
    const dur = durationMs(first(e, 'DURATION')?.value);
    let lengthMs = endProp ? endProp.date.getTime() - start.date.getTime() : dur ?? (start.allDay ? 86_400_000 : 0);
    if (lengthMs <= 0) lengthMs = start.allDay ? 86_400_000 : 0;
    if (lengthMs === 0) continue; // zero-length reminders don't block anything
    const allDayDays = start.allDay ? Math.max(1, Math.round(lengthMs / 86_400_000)) : 0;

    const summary = unescapeText(first(e, 'SUMMARY')?.value ?? 'Busy') || 'Busy';
    const rrule = first(e, 'RRULE')?.value;
    const isOverride = Boolean(first(e, 'RECURRENCE-ID'));

    // Look back far enough that a long event that started earlier still counts.
    const windowFrom = new Date(opts.from.getTime() - lengthMs);
    let starts = rrule && !isOverride ? expandRule(rrule, start.date, tz, windowFrom, opts.to) : [start.date];

    if (rrule && !isOverride) {
      const ex = new Set<number>();
      for (const p of e.props.get('EXDATE') ?? []) {
        for (const v of p.value.split(',')) {
          const t = parseTime({ value: v, params: p.params }, tz);
          if (t) ex.add(t.date.getTime());
        }
      }
      const edited = overrides.get(uid);
      starts = starts.filter((s) => !ex.has(s.getTime()) && !(edited && edited.has(s.getTime())));
    }

    for (const s of starts) {
      const end = new Date(s.getTime() + lengthMs);
      if (end <= opts.from || s >= opts.to) continue;
      if (start.allDay) {
        const fromYMD = new Date(s.getTime() + tzOffsetMs(tz, s)).toISOString().slice(0, 10);
        out.push({ uid, summary, start: s, end, allDay: true, allDayFrom: fromYMD, allDayTo: addDaysYMD(fromYMD, allDayDays) });
      } else {
        out.push({ uid, summary, start: s, end, allDay: false });
      }
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
