import crypto from 'node:crypto';

/**
 * Identifier helpers, shared by both data layers.
 *
 * Ids are generated in the application rather than by the database so that a
 * row created against the JSON store and one created against Postgres are
 * indistinguishable, and so an id is known before the insert is attempted.
 */

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

export function nowISO() {
  return new Date().toISOString();
}

/**
 * The booking reference clients see, which the practice also uses as the
 * invoice number: BWC0001, BWC0002, … — gapless and in booking order. The
 * number comes from a counter that is advanced in the same transaction as the
 * booking is saved (see createAppointmentIfFree), so a booking that fails to
 * save never uses one up. Past 9999 it simply grows: BWC10000.
 */
export function invoiceNumber(n: number) {
  return `BWC${String(n).padStart(4, '0')}`;
}

/**
 * The old random reference, e.g. BWC-7F3K2Q. Bookings made before the switch
 * to invoice numbers keep theirs; only local demo data still creates them.
 * The alphabet omits I, O, 0 and 1 so a reference read aloud over the phone
 * cannot be transcribed ambiguously.
 */
export function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `BWC-${out}`;
}
