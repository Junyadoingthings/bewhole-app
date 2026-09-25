/**
 * A time limit for every request this app makes to someone else's API.
 *
 * `fetch` has no timeout of its own: a provider that accepts the connection and
 * then never answers holds the request open until the platform kills the whole
 * function, minutes later. For a booking that meant a client staring at
 * "Please wait…" with no way out. With a signal, a stalled call fails like any
 * other network error — into the catch blocks that already handle those.
 *
 * 15 seconds is well past a healthy round trip to Google, Resend, WhatsApp or
 * a payment gateway (well under a second), and short enough that a person is
 * still on the page when the failure is reported.
 */
export const OUTBOUND_TIMEOUT_MS = 15_000;

export function outboundTimeout(): AbortSignal {
  return AbortSignal.timeout(OUTBOUND_TIMEOUT_MS);
}
