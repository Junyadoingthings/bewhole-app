import 'server-only';

import crypto from 'node:crypto';

/**
 * Signed, expiring links for things a client must be able to do from an email
 * without signing in.
 *
 * Booking creates passwordless accounts — a client who books has never chosen
 * a password. Sending them to a login screen to pay for a session they have
 * already booked would lose most of them, so the link itself carries the
 * authority, in the same way a password-reset link does.
 *
 * The shape is `<payload>.<hmac>`, where payload is base64url JSON holding the
 * purpose, the subject id and an expiry. Three properties matter:
 *
 *   scoped    a link minted to pay for appointment A cannot be replayed
 *             against appointment B, or reused for any other purpose, because
 *             both are inside the signed payload.
 *   expiring  the expiry is signed, so it cannot be edited by the holder.
 *   opaque    the HMAC uses SESSION_SECRET, which never leaves the server.
 *
 * These links are bearer credentials: whoever holds one can act. That is
 * acceptable here because the action is "pay your own invoice", which is not
 * useful to an attacker, and the link reveals nothing on its own. Never widen
 * this to anything that exposes clinical information.
 */

export type LinkPurpose = 'appointment-payment';

interface Payload {
  /** Purpose, so a token for one action cannot be spent on another. */
  p: LinkPurpose;
  /** Subject id — the appointment, here. */
  s: string;
  /** Expiry, epoch seconds. */
  e: number;
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set to a 32+ character value in production.');
  }
  return 'bwc-development-only-secret-do-not-use-in-production';
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Default: a fortnight. Long enough to survive a holiday, short enough to expire. */
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60;

export function createLinkToken(
  purpose: LinkPurpose,
  subjectId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const payload: Payload = {
    p: purpose,
    s: subjectId,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the subject id, or null for anything not currently valid.
 *
 * Deliberately returns one flat null rather than a reason: the caller renders
 * the same "this link is no longer valid" page either way, and distinguishing
 * "bad signature" from "expired" would tell a probe which of the two it got
 * wrong.
 */
export function readLinkToken(purpose: LinkPurpose, token: string | undefined): string | null {
  if (!token) return null;

  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;

  const encoded = token.slice(0, idx);
  const mac = token.slice(idx + 1);

  const expected = sign(encoded);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload;
    if (payload.p !== purpose) return null;
    if (typeof payload.e !== 'number' || payload.e * 1000 < Date.now()) return null;
    if (typeof payload.s !== 'string' || !payload.s) return null;
    return payload.s;
  } catch {
    return null;
  }
}

/** Absolute URL for an email. Relative links do not work in an inbox. */
export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5600').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function appointmentPaymentUrl(appointmentId: string): string {
  return appUrl(`/pay/appointment/${createLinkToken('appointment-payment', appointmentId)}`);
}
