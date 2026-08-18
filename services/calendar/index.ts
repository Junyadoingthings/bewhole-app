import 'server-only';

import crypto from 'node:crypto';

/**
 * Calendar provider contract + implementations.
 *
 * The client specifically asked for confirmed bookings to land on
 * bewholecare@gmail.com. GoogleCalendarProvider does that over the Calendar
 * API using a server-side OAuth refresh token; MockCalendarProvider stands in
 * whenever credentials are absent so the rest of the flow is identical.
 *
 * Duplicate prevention: every event is created with a deterministic id derived
 * from the appointment id, so a retried confirmation updates the same event
 * instead of creating a second one.
 */

export interface CalendarEventInput {
  appointmentId: string;
  summary: string;
  description: string;
  location: string;
  startISO: string;
  endISO: string;
  timeZone: string;
  attendeeEmail?: string | null;
  attendeeName?: string | null;
  conference?: boolean;
}

export interface CalendarResult {
  ok: boolean;
  externalId?: string;
  htmlLink?: string | null;
  meetLink?: string | null;
  error?: string;
}

export interface CalendarProvider {
  readonly name: 'google' | 'mock';
  readonly live: boolean;
  readonly calendarId: string;
  createOrUpdate(input: CalendarEventInput): Promise<CalendarResult>;
  cancel(externalId: string): Promise<CalendarResult>;
}

/**
 * Google requires event ids to be base32hex (a-v, 0-9), 5–1024 chars. Hashing
 * the appointment id gives us a stable, collision-free id in that alphabet.
 */
function deterministicEventId(appointmentId: string) {
  const digest = crypto.createHash('sha1').update(appointmentId).digest('hex');
  const base32hex = digest.replace(/[w-z]/g, 'v').slice(0, 26);
  return `bwc${base32hex}`;
}

/* ------------------------------------------------------------------ google */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function googleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? '',
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

const googleProvider: CalendarProvider = {
  name: 'google',
  get live() {
    return Boolean(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID);
  },
  get calendarId() {
    return process.env.GOOGLE_CALENDAR_ID || 'bewholecare@gmail.com';
  },

  async createOrUpdate(input: CalendarEventInput): Promise<CalendarResult> {
    try {
      const token = await googleAccessToken();
      const eventId = deterministicEventId(input.appointmentId);
      const calendarId = encodeURIComponent(this.calendarId);

      const body: Record<string, unknown> = {
        id: eventId,
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.startISO, timeZone: input.timeZone },
        end: { dateTime: input.endISO, timeZone: input.timeZone },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
        // Attendees are added without invitations so a client's address is
        // never exposed in a group invite thread.
        ...(input.attendeeEmail
          ? { attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName ?? undefined }] }
          : {}),
        ...(input.conference
          ? {
              conferenceData: {
                createRequest: {
                  requestId: eventId,
                  conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
              },
            }
          : {}),
      };

      const qs = input.conference ? '?conferenceDataVersion=1&sendUpdates=none' : '?sendUpdates=none';

      // PUT with our own id is an upsert: first confirmation creates it, a
      // reschedule updates the same event. No duplicates, ever.
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}${qs}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        },
      );

      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `Calendar sync failed (${res.status}): ${text.slice(0, 200)}` };
      }

      const json = (await res.json()) as {
        id: string;
        htmlLink?: string;
        hangoutLink?: string;
        conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
      };

      const meetLink =
        json.hangoutLink ??
        json.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
        null;

      return { ok: true, externalId: json.id, htmlLink: json.htmlLink ?? null, meetLink };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Calendar sync failed' };
    }
  },

  async cancel(externalId: string): Promise<CalendarResult> {
    try {
      const token = await googleAccessToken();
      const calendarId = encodeURIComponent(this.calendarId);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${externalId}?sendUpdates=none`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      // 410 means it is already gone, which is the outcome we wanted anyway.
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        return { ok: false, error: `Calendar cancel failed (${res.status})` };
      }
      return { ok: true, externalId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Calendar cancel failed' };
    }
  },
};

/* -------------------------------------------------------------------- mock */

const mockEvents = ((globalThis as unknown as { __bwc_mock_cal?: Map<string, CalendarEventInput> })
  .__bwc_mock_cal ??= new Map<string, CalendarEventInput>());

const mockProvider: CalendarProvider = {
  name: 'mock',
  live: false,
  calendarId: process.env.GOOGLE_CALENDAR_ID || 'bewholecare@gmail.com',

  async createOrUpdate(input: CalendarEventInput): Promise<CalendarResult> {
    const externalId = deterministicEventId(input.appointmentId);
    mockEvents.set(externalId, input);
    return {
      ok: true,
      externalId,
      htmlLink: null,
      meetLink: input.conference
        ? `https://meet.google.com/lookup/${externalId.slice(3, 13)}`
        : null,
    };
  },

  async cancel(externalId: string): Promise<CalendarResult> {
    mockEvents.delete(externalId);
    return { ok: true, externalId };
  },
};

export function getCalendarProvider(): CalendarProvider {
  return googleProvider.live ? googleProvider : mockProvider;
}
