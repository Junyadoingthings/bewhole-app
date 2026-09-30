/**
 * For calling a server action from a button.
 *
 * A server action normally answers `{ ok, error }`. If the request itself
 * fails — the connection drops, or the server runs out of time — the promise
 * rejects instead, and a button that awaited it without this stays on its
 * spinner for good. That is how "Accept & confirm" got stuck.
 *
 * The work may still have been saved before the failure, so the message asks
 * for a refresh rather than a retry.
 */
export async function settle<T extends { ok: boolean; error?: string }>(
  request: Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await request;
  } catch {
    return {
      ok: false,
      error: 'We could not confirm that this went through. Refresh the page to check before trying again.',
    };
  }
}
