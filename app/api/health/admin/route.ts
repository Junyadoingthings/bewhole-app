import { NextResponse } from 'next/server';

import { hydrateAppointments, listAppointments, listClients, listNotifications } from '@/lib/db';
import { getDashboardMetrics } from '@/services/analytics.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * TEMPORARY diagnostic. Delete once the dashboard is healthy.
 *
 * The /admin dashboard fails with a minified stack that names no file, and it
 * renders blank — so the error boundary never shows a reference either. This
 * runs the same loads the dashboard does, one at a time, and reports which one
 * throws and what it says.
 *
 * It returns COUNTS ONLY. No names, no emails, no appointment details: this
 * route is unauthenticated by necessity (the failure happens while resolving
 * the admin session), so it must not be able to leak client information.
 */
/**
 * Each step races a 5s timer.
 *
 * The first version of this route simply awaited each load, and when one hung
 * the whole route was killed by the platform and reported nothing at all —
 * exactly the failure it was written to diagnose. A probe that can hang is not
 * a probe.
 */
const STEP_TIMEOUT_MS = 5_000;

async function step<T>(name: string, run: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    const value = await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`step exceeded ${STEP_TIMEOUT_MS}ms — this is the one that hangs`)),
          STEP_TIMEOUT_MS,
        ),
      ),
    ]);
    return { name, ok: true as const, ms: Date.now() - startedAt, value };
  } catch (error) {
    const err = error as { message?: string; stack?: string; code?: string };
    return {
      name,
      ok: false as const,
      ms: Date.now() - startedAt,
      code: err.code ?? null,
      message: (err.message ?? 'unknown').slice(0, 300),
      // First few frames only — enough to place it, not a full dump.
      frames: (err.stack ?? '').split('\n').slice(1, 5).map((l) => l.trim()),
    };
  }
}

export async function GET() {
  const results: unknown[] = [];

  const notifications = await step('listNotifications', () =>
    listNotifications({ audience: 'staff' }),
  );
  results.push({ ...notifications, value: notifications.ok ? notifications.value.length : null });

  const clients = await step('listClients', () => listClients());
  results.push({
    ...clients,
    value: clients.ok
      ? {
          count: clients.value.length,
          // The layout reads c.user.id — prove that shape survives the mapping.
          allHaveUserId: clients.value.every((c) => Boolean(c?.user?.id)),
          allHaveProfile: clients.value.every((c) => Boolean(c?.profile)),
        }
      : null,
  });

  const appointments = await step('listAppointments', () => listAppointments());
  results.push({ ...appointments, value: appointments.ok ? appointments.value.length : null });

  if (appointments.ok) {
    const hydrated = await step('hydrateAppointments', () =>
      hydrateAppointments(appointments.value.slice(-40)),
    );
    results.push({
      ...hydrated,
      value: hydrated.ok
        ? {
            count: hydrated.value.length,
            // The layout reads a.service.name; a missing service would throw.
            allHaveService: hydrated.value.every((a) => Boolean(a?.service?.name)),
            allHaveId: hydrated.value.every((a) => Boolean(a?.id)),
          }
        : null,
    });
  }

  const metrics = await step('getDashboardMetrics', () => getDashboardMetrics());
  results.push({
    ...metrics,
    value: metrics.ok
      ? { today: metrics.value.todayAppointments.length, clients: metrics.value.clients.total }
      : null,
  });

  const failed = results.filter((r) => !(r as { ok: boolean }).ok);

  // Always 200. A diagnostic that answers with an error status gets its body
  // swallowed by intermediaries and inspection tools — the verdict belongs in
  // the payload, where it can actually be read.
  return NextResponse.json(
    { failedSteps: failed.length, results },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
