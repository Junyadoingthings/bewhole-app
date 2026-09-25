import 'server-only';

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
          html: emailShell(input.subject, input.body, input.details, input.cta),
          text: plainText(input),
        }),
      });
      if (!res.ok) return { ok: false, error: `Email provider returned ${res.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Email send failed' };
    }
  },
};

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

/** Minimal branded HTML shell. Inline styles only — email clients demand it. */
/**
 * The public site URL, for assets that must resolve outside our own server —
 * an email client fetches images over the open internet, never from a
 * relative same-origin path. Falls back to localhost so a dev-mode send does
 * not throw; the image simply will not load there, which is expected.
 */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5600').replace(/\/+$/, '');
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

function emailShell(
  subject: string,
  body: string,
  details?: { label: string; value: string }[],
  cta?: { label: string; url: string } | null,
) {
  const paragraphs = body
    .split('\n\n')
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#4A5347;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');

  /**
   * Details table. Left column muted, right column ink and semibold, so the
   * answer to "when is it?" wins the glance. Inline styles throughout — Gmail
   * strips <style> blocks, so anything in a stylesheet simply would not exist.
   */
  const detailRows = (details ?? [])
    .map(
      (d, i) =>
        `<tr>
           <td style="padding:${i === 0 ? '0' : '10px'} 16px 10px 0;font-size:14px;line-height:1.5;color:#6E766B;white-space:nowrap;vertical-align:top;">${escapeHtml(d.label)}</td>
           <td style="padding:${i === 0 ? '0' : '10px'} 0 10px;font-size:14px;line-height:1.5;color:#141A12;font-weight:600;vertical-align:top;">${escapeHtml(d.value)}</td>
         </tr>`,
    )
    .join('');

  const detailBlock = detailRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px;padding:18px 20px;background:#F7F5EF;border-radius:16px;border:1px solid #E7E4DB;">${detailRows}</table>`
    : '';

  /**
   * A table-wrapped anchor rather than a styled <a> or a <button>. Outlook on
   * Windows renders through Word, which ignores padding on an inline element —
   * the button would collapse to bare underlined text. This shape is the one
   * that survives everywhere.
   */
  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
         <tr><td align="center" bgcolor="#1E4620" style="border-radius:999px;">
           <a href="${escapeHtml(cta.url)}"
              style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">
             ${escapeHtml(cta.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#6E766B;word-break:break-all;">
         If the button does not work, copy this into your browser:<br/>${escapeHtml(cta.url)}
       </p>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#F5F2EA;padding:32px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid #E7E4DB;">
      <tr><td align="center" style="padding:28px 32px 0;">
        <!--
          The real logo file, not a text wordmark. Explicit width/height (not
          just CSS) because several major email clients strip <style> blocks
          entirely and need the attributes to reserve layout space before the
          image loads — without them the logo can flash in at native size or
          collapse the row. Sits on the card's white background, which is
          deliberate: the PNG is transparent, and rendering it directly on a
          dark-mode email client's own background can make the ink-coloured
          wordmark unreadable.
        -->
        <img
          src="${siteUrl()}/logo.png"
          width="140"
          height="84"
          alt="Be Whole Care"
          style="display:block;width:140px;height:auto;"
        />
      </td></tr>
      <tr><td style="padding:16px 32px 8px;">
        <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#141A12;font-weight:600;">${escapeHtml(subject)}</h1>
        ${paragraphs}
        ${detailBlock}
        ${ctaBlock}
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">
        <div style="border-top:1px solid #E7E4DB;padding-top:16px;font-size:12px;line-height:1.6;color:#6E766B;">
          Be Whole Care &middot; 063 883 7170 &middot; bewholecare@gmail.com<br/>
          A renewed mind, a prospering soul.<br/><br/>
          Be Whole Care is not an emergency service. If you are in immediate danger, contact emergency services on 112 or the SADAG 24hr helpline on 0800 456 789.
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
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
