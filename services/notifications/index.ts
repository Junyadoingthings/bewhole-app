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
  /**
   * The message itself, as paragraphs separated by a blank line. No greeting
   * and no sign-off — client emails get both from the shell ("Dear …," and
   * "Kind regards"), so every message opens and closes the same way.
   *
   * Never put a long web address inside a sentence: a long unbroken URL
   * cannot wrap, which forces the email wider than a phone screen and makes
   * the mail app shrink the whole message to fit. Links belong in `cta`,
   * `links`, or a paragraph of their own (below).
   *
   * A few paragraph forms lay out an email the practice has worded itself:
   *   "## Title"        a section heading
   *   "• item" lines    a bulleted list (lines before the first are its lead-in)
   *   a bare https URL  a tappable link, shown as written
   *   "{{details}}"     where the details block goes (default: after the body)
   *   "{{cta}}"         where the button goes (default: after the details)
   */
  body: string;
  /**
   * Replaces the default "Kind regards, Be Whole Care". First line is the
   * closing ("Warm regards,"), second the name, the rest smaller beneath it.
   */
  signOff?: string[];
  /** The heading inside the email. Defaults to the subject line. */
  heading?: string;
  /** The client's first name, for "Dear …,". Omit for staff messages. */
  greeting?: string | null;
  /**
   * The whole opening line, used as written in place of "Dear …," — for a
   * message the practice has worded itself, e.g. "Good day,".
   */
  salutation?: string | null;
  /**
   * Secondary links shown as short, tappable lines under the details — e.g.
   * "Add to Google Calendar". The label is what the reader sees; the URL
   * never appears in the text.
   */
  links?: { label: string; url: string }[];
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
          html: emailShell(input, Boolean(logo)),
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
          text: { body: `${input.subject}\n\n${plainText(input)}` },
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
        // The worker that sends this later has nothing else to send, so the
        // whole message goes in — greeting, details and links included.
        body: serializeQueued(input),
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

/**
 * An email that carries a secret, such as a password verification code.
 *
 * Unlike notify(), the message body is never stored: there is no in-app copy,
 * and the email log records that it was sent but not what it said. The result
 * is returned so the caller can tell the person if it did not go out.
 */
export async function sendSecurityEmail(
  input: Omit<SendInput, 'channels' | 'scheduledFor'>,
): Promise<{ ok: boolean; error?: string }> {
  const message: SendInput = { ...input, channels: ['email'] };
  const result = await emailAdapter.send(message);
  // Local development has no email provider; show the message in the dev
  // server's terminal so the flow can be tested. Never in production.
  if (!emailAdapter.live && process.env.NODE_ENV !== 'production') {
    console.info(`[dev email to ${input.to.email}] ${input.subject}\n${input.body}`);
  }
  if (input.to.email) {
    await createNotificationLog({
      channel: 'email',
      to: input.to.email,
      subject: input.subject,
      body: '[Security email: the content is not stored.]',
      href: null,
      status: result.ok ? 'sent' : 'failed',
      provider: emailAdapter.live ? 'email' : 'email:log-only',
      error: result.error ?? null,
      sentAt: result.ok ? new Date().toISOString() : null,
    });
  }
  return result;
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
  const details = input.details?.length
    ? input.details.map((d) => `${d.label}: ${d.value}`).join('\n')
    : '';
  const cta = input.cta ? `${input.cta.label}:\n${input.cta.url}` : '';
  const blocks = input.body.split('\n\n').filter(Boolean);
  const hasDetailsSlot = blocks.some((b) => b.trim() === DETAILS_SLOT);
  const hasCtaSlot = blocks.some((b) => b.trim() === CTA_SLOT);

  const parts: string[] = [];
  if (input.salutation) parts.push(input.salutation);
  else if (input.greeting) parts.push(`Dear ${input.greeting},`);
  for (const block of blocks) {
    const text = block.trim();
    if (text === DETAILS_SLOT) parts.push(details);
    else if (text === CTA_SLOT) parts.push(cta);
    else if (text.startsWith('## ')) parts.push(text.slice(3));
    else parts.push(block);
  }
  if (!hasDetailsSlot) parts.push(details);
  if (!hasCtaSlot) parts.push(cta);
  for (const link of input.links ?? []) parts.push(`${link.label}:\n${link.url}`);
  if (isClientMessage(input)) parts.push((input.signOff ?? SIGN_OFF).join('\n'));
  return parts.filter(Boolean).join('\n\n');
}

