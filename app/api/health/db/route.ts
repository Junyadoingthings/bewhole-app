import { NextResponse } from 'next/server';

import { getSql, hasDatabase } from '@/lib/db/sql';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Database reachability probe.
 *
 * Added because a page that hangs tells you nothing: the platform kills the
 * function and returns a gateway timeout with no error of ours in the logs.
 * This races a trivial query against a timer, so it ALWAYS answers, and says
 * which of the two happened.
 *
 * It deliberately reveals nothing about the connection itself — no host, no
 * user, no database name. Only whether a query completed, how long it took,
 * and the driver's error class if it did not.
 */
export async function GET() {
  const startedAt = Date.now();

  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, stage: 'config', detail: 'DATABASE_URL is not set on this deployment' },
      { status: 503 },
    );
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timed out after 10000ms')), 10_000),
  );

  try {
    const sql = getSql();
    const rows = (await Promise.race([sql`select 1 as ok`, timeout])) as unknown as {
      ok: number;
    }[];

    return NextResponse.json(
      { ok: rows[0]?.ok === 1, stage: 'query', ms: Date.now() - startedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const err = error as { message?: string; code?: string; errno?: string; severity?: string };
    return NextResponse.json(
      {
        ok: false,
        stage: 'connect',
        ms: Date.now() - startedAt,
        // The message can name a host, so keep only the useful classification.
        code: err.code ?? err.errno ?? null,
        severity: err.severity ?? null,
        detail: (err.message ?? 'unknown').replace(/postgres(ql)?:\/\/\S+/gi, '[url]').slice(0, 200),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
