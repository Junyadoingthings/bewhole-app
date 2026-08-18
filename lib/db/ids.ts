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
 * Human-facing booking reference, e.g. BWC-7F3K2Q.
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