const SIGN_OFF = ['Kind regards,', 'Be Whole Care'];
const DETAILS_SLOT = '{{details}}';
const CTA_SLOT = '{{cta}}';

function isClientMessage(input: SendInput) {
  return (input.audience ?? 'client') === 'client';
}

/**
 * Queued messages are stored whole, so the reminder the worker sends hours
 * later has the same greeting, details and links as a message sent at once.
 * Rows queued before this format existed hold plain text and are sent as
 * they are.
 */
const QUEUED_PREFIX = 'bwc:v1:';

function serializeQueued(input: SendInput): string {
  const { subject, heading, body, greeting, salutation, details, cta, links, signOff, audience, type } =
    input;
  return (
    QUEUED_PREFIX +
    JSON.stringify({
      subject,
      heading,
      body,
      greeting,
      salutation,
      details,
      cta,
      links,
      signOff,
      audience,
      type,
    })
  );
}

function parseQueued(stored: string): Partial<SendInput> | null {
  if (!stored.startsWith(QUEUED_PREFIX)) return null;
  try {
    return JSON.parse(stored.slice(QUEUED_PREFIX.length)) as Partial<SendInput>;
  } catch {
    return null;
  }
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
 * Inline styles carry the whole design, because some clients drop <style>
 * blocks. The one <style> block in the head only pins the light theme for the
 * clients that read it (see LIGHT_ONLY_CSS); without it the email still
 * renders exactly as designed.
 *
 * Light theme only, on purpose — the practice wants the same cream-and-white
 * email in every inbox, whatever the phone's appearance setting.
 */
function emailShell(input: SendInput, hasLogo = false) {
  const { subject, body, details, cta, links, greeting, salutation: openingLine } = input;
  const heading = input.heading ?? subject;
  const FOREST = '#14401A'; // forest-800 — the one accent colour, tailwind.config.ts
  const INK = '#1C231A';
  const INK_SOFT = '#5B6357';
  const INK_FAINT = '#8B9285';
  const HAIRLINE = '#E9E4D8';
  const CANVAS = '#F6F3EB'; // cream-100-ish backdrop the card floats on
  const CARD = '#FFFFFF';

  /**
   * Keeps dark-mode mail apps from recolouring the email.
   *
   * - `color-scheme: light only` tells Apple Mail (iPhone, iPad, Mac) and
   *   other clients that follow the standard that this email has no dark
   *   version, so they leave it alone.
   * - Outlook (web, iOS, Android) recolours anyway, and marks every element it
   *   touched with `data-ogsc` (text colour) or `data-ogsb` (background). The
   *   rules below catch those marks and put the original colours back.
   *
   * Gmail's apps apply their own dark mode and ignore both; nothing in an
   * email can switch that off. Gmail on the web never darkens emails.
   */
  // Each rule matches the Outlook marker on a wrapper *or* on the element
  // itself — Outlook versions differ on where they put it.
  const restore = (marker: string, cls: string, prop: string, value: string) =>
    `[${marker}] .${cls}, .${cls}[${marker}] { ${prop}: ${value} !important; }`;
  const LIGHT_ONLY_CSS = [
    ':root { color-scheme: light only; supported-color-schemes: light only; }',
    restore('data-ogsb', 'bwc-canvas', 'background-color', CANVAS),
    restore('data-ogsb', 'bwc-card', 'background-color', CARD),
    restore('data-ogsb', 'bwc-button', 'background-color', FOREST),
    restore('data-ogsc', 'bwc-ink', 'color', INK),
    restore('data-ogsc', 'bwc-soft', 'color', INK_SOFT),
    restore('data-ogsc', 'bwc-faint', 'color', INK_FAINT),
    restore('data-ogsc', 'bwc-brand', 'color', FOREST),
    restore('data-ogsc', 'bwc-on-accent', 'color', '#FFFFFF'),
  ].join('\n');

  /**
   * Every text block may wrap anywhere. A single long unbroken string — a web
   * address, a reference — used to push the email wider than a phone screen,
   * and the mail app then shrank the entire message to fit, so it displayed at
   * a fraction of its size. `overflow-wrap:anywhere` keeps any such string
   * inside the card.
   */
  const WRAP = 'word-break:break-word;overflow-wrap:anywhere;';

  const paragraph = (text: string, extra = '') =>
    `<p class="bwc-soft" style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${INK_SOFT};${WRAP}${extra}">${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`;

  const isClient = isClientMessage(input);
  const salutation = openingLine
    ? paragraph(openingLine, `color:${INK};`)
    : greeting
      ? paragraph(`Dear ${greeting},`, `color:${INK};`)
      : '';

  const [closing, name, ...credentials] = input.signOff ?? SIGN_OFF;
  const signOff = isClient
    ? `<p class="bwc-soft" style="margin:8px 0 0;font-size:16px;line-height:1.65;color:${INK_SOFT};">${escapeHtml(closing)}<br/><span class="bwc-ink" style="color:${INK};font-weight:600;">${escapeHtml(name ?? '')}</span>${credentials
        .map((line) => `<br/><span class="bwc-soft" style="font-size:14px;line-height:1.6;color:${INK_SOFT};">${escapeHtml(line)}</span>`)
        .join('')}</p>`
    : '';

  const sectionHeading = (text: string) =>
    `<h2 class="bwc-ink" style="margin:28px 0 12px;font-size:17px;line-height:1.35;color:${INK};font-weight:700;${WRAP}">${escapeHtml(text)}</h2>`;

  // Shown as written. <wbr> after each "/" and "." lets a long address wrap
  // at a natural point ("…psychologytoday.com/" | "bewholecare") instead of
  // mid-word; `overflow-wrap:anywhere` stays as the last resort.
  const linkParagraph = (url: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;${WRAP}"><a class="bwc-brand" href="${escapeHtml(url)}" style="color:${FOREST};font-weight:600;text-decoration:underline;${WRAP}">${escapeHtml(url).replace(/([/.])(?=[^/])/g, '$1<wbr>')}</a></p>`;

  // A lead-in ("Kindly ensure that you:") followed by "• " lines. A table,
  // not <ul>: Outlook's Word engine indents lists unpredictably.
  const bulletList = (block: string) => {
    const lines = block.split('\n');
    const lead = lines.filter((l) => !l.startsWith('• ')).join('\n');
    const items = lines
      .filter((l) => l.startsWith('• '))
      .map(
        (l) =>
          `<tr><td valign="top" class="bwc-soft" style="width:18px;padding:0 0 8px;font-size:16px;line-height:1.6;color:${INK_SOFT};">&bull;</td><td class="bwc-soft" style="padding:0 0 8px;font-size:16px;line-height:1.6;color:${INK_SOFT};${WRAP}">${escapeHtml(l.slice(2))}</td></tr>`,
      )
      .join('');
    return `${lead ? paragraph(lead, 'margin-bottom:8px;') : ''}<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;">${items}</table>`;
  };

  // The line most inboxes show under the subject. Without it they show the
  // first text they find, which is the logo's alt text.
  const firstSentence = body
    .split('\n\n')
    .map((b) => b.trim())
    .find((b) => b && !b.startsWith('{{') && !b.startsWith('## '));
  const preheader = escapeHtml(firstSentence?.replace(/\n/g, ' ').slice(0, 140) ?? '');

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
           <div class="bwc-faint" style="font-size:11px;line-height:1.4;letter-spacing:0.06em;text-transform:uppercase;color:${INK_FAINT};margin:${i === 0 ? '0' : '15px'} 0 5px;">${escapeHtml(d.label)}</div>
           <div class="bwc-ink" style="font-size:17px;line-height:1.35;color:${INK};font-weight:600;${WRAP}">${escapeHtml(d.value)}</div>
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
         <tr><td class="bwc-button" align="center" bgcolor="${FOREST}" style="border-radius:14px;background-color:${FOREST};">
           <a class="bwc-on-accent" href="${escapeHtml(cta.url)}"
              style="display:block;padding:15px 28px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:14px;text-align:center;">
             ${escapeHtml(cta.label)}
           </a>
         </td></tr>
       </table>
       <p class="bwc-faint" style="margin:0 0 22px;font-size:12px;line-height:1.6;color:${INK_FAINT};">
         If the button does not work, copy this address into your browser:<br/>
         <span style="font-size:11px;line-height:1.5;word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(cta.url)}</span>
       </p>`
    : '';

  // Secondary links: a short label the reader can tap, never the address
  // itself. Separated from the details by the same hairline.
  const linkRows = (links ?? [])
    .map(
      (l) =>
        `<tr><td style="padding:12px 0;border-top:1px solid ${HAIRLINE};">
           <a class="bwc-brand" href="${escapeHtml(l.url)}" style="font-size:15px;font-weight:600;color:${FOREST};text-decoration:none;">${escapeHtml(l.label)}&nbsp;&rsaquo;</a>
         </td></tr>`,
    )
    .join('');
  const linkBlock = linkRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">${linkRows}</table>`
    : '';

  // The body, in order, with the details block and the button placed wherever
  // the message puts {{details}} / {{cta}} (after the text when it does not).
  let detailsPlaced = false;
  let ctaPlaced = false;
  const paragraphs = body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const text = block.trim();
      if (text === DETAILS_SLOT) {
        detailsPlaced = true;
        return detailBlock;
      }
      if (text === CTA_SLOT) {
        ctaPlaced = true;
        return ctaBlock;
      }
      if (text.startsWith('## ')) return sectionHeading(text.slice(3));
      if (/^https?:\/\/\S+$/.test(text)) return linkParagraph(text);
      if (text.split('\n').some((l) => l.startsWith('• '))) return bulletList(text);
      return paragraph(text);
    })
    .join('');

  // The logo lives on the outer canvas, above the card — not boxed inside it —
  // exactly where Apple's own receipt emails place their icon. A recipient
  // whose mail client is still fetching the attachment (or has none) sees the
  // wordmark instead of a broken image, never a blank gap.
  const logoBlock = hasLogo
    ? `<img src="cid:bwc-logo" width="132" height="79" alt="Be Whole Care" style="display:block;width:132px;height:auto;margin:0 auto;" />`
    : `<div class="bwc-brand" style="font-family:-apple-system,'SF Pro Display',Segoe UI,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${FOREST};letter-spacing:-0.01em;">Be Whole Care</div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <!--
      Render at the phone's own width. Without this some mail apps lay the
      email out at desktop width and then scale it down to fit the screen.
    -->
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${escapeHtml(subject)}</title>
    <style>${LIGHT_ONLY_CSS}</style>
  </head>
  <body class="bwc-canvas" style="margin:0;background:${CANVAS};padding:0;font-family:-apple-system,'SF Pro Text',Segoe UI,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
    <!--
      The canvas colour is carried by this full-width table as well as <body>,
      because several clients discard the body's styles; bgcolor is the
      attribute form some of them fall back to.
    -->
    <table class="bwc-canvas" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CANVAS}" style="background-color:${CANVAS};"><tr><td align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="480" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <!-- Desktop Outlook ignores max-width; the conditional table above holds it to 480px. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
        <tr><td align="center" style="padding-bottom:24px;">
          ${logoBlock}
        </td></tr>
        <tr><td>
          <table class="bwc-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CARD}" style="background-color:${CARD};border-radius:28px;">
            <tr><td style="padding:36px 32px 32px;">
              <h1 class="bwc-ink" style="margin:0 0 20px;font-size:23px;line-height:1.3;color:${INK};font-weight:700;letter-spacing:-0.01em;${WRAP}">${escapeHtml(heading)}</h1>
              ${salutation}
              ${paragraphs}
              ${detailsPlaced ? '' : detailBlock}
              ${ctaPlaced ? '' : ctaBlock}
              ${linkBlock}
              ${signOff}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 16px 0;">
          <div class="bwc-faint" style="font-size:12px;line-height:1.7;color:${INK_FAINT};text-align:center;">
            <strong style="font-weight:600;">Be Whole Care</strong> &middot; Professional counselling services<br/>
            063 883 7170 &middot; bewholecare@gmail.com<br/>
            A renewed mind, a prospering soul.
          </div>
          ${
            isClient
              ? `<div class="bwc-faint" style="margin-top:14px;font-size:11px;line-height:1.6;color:${INK_FAINT};text-align:center;">You may reply to this email to reach our team directly.</div>`
              : ''
          }
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr></table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const stored = parseQueued(input.body);
  return adapter.send({
    // Structured rows carry the full message. Older plain-text rows (queued
    // before this format) are client reminders that already open with their
    // own "Hi …", so they are sent with no greeting added.
    ...(stored ?? { audience: 'client' as const }),
    channels: [input.channel],
    to: { email: isEmail ? input.to : null, phone: isEmail ? null : input.to },
    subject: input.subject,
    body: stored?.body ?? input.body,
    type: stored?.type ?? 'reminder.dispatch',
  });
}
