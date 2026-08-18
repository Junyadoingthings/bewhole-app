import 'server-only';

import postgres from 'postgres';

/**
 * Postgres connection.
 *
 * Serverless notes, because both of these will bite otherwise:
 *
 *  - Use Supabase's TRANSACTION pooler (port 6543), not the direct connection.
 *    A serverless function may be frozen mid-request; a pooled connection is
 *    handed back rather than left dangling.
 *  - `prepare: false` is mandatory with the transaction pooler. Prepared
 *    statements are per-session, and the pooler hands you a different backend
 *    session each time, so a prepared statement is never found.
 *
 * The client is pinned to globalThis so hot reloads and warm lambda invocations
 * reuse one pool instead of opening a new one per module evaluation.
 */

const globalRef = globalThis as unknown as { __bwc_sql?: ReturnType<typeof postgres> };

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (globalRef.__bwc_sql) return globalRef.__bwc_sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The app falls back to the local JSON store when it is absent — ' +
        'this function should not have been reached.',
    );
  }

  const client = postgres(url, {
    // Required for the transaction pooler; harmless on a direct connection.
    prepare: false,

    /**
     * Enough connections to cover the widest concurrent batch, PLUS headroom.
     *
     * Raised from 6 to 10 because 6 was exactly the size of the largest batch
     * (`hydrateAppointments` before it was split), leaving zero headroom — any
     * concurrent query queued behind the batch, and against Supabase's
     * transaction pooler that queue can stall indefinitely. Every admin page
     * that hung "loaded forever" was symptoms of this saturation.
     *
     * `hydrateAppointments` now runs in two waves of three, so 10 leaves plenty
     * of room for a page's own reads on top. Supabase's free tier allows up to
     * 200 concurrent connections against the pooler; 10 per instance is safe
     * even with many warm serverless instances.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),

    /**
     * The settings below exist because of a real incident: requests to /admin
     * hung and were killed by the platform after **300 seconds**. That is not
     * latency — the round trip to the database is ~100ms. It is a connection
     * that the driver believed was alive and that would never answer, because
     * a serverless instance can be frozen mid-request and thawed much later
     * with its sockets long dead.
     *
     * Three independent guards, so no single failure can hang a request again:
     */

    /**
     * 1. Never wait forever for a query. Enforced by Postgres itself, so it
     *    holds even if the client's own bookkeeping is confused.
     *
     *    The limit is deliberately different during a build. A 10s cap is
     *    right for a request — nobody should wait longer, and a stalled
     *    connection must fail rather than hang. But the build pre-renders
     *    pages from a machine in a different region to the database, on a
     *    cold pool, and there 10s is not enough: the build died with Postgres
     *    error 57014 ("canceling statement due to statement timeout") while
     *    collecting data for /resources/[slug].
     *
     *    This is invisible locally, because a local build has no DATABASE_URL
     *    and never touches Postgres at all.
     */
    connection: {
      statement_timeout:
        process.env.NEXT_PHASE === 'phase-production-build' ? 60_000 : 10_000,
    },

    // 2. Retire connections quickly so a frozen instance cannot come back and
    //    reuse a socket that died while it was suspended.
    idle_timeout: 10,
    max_lifetime: 300,

    // 3. Fail fast when a new connection cannot be established, rather than
    //    sitting on it until the platform kills the whole invocation. Relaxed
    //    during a build for the same reason as the statement timeout above —
    //    a build's first connection is always cold and cross-region.
    connect_timeout: process.env.NEXT_PHASE === 'phase-production-build' ? 30 : 8,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
    // Timestamps are handled as ISO strings throughout the app; let pg hand
    // back Date objects and convert at the row-mapping boundary instead of
    // guessing at parse time.
    onnotice: () => {},
  });

  globalRef.__bwc_sql = client;
  return client;
}

/** Postgres error code for a violated exclusion constraint (no-overlap). */
export const EXCLUSION_VIOLATION = '23P01';
/** Postgres error code for a violated unique constraint. */
export const UNIQUE_VIOLATION = '23505';

export function isPgError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

/* --------------------------------------------------------------- mapping */

/** Postgres hands back Date; the app speaks ISO strings everywhere. */
export function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function isoRequired(value: Date | string): string {
  return iso(value) as string;
}

/** `date` columns come back as Date at UTC midnight; we want YYYY-MM-DD. */
export function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** `time` columns come back as HH:MM:SS; the app uses HH:MM. */
export function timeOnly(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.slice(0, 5);
}
