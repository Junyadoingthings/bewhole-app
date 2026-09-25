import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { createNotification, createNotificationLog } from '@/lib/db';
import { outboundTimeout } from '@/lib/outbound';
import type { NotificationChannel } from '@/types';

/**
 * Notification abstraction.
 *
 * Nothing in the app calls Resend, Twilio or the WhatsApp Cloud API directly.
 * Callers describe a message and the channels it should go out on; the adapters
 * below decide how (or whether) to deliver it. Without credentials every send
 * is written to notification_logs and surfaced in the admin Notifications
 * screen, so the automation is fully observable in development.
 */

export interface SendInput {
  channels: NotificationChannel[];
  to: { email?: string | null; phone?: string | null; userId?: string | null };
  subject: string;
  /** Plain text body. Email adapters wrap it in the branded HTML shell. */
  body: string;
  /** Deep link included in the in-app notification. */
  href?: string | null;
  /**
   * Structured facts — appointment date, venue, reference. Rendered as a
   * table in email rather than sentences, because someone opening this on a
   * phone is scanning for "when and where", not reading prose.
   */
  details?: { label: string; value: string }[];
  /**
   * A single action. One per message on purpose: an email offering two things
   * to click gets neither done. The URL is repeated in the plain-text part so
   * it survives clients that strip HTML.
   */
  cta?: { label: string; url: string } | null;
  type: string;
  audience?: 'client' | 'staff';
  /** When set, the message is queued for a cron worker rather than sent now. */
  scheduledFor?: string | null;
}

interface Adapter {
  channel: NotificationChannel;
  live: boolean;
  send(input: SendInput): Promise<{ ok: boolean; error?: string }>;
}

/* ------------------------------------------------------------------- email */

const emailAdapter: Adapter = {
  channel: 'email',
  get live() {
    return Boolean(process.env.RESEND_API_KEY);
  },
  async send(input) {
    if (!input.to.email) return { ok: false, error: 'No email address on file' };
    if (!this.live) return { ok: true }; // logged only

    try {
      const logo = embeddedLogo();
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: outboundTimeout(),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'Be Whole Care <bookings@bewholecare.co.za>',
          // The sending domain has no inbox, so a reply to the From address
          // bounces — and a sender nobody can reply to reads as spam to both
          // clients and filters. Replies go to the practice's real mailbox.
          reply_to: process.env.EMAIL_REPLY_TO ?? 'bewholecare@gmail.com',
          to: [input.to.email],
          subject: input.subject,
          html: emailShell(input.subject, input.body, input.details, input.cta, Boolean(logo)),
          text: plainText(input),
          // Embedded, not linked. A logo loaded from our own site failed
          // silently for as long as the domain had a problem — and even
          // once that is fixed, most mail clients block remote images by
          // default until the person taps "load images". Attaching it as
          // an inline part means it renders immediately, every time, with
          // no request to anywhere.
          ...(logo ? { attachments: [logo] } : {}),
        }),
      });
      if (!res.ok) return { ok: false, error: `Email provider returned ${res.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Email send failed' };
    }
  },
};

/**
 * The logo, read once and reused for every email sent by this instance.
 *
 * Resend embeds a base64 attachment under a `content_id`, which the HTML
 * references as `cid:<id>` — the standard way an email carries its own
 * image instead of fetching one. Returns null (and the shell falls back to a
 * text wordmark) if the file is ever missing, rather than sending a broken
 * image tag.
 */
let cachedLogo: { filename: string; content: string; content_id: string } | null | undefined;
function embeddedLogo(): { filename: string; content: string; content_id: string } | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const file = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
    cachedLogo = { filename: 'logo.png', content: file.toString('base64'), content_id: 'bwc-logo' };
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

/* ---------------------------------------------------------------- whatsapp */

const whatsappAdapter: Adapter = {
  channel: 'whatsapp',
  get live() {
    return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
  },
  async send(input) {
    if (!input.to.phone) return { ok: false, error: 'No mobile number on file' };
    if (!this.live) return { ok: true };

    try {
      const res = await fetch(process.env.WHATSAPP_API_URL as string, {
        method: 'POST',
        signal: outboundTimeout(),
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizeMsisdn(input.to.phone),
          type: 'text',
          text: { body: `${input.subject}\n\n${input.body}` },
        }),
      });
      if (!res.ok) return { ok: false, error: `WhatsApp provider returned ${res.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'WhatsApp send failed' };
    }
  },
};

