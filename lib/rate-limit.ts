import 'server-only';

/**
 * In-process sliding-window rate limiter.
 *
 * Sized for a single-instance deployment. On Vercel with multiple lambdas this
 * is per-instance and should be moved behind Upstash/Redis — the interface is
 * deliberately narrow so that swap is a one-file change.
 */

type Bucket = { hits: number[]; blockedUntil?: number };

const globalRef = globalThis as unknown as { __bwc_rl?: Map<string, Bucket> };
const buckets = (globalRef.__bwc_rl ??= new Map<string, Bucket>());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number; blockMs?: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);

  if (bucket.hits.length >= options.limit) {
    bucket.blockedUntil = now + (options.blockMs ?? options.windowMs);
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map does not grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (!b.hits.length && (!b.blockedUntil || b.blockedUntil < now)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: options.limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export const LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000, blockMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000, blockMs: 30 * 60_000 },
  booking: { limit: 12, windowMs: 60 * 60_000 },
  availability: { limit: 240, windowMs: 60_000 },
  contact: { limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  assistant: { limit: 30, windowMs: 10 * 60_000 },
} as const;

/** Best-effort caller identity for rate-limit keys. Never used for auth. */
export function clientKey(headers: Headers, scope: string) {
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'local';
  return `${scope}:${ip}`;
}
