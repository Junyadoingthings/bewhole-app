/**
 * Date helpers.
 *
 * The practice runs in a single timezone (Africa/Johannesburg, UTC+2, no DST),
 * so slot maths is done on plain local wall-clock values and serialised with an
 * explicit +02:00 offset. That keeps stored timestamps unambiguous without
 * pulling in a full tz database.
 */

import { BUSINESS } from '@/config/business';

export const TZ = BUSINESS.timezone;
const TZ_OFFSET = '+02:00';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** YYYY-MM-DD for a Date, in practice-local terms. */
export function toISODate(date: Date): string {
  const local = new Date(date.getTime() + tzOffsetDeltaMs(date));
  return local.toISOString().slice(0, 10);
}

/** Difference between the practice offset and the host machine's offset. */
function tzOffsetDeltaMs(date: Date) {
  const hostOffsetMin = -date.getTimezoneOffset();
  const practiceOffsetMin = 120;
  return (practiceOffsetMin - hostOffsetMin) * 60_000;
}

/** Build an absolute instant from a practice-local date + HH:mm. */
export function fromLocalParts(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${TZ_OFFSET}`);
}

export function toLocalTime(iso: string): string {
  return formatInTZ(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatInTZ(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, ...options }).format(date);
}

export function parts(iso: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '00' : map.hour),
    minute: Number(map.minute),
    weekdayName: map.weekday,
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === '24' ? '00' : map.hour}:${map.minute}`,
  };
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addISODays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function today(): string {
  return toISODate(new Date());
}

export function isPastDate(isoDate: string) {
  return isoDate < today();
}

/** "Thursday, 14 August 2026" */
export function formatFullDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = DAY_NAMES[weekdayOf(isoDate)];
  return `${wd}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** "14 Aug" */
export function formatShortDate(isoDate: string) {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

/** "Thu 14 Aug" */
export function formatDayShort(isoDate: string) {
  return `${DAY_NAMES[weekdayOf(isoDate)].slice(0, 3)} ${formatShortDate(isoDate)}`;
}

export function monthLabel(year: number, monthIndex: number) {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function dayName(isoDate: string) {
  return DAY_NAMES[weekdayOf(isoDate)];
}

/**
 * Human relative day: Today / Tomorrow / weekday name / full date.
 * Used everywhere a client sees an upcoming session.
 */
export function relativeDay(isoDate: string): string {
  const t = today();
  if (isoDate === t) return 'Today';
  if (isoDate === addISODays(t, 1)) return 'Tomorrow';
  if (isoDate === addISODays(t, -1)) return 'Yesterday';
  const diff = daysBetween(t, isoDate);
  if (diff > 1 && diff < 7) return dayName(isoDate);
  return formatFullDate(isoDate);
}

function utcMidnight(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromISO: string, toISO: string) {
  return Math.round((utcMidnight(toISO) - utcMidnight(fromISO)) / 86_400_000);
}

/** Hours from now until an instant. Negative means it has passed. */
export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export function isSameISODate(iso: string, isoDate: string) {
  return parts(iso).date === isoDate;
}

/** Calendar grid for a month, padded to whole weeks starting Monday. */
export function monthGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const startOffset = (first.getUTCDay() + 6) % 7; // Monday-first
  const cells: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function startOfWeek(isoDate: string): string {
  const offset = (weekdayOf(isoDate) + 6) % 7;
  return addISODays(isoDate, -offset);
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "10:00" -> "10:00 AM" for client-facing surfaces. */
export function displayTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function greeting(date = new Date()) {
  const h = Number(formatInTZ(date, { hour: '2-digit', hour12: false }));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Compact "2 hours ago" / "in 3 days" for timelines. */
export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
    [2_592_000_000, 'month'],
  ];
  if (abs < 60_000) return 'just now';
  let label = 'moment';
  let value = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    if (abs >= units[i][0]) {
      value = Math.floor(abs / units[i][0]);
      label = units[i][1];
      break;
    }
  }
  const text = `${value} ${label}${value === 1 ? '' : 's'}`;
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

/** Google Calendar template link (client-side "add to calendar"). */
export function googleCalendarUrl(o: {
  title: string;
  start: string;
  end: string;
  details: string;
  location: string;
}) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: o.title,
    dates: `${stamp(o.start)}/${stamp(o.end)}`,
    details: o.details,
    location: o.location,
    ctz: TZ,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Minimal RFC 5545 payload for the Apple/Outlook "add to calendar" button. */
export function icsPayload(o: {
  uid: string;
  title: string;
  start: string;
  end: string;
  details: string;
  location: string;
}) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Be Whole Care//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.uid}@bewholecare.co.za`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(o.start)}`,
    `DTEND:${stamp(o.end)}`,
    `SUMMARY:${o.title}`,
    `DESCRIPTION:${o.details.replace(/\n/g, '\\n')}`,
    `LOCATION:${o.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
