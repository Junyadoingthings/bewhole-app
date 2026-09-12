import { NextResponse } from 'next/server';

// Mock/Adapter helper: Replace this with your actual DB query to fetch admin bookings
// e.g. import { getAppointments } from '@/services/appointments';
export async function GET() {
  const practiceName = 'Be Whole Care';

  // Sample static test event or replace with real appointments from your DB
  const events = [
    {
      id: 'demo-booking-1',
      title: 'Consultation - Be Whole Care',
      description: 'Client consultation booking',
      start: new Date().toISOString().replace(/-|:|\.\d+/g, ''),
      end: new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d+/g, ''),
    },
  ];

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BeWholeCare//AdminFeed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${practiceName} Bookings`,
    'X-WR-TIMEZONE:Africa/Johannesburg',
    ...events.flatMap((evt) => [
      'BEGIN:VEVENT',
      `UID:${evt.id}@bewholecare.com`,
      `DTSTAMP:${evt.start}`,
      `DTSTART:${evt.start}`,
      `DTEND:${evt.end}`,
      `SUMMARY:${evt.title}`,
      `DESCRIPTION:${evt.description}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];

  return new NextResponse(icsLines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="appointments.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
