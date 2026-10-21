import 'server-only';

import crypto from 'node:crypto';

/**
 * The Outlook refresh token is a long-lived key to the practitioner's
 * calendar, so it is never stored in plain text: AES-256-GCM with a key
 * derived from SESSION_SECRET (which never leaves the server). Rotating
 * SESSION_SECRET simply means reconnecting Outlook once.
 */
function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be set.');
  }
  const ikm = Buffer.from(secret || 'bwc-development-only-secret-do-not-use-in-production');
  return Buffer.from(crypto.hkdfSync('sha256', ikm, Buffer.alloc(0), Buffer.from('bwc:outlook-token:v1'), 32));
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, body] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unrecognised token format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
