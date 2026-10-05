import { NextResponse } from 'next/server';

import { BUSINESS, CLIENT_EMAIL } from '@/config/business';
import { addISODays, fromLocalParts, today } from '@/lib/date';
import { getCounter, hydrateAppointments, listAppointments, listAvailabilityBlocks } from '@/lib/db';
import { buildCalendar, type IcsEvent } from '@/lib/ics';
import { appUrl, isCalendarFeedToken } from '@/lib/links';
import type { AppointmentView } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * The practice's calendar subscription (Outlook, Apple, Google): sessions and
 * blocked time, kept current by the calendar app re-reading this address.
 *
 * Private: the link carries a secret token (see calendarFeedToken). Anything
 * else gets the same plain 404 as a page that does not exist. Events hold only
 * what a diary needs — service, client name, reference and where — never
 * contact details, medical aid or notes.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.ics$/i, '');
  const version = await getCounter('calendar_feed');
  if (!isCalendarFeedToken(token, version)) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const from = `${addISODays(today(), -90)}T00:00:00.000Z`;
  const to = `${addISODays(today(), 400)}T00:00:00.000Z`;
  const [appointments, blocks] = await Promise.all([listAppointments({ from, to }), listAvailabilityBlocks()]);
  const shown = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show');
  const views = await hydrateAppointments(shown);

  const events: IcsEvent[] = [
    ...views.map(sessionEvent),
    ...blocks
      .filter((b) => b.date >= from.slice(0, 10))
      .map((b) =>
        b.start && b.end
          ? {
              uid: `${b.id}@bewholecare`,
              summary: `Blocked — ${b.reason}`,
              start: fromLocalParts(b.date, b.start).toISOString(),
              end: fromLocalParts(b.date, b.end).toISOString(),
            }
          : { uid: `${b.id}@bewholecare`, summary: `Blocked — ${b.reason}`, allDay: b.date },
      ),
  ];

  const body = buildCalendar({ name: `${BUSINESS.name} sessions`, timezone: BUSINESS.timezone, events });
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="be-whole-care.ics"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

const PREFIX: Partial<Record<AppointmentView['status'], string>> = {
  pending_medical_aid: 'Medical aid to verify — ',
  pending_payment: 'Awaiting payment — ',
};

function sessionEvent(a: AppointmentView): IcsEvent {
  const client = a.client?.name ?? 'Client';
  const others = a.participants?.length ?? 0;
  const who = others ? `${client} + ${others}` : client;
  const where =
    a.mode === 'online'
      ? 'Online session'
      : a.location
        ? `${a.location.name} — ${a.location.addressLine}, ${a.location.city}`
        : 'In person';

  const details = [
    `Reference: ${a.reference}`,
    others ? `Attending: ${[client, ...a.participants!.map((p) => `${p.firstName} ${p.lastName}`)].join(', ')}` : null,
    a.mode === 'online' ? `Session link: ${a.sessionLink || CLIENT_EMAIL.onlineSessionLink}` : `Where: ${where}`,
    PREFIX[a.status] ? `Status: ${PREFIX[a.status]!.replace(/ — $/, '')}` : null,
    `Open in the console: ${appUrl(`/admin/appointments?ref=${a.reference}`)}`,
  ].filter(Boolean);

  return {
    uid: `${a.id}@bewholecare`,
    summary: `${PREFIX[a.status] ?? ''}${a.service.name} — ${who}`,
    description: details.join('\n'),
    location: where,
    start: a.startAt,
    end: a.endAt,
    status: a.status === 'confirmed' || a.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE',
    url: appUrl(`/admin/appointments?ref=${a.reference}`),
    updatedAt: a.updatedAt,
  };
}
