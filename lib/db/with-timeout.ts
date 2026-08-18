import 'server-only';

/**
 * Resolve a data load, or give up after `ms` and return `fallback`.
 *
 * This exists because of a specific, repeated production failure: /admin would
 * show a blank page and then, after ~300 seconds, the generic error page. 300s
 * is Vercel's function limit — the render was not crashing, it was HANGING.
 *
 * The cause is connection-pool starvation, not a slow query. A full /admin
 * render fires the layout's query batch AND the dashboard's batch concurrently.
 * When more queries are in flight than the pool has connections, the extra ones
 * queue waiting for a connection to free. That wait has NO timeout —
 * `statement_timeout` cannot fire on a query that has not started, and against
 * Supabase's transaction pooler a stuck connection can keep the queue blocked
 * until the platform kills the whole invocation.
 *
 * A single sick query therefore froze the entire admin console — and sign-in
 * with it, because the login redirect does not complete until /admin renders.
 *
 * Guarding here means the page ALWAYS returns within `ms`. If the data is not
 * back in time the caller renders a degraded-but-usable view instead of
 * hanging. Correct-but-slow is never worth a five-minute white screen on a page
 * someone needs to run their practice.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  ms = 7000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[bwc] data load exceeded ${ms}ms — rendering fallback`);
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
