import 'server-only';

import { getOutlookConnection, saveOutlookConnection } from '@/lib/db';
import { appUrl } from '@/lib/links';
import { decryptToken, encryptToken } from '@/lib/outlook/token-crypto';
import { outboundTimeout } from '@/lib/outbound';

/**
 * Microsoft Graph, for the practitioner's Outlook calendar.
 *
 * Delegated access, granted once by the practice administrator signing in to
 * Microsoft: Calendars.ReadWrite (her calendar only), offline_access (so the
 * site can keep it in sync) and User.Read (to show which account is linked).
 * The app is registered in Azure; its id and secret are MS_CLIENT_ID and
 * MS_CLIENT_SECRET (see DEPLOY.md).
 */
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
export const OUTLOOK_SCOPES = 'offline_access Calendars.ReadWrite User.Read';

export function outlookConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function outlookRedirectUri(): string {
  return appUrl('/api/outlook/callback');
}

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: outlookRedirectUri(),
    response_mode: 'query',
    scope: OUTLOOK_SCOPES,
    state,
    prompt: 'select_account',
  });
  return `${AUTHORITY}/authorize?${q.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? '',
      client_secret: process.env.MS_CLIENT_SECRET ?? '',
      scope: OUTLOOK_SCOPES,
      ...params,
    }).toString(),
    cache: 'no-store',
    signal: outboundTimeout(),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    // Microsoft's error codes only — never the token request itself.
    throw new Error(`Microsoft sign-in failed (${body.error ?? res.status})`);
  }
  return body;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: outlookRedirectUri() });
}

let cached: { token: string; expiresAt: number } | null = null;

/** A current access token, refreshing (and storing the rotated refresh token) as needed. */
export async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const connection = await getOutlookConnection();
  if (!connection) throw new Error('Outlook is not connected');
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptToken(connection.refreshTokenEnc) });
  if (t.refresh_token) {
    await saveOutlookConnection({ ...connection, refreshTokenEnc: encryptToken(t.refresh_token) });
  }
  cached = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

export function forgetAccessToken() {
  cached = null;
}

export class GraphError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Call Graph as the connected account. Times are read and written in UTC. */
export async function graph<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const token = init.token ?? (await accessToken());
  const res = await fetch(path.startsWith('https://') ? path : `${GRAPH}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'outlook.timezone="UTC"',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
    signal: outboundTimeout(),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let code = String(res.status);
    try {
      code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? code;
    } catch {
      /* not JSON */
    }
    throw new GraphError(res.status, `Outlook request failed (${code})`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