/* --------------------------------------------------------------- sms, push */

const smsAdapter: Adapter = {
  channel: 'sms',
  live: false,
  async send(input) {
    return input.to.phone ? { ok: true } : { ok: false, error: 'No mobile number on file' };
  },
};

const pushAdapter: Adapter = {
  channel: 'push',
  live: false,
  async send() {
    // Web Push subscriptions are stored per-device; wired up with the PWA.
    return { ok: true };
  },
};

const ADAPTERS: Record<Exclude<NotificationChannel, 'in_app'>, Adapter> = {
  email: emailAdapter,
  whatsapp: whatsappAdapter,
  sms: smsAdapter,
  push: pushAdapter,
};

/* ------------------------------------------------------------------- send */

export async function notify(input: SendInput): Promise<void> {
  const audience = input.audience ?? 'client';

  // In-app record first — it is the one channel that cannot fail.
  if (input.channels.includes('in_app') || audience === 'staff' || input.to.userId) {
    await createNotification({
      userId: input.to.userId ?? null,
      audience,
      type: input.type,
      title: input.subject,
      body: input.body,
      href: input.href ?? null,
    });
  }

  for (const channel of input.channels) {
    if (channel === 'in_app') continue;
    const adapter = ADAPTERS[channel];
    if (!adapter) continue;

    const recipient = channel === 'email' ? input.to.email : input.to.phone;
    if (!recipient) continue;

    // Scheduled messages are queued for the cron worker, not sent now.
    if (input.scheduledFor && new Date(input.scheduledFor).getTime() > Date.now()) {
      await createNotificationLog({
        channel,
        to: recipient,
        subject: input.subject,
        // The worker that sends this later has nothing else to send.
        body: input.body,
        href: input.href ?? null,
        status: 'queued',
        provider: adapter.live ? adapter.channel : `${adapter.channel}:log-only`,
        scheduledFor: input.scheduledFor,
      });
      continue;
    }

    const result = await adapter.send(input);
    await createNotificationLog({
      channel,
      to: recipient,
      subject: input.subject,
      body: input.body,
      href: input.href ?? null,
      status: result.ok ? 'sent' : 'failed',
      provider: adapter.live ? adapter.channel : `${adapter.channel}:log-only`,
      error: result.error ?? null,
      sentAt: result.ok ? new Date().toISOString() : null,
    });
  }
}

