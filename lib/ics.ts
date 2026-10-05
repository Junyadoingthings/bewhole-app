/**
 * A small RFC 5545 (iCalendar) writer for the practice's calendar
 * subscription. Only what the feed needs: timed and all-day events, escaped
 * text and 75-octet line folding, which Outlook in particular insists on.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** ISO instants for a timed event… */
  start?: string;
  end?: string;
  /** …or a local date (YYYY-MM-DD) for an all-day event. */
  allDay?: string;
  status?: 'CONFIRMED' | 'TENTATIVE';
  url?: string;
  updatedAt?: string;
}

function utcStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
}

function dateStamp(isoDate: string) {
  return isoDate.replace(/-/g, '');
}

function nextDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** TEXT values escape backslash, semicolon, comma and newlines. */
function text(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets continue on the next line after one space. */
function fold(line: string) {
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildCalendar(options: { name: string; timezone: string; events: IcsEvent[] }) {
  const now = utcStamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Be Whole Care//Practice calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(options.name)}`,
    `X-WR-TIMEZONE:${options.timezone}`,
    // A hint only: Apple honours it; Outlook.com and Google refresh on their
    // own schedule (a few hours).
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const e of options.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${now}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.allDay)}`, `DTEND;VALUE=DATE:${dateStamp(nextDay(e.allDay))}`);
    } else if (e.start && e.end) {
      lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`);
    }
    lines.push(`SUMMARY:${text(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${text(e.description)}`);
    if (e.location) lines.push(`LOCATION:${text(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.status) lines.push(`STATUS:${e.status}`);
    if (e.updatedAt) lines.push(`LAST-MODIFIED:${utcStamp(e.updatedAt)}`);
    lines.push('TRANSP:OPAQUE', 'END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
