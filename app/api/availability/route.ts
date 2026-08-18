import { NextResponse } from 'next/server';

import { getDaySlots, getRangeAvailability } from '@/services/availability.service';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { addISODays, today } from '@/lib/date';

export const dynamic = 'force-dynamic';

/**
 * Availability lookup for the booking calendar.
 *
 * Read-only and public — it exposes nothing but open times, never who booked
 * the closed ones. The same functions are called again inside the booking
 * action, so this response is a convenience for the UI, not a reservation.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request.headers, 'availability'), LIMITS.availability);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const serviceId = url.searchParams.get('serviceId');
  const mode = url.searchParams.get('mode');
  const locationId = url.searchParams.get('locationId');
  const date = url.searchParams.get('date');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!serviceId || (mode !== 'online' && mode !== 'in_person')) {
    return NextResponse.json({ error: 'serviceId and mode are required' }, { status: 400 });
  }

  const query: { serviceId: string; mode: 'online' | 'in_person'; locationId: string | null } = {
    serviceId,
    mode,
    locationId: mode === 'in_person' ? locationId : null,
  };

  try {
    if (date) {
      const slots = await getDaySlots(date, query);
      return NextResponse.json(
        { date, slots },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const start = from ?? today();
    // Cap the window so a crafted request cannot walk years of dates.
    const end = to && to > start ? to : addISODays(start, 41);
    const capped = end > addISODays(start, 62) ? addISODays(start, 62) : end;

    const days = await getRangeAvailability(start, capped, query);
    return NextResponse.json({ days }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[bwc:availability]', error);
    return NextResponse.json({ error: 'Could not load availability' }, { status: 500 });
  }
}