function normalizeMsisdn(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

/**
 * The plain-text alternative.
 *
 * Not an afterthought: some clients render it instead of the HTML, and spam
 * filters weigh a missing or mismatched text part against the sender. The
 * details and the action URL both have to appear here, or a client reading
 * text-only would get a confirmation with no date and no way to pay.
 */
function plainText(input: SendInput): string {
  const parts = [input.body];
  if (input.details?.length) {
    parts.push(input.details.map((d) => `${d.label}: ${d.value}`).join('\n'));
  }
  if (input.cta) parts.push(`${input.cta.label}:\n${input.cta.url}`);
  return parts.join('\n\n');
}

/**
 * The branded email shell.
 *
 * Modelled on the receipts Apple sends for the App Store and Apple Music: a
 * plain pale backdrop, one white card with generously rounded corners and no
 * heavy borders, a logo that sits above the card rather than boxed inside it,
 * and a details block that reads as a receipt — a small muted label sitting
 * above a large, confident value, each row separated by a hairline rather
 * than a filled panel. One accent colour throughout (the brand forest green),
 * used only where something can be tapped.
 *
 * Inline styles throughout, and no CSS class or <style> block anywhere —
 * Gmail strips <style> tags entirely, so anything placed there simply would
 * not exist for a large share of recipients.
 */
function emailShell(
  subject: string,
  body: string,
  details?: { label: string; value: string }[],
  cta?: { label: string; url: string } | null,
  hasLogo = false,
) {
  const FOREST = '#14401A'; // forest-800 — the one accent colour, tailwind.config.ts
  const INK = '#1C231A';
  const INK_SOFT = '#5B6357';
  const INK_FAINT = '#8B9285';
  const HAIRLINE = '#E9E4D8';
  const CANVAS = '#F6F3EB'; // cream-100-ish backdrop the card floats on
  const CARD = '#FFFFFF';

  const paragraphs = body
    .split('\n\n')
    .map(
      (p) =>
        `<p style="margin:0 0 15px;font-size:16px;line-height:1.6;color:${INK_SOFT};">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');

  /**
   * The receipt block: each fact on its own row, label first in small caps,
   * the value beneath it large and unambiguous — the shape of an Apple Wallet
   * pass or an App Store receipt, not a two-column form. A hairline divides
   * consecutive rows; the first and last carry none, so the block reads as
   * one continuous card rather than a stack of boxes.
   */
  const detailRows = (details ?? [])
    .map((d, i) => {
      const border = i === 0 ? '' : `border-top:1px solid ${HAIRLINE};`;
      return `<tr><td style="padding:${i === 0 ? '0 0 16px' : '16px 0'};${border}">
           <div style="font-size:11px;line-height:1.4;letter-spacing:0.06em;text-transform:uppercase;color:${INK_FAINT};margin:${i === 0 ? '0' : '15px'} 0 5px;">${escapeHtml(d.label)}</div>
           <div style="font-size:17px;line-height:1.35;color:${INK};font-weight:600;">${escapeHtml(d.value)}</div>
         </td></tr>`;
    })
    .join('');

  const detailBlock = detailRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 26px;">${detailRows}</table>`
    : '';

  /**
   * A table-wrapped anchor rather than a styled <a> or a <button>. Outlook on
   * Windows renders through Word, which ignores padding on an inline element —
   * the button would collapse to bare underlined text. This shape is the one
   * that survives everywhere.
   */
  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 22px;">
         <tr><td align="center" bgcolor="${FOREST}" style="border-radius:14px;">
           <a href="${escapeHtml(cta.url)}"
              style="display:block;padding:15px 28px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:14px;text-align:center;">
             ${escapeHtml(cta.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:${INK_FAINT};word-break:break-all;">
         If the button does not work, copy this into your browser:<br/>${escapeHtml(cta.url)}
       </p>`
    : '';

  // The logo lives on the outer canvas, above the card — not boxed inside it —
  // exactly where Apple's own receipt emails place their icon. A recipient
  // whose mail client is still fetching the attachment (or has none) sees the
  // wordmark instead of a broken image, never a blank gap.
  const logoBlock = hasLogo
    ? `<img src="cid:bwc-logo" width="132" height="79" alt="Be Whole Care" style="display:block;width:132px;height:auto;margin:0 auto;" />`
    : `<div style="font-family:-apple-system,'SF Pro Display',Segoe UI,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${FOREST};letter-spacing:-0.01em;">Be Whole Care</div>`;

  return `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body style="margin:0;background:${CANVAS};padding:40px 16px;font-family:-apple-system,'SF Pro Text',Segoe UI,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          ${logoBlock}
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" style="background:${CARD};border-radius:28px;">
            <tr><td style="padding:36px 32px 32px;">
              <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;color:${INK};font-weight:700;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
              ${paragraphs}
              ${detailBlock}
              ${ctaBlock}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 16px 0;">
          <div style="font-size:12px;line-height:1.7;color:${INK_FAINT};text-align:center;">
            Be Whole Care &middot; 063 883 7170 &middot; bewholecare@gmail.com<br/>
            A renewed mind, a prospering soul.
          </div>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function activeChannels(): { channel: NotificationChannel; live: boolean }[] {
  return [
    { channel: 'email', live: emailAdapter.live },
    { channel: 'whatsapp', live: whatsappAdapter.live },
    { channel: 'sms', live: smsAdapter.live },
    { channel: 'push', live: pushAdapter.live },
    { channel: 'in_app', live: true },
  ];
}

/**
 * Deliver one already-queued message through a single channel.
 *
 * Used by the reminder worker: `notify()` queues the row when a message is
 * scheduled for the future, and this sends that exact row when it comes due.
 */
export async function sendQueued(input: {
  channel: NotificationChannel;
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.channel === 'in_app') return { ok: true };
  const adapter = ADAPTERS[input.channel];
  if (!adapter) return { ok: false, error: `Unknown channel ${input.channel}` };

  const isEmail = input.channel === 'email';
  return adapter.send({
    channels: [input.channel],
    to: { email: isEmail ? input.to : null, phone: isEmail ? null : input.to },
    subject: input.subject,
    body: input.body,
    type: 'reminder.dispatch',
  });
}
