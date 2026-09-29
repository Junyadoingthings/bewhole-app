import 'server-only';

import { waitUntil } from '@vercel/functions';

import {
  audit,
  getAppointment,
  getCalendarEventForAppointment,
  getFollowUp,
  getProfile,
  getSettings,
  hydrateAppointments,
  hydrateFollowUps,
  updateAppointment,
  upsertCalendarEvent,
  withdrawQueuedNotificationLogs,
  newId,
  nowISO,
} from '@/lib/db';
import { BUSINESS } from '@/config/business';
import { addISODays, displayTime, formatFullDate, fromLocalParts, parts } from '@/lib/date';
import { appUrl, appointmentPaymentUrl } from '@/lib/links';
import { money } from '@/lib/utils';
import { getCalendarProvider } from '@/services/calendar';
import { notify } from '@/services/notifications';
import type { AppointmentView, FollowUpView, ID } from '@/types';

const PRACTICE_INBOX = { email: BUSINESS.email } as const;

/**
 * House style for everything a client reads.
 *
 * Formal and calm, in the practice's own voice ("Professional. Ethical.
 * Compassionate Care."): complete sentences, no contractions, no slang, and
 * one clear message per email. Greeting ("Dear …,") and sign-off ("Kind
 * regards, Be Whole Care") are added by the email template, so bodies here
 * hold only the message. Dates are always written out in full, never as
 * "tomorrow" or "in a couple of hours": messages are sent by a worker that
 * runs once a day, and a relative time can be wrong by the time it arrives.
 * Web addresses never go in a body — see SendInput.body.
 */

export type DomainEvent =
  | { type: 'appointment.created'; appointmentId: ID }
  | { type: 'appointment.confirmed'; appointmentId: ID }
  | { type: 'appointment.calendar_sync'; appointmentId: ID }
  | { type: 'appointment.session_link_added'; appointmentId: ID }
  | { type: 'appointment.medical_aid_pending'; appointmentId: ID }
  | { type: 'appointment.medical_aid_declined'; appointmentId: ID }
  | { type: 'appointment.rescheduled'; appointmentId: ID; previousStart: string }
  | { type: 'appointment.cancelled'; appointmentId: ID; byStaff: boolean; late: boolean }
  | { type: 'appointment.completed'; appointmentId: ID }
  | { type: 'appointment.no_show'; appointmentId: ID }
  | { type: 'payment.success'; paymentId: ID; appointmentId?: ID | null; followUpId?: ID | null }
  | { type: 'payment.failed'; paymentId: ID; appointmentId?: ID | null; reason?: string }
  | { type: 'followup.created'; followUpId: ID }
  | { type: 'followup.payment_required'; followUpId: ID }
  | { type: 'followup.payment_received'; followUpId: ID }
  | { type: 'followup.confirmed'; followUpId: ID }
  | { type: 'followup.check_in'; followUpId: ID };

export async function emit(event: DomainEvent): Promise<void> {
  try {
    switch (event.type) {
      case 'appointment.created':
        await onAppointmentCreated(event.appointmentId);
        break;
      case 'appointment.medical_aid_pending':
        await onMedicalAidPending(event.appointmentId);
        break;
      case 'appointment.medical_aid_declined':
        await onMedicalAidDeclined(event.appointmentId);
        break;
      case 'appointment.confirmed':
        await onAppointmentConfirmed(event.appointmentId);
        break;
      case 'appointment.calendar_sync':
        await onCalendarSync(event.appointmentId);
        break;
      case 'appointment.session_link_added':
        await onSessionLinkAdded(event.appointmentId);
        break;
      case 'appointment.rescheduled':
        await onAppointmentRescheduled(event.appointmentId, event.previousStart);
        break;
      case 'appointment.cancelled':
        await onAppointmentCancelled(event.appointmentId, event.byStaff, event.late);
        break;
      case 'appointment.completed':
        await onAppointmentCompleted(event.appointmentId);
        break;
      case 'payment.failed':
        await onPaymentFailed(event.appointmentId ?? null, event.reason);
        break;
      default:
        break;
    }
    await audit({
      actorUserId: null,
      action: `event.${event.type}`,
      entity: 'event',
      entityId: 'appointmentId' in event ? event.appointmentId : null,
      meta: event as unknown as Record<string, unknown>,
    });
  } catch (error) {
    console.error('[bwc:events] handler failed', event.type, error);
  }
}

/**
 * Run events after the response has been sent, in order.
 *
 * For requests where a person is waiting on a spinner. Handlers call Google
 * Calendar, Resend and WhatsApp; awaiting them inline meant the client's
 * "Please wait…" lasted as long as the slowest of those services — and one that
 * stalled held the booking open until the platform killed the function, which
 * the browser saw as a request that never finished.
 *
 * The booking is already committed when this is called, so nothing here can
 * change its outcome; it only decides whether the client waits for the emails.
 * `waitUntil` keeps the serverless function alive until the chain settles, so
 * the work is not frozen mid-send once the response is out. Outside Vercel it
 * is a no-op and the chain simply runs on.
 *
 * `emit` already catches handler failures, so the chain cannot reject.
 */
export function emitAfterResponse(...events: DomainEvent[]): void {
  const chain = (async () => {
    for (const event of events) await emit(event);
  })();
  waitUntil(chain);
}

/* ------------------------------------------------------------- formatting */

async function view(appointmentId: ID): Promise<AppointmentView | null> {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return null;
  const [hydrated] = await hydrateAppointments([appointment]);
  return hydrated ?? null;
}

export function appointmentWhere(a: AppointmentView) {
  return a.mode === 'online'
    ? 'Online session'
    : a.location
      ? `${a.location.name} — ${a.location.addressLine}, ${a.location.city}, ${a.location.postalCode}`
      : 'In person';
}

function appointmentWhen(a: AppointmentView) {
  const p = parts(a.startAt);
  return `${formatFullDate(p.date)} at ${displayTime(p.time)}`;
}

/** "Wednesday, 30 September 2026" — for subject lines. */
function appointmentDate(a: AppointmentView) {
  return formatFullDate(parts(a.startAt).date);
}

function firstNameOf(a: AppointmentView) {
  return a.client?.name?.split(' ')[0] || null;
}

function clientRecipient(a: AppointmentView) {
  return { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId };
}

/** The appointment's own page — also the key its queued reminders are filed under. */
function appointmentHref(a: { id: ID }) {
  return `/portal/appointments/${a.id}`;
}

function appointmentDetails(a: AppointmentView) {
  return [
    { label: 'Service', value: a.service.name },
    { label: 'Date and time', value: appointmentWhen(a) },
    { label: 'Duration', value: `${a.durationMinutes} minutes` },
    { label: 'Location', value: appointmentWhere(a) },
    { label: 'Reference', value: a.reference },
  ];
}

/** Staff see who the client is alongside the session facts. */
function staffDetails(a: AppointmentView) {
  return [
    { label: 'Client', value: a.client?.name || 'Not captured' },
    { label: 'Email', value: a.client?.email || 'Not captured' },
    { label: 'Phone', value: a.client?.phone || 'Not captured' },
    ...appointmentDetails(a),
  ];
}

/**
 * Links for an online session and for the client's own calendar. Short labels
 * only: the Google Calendar address runs to several hundred characters, and
 * written out in the body it forced the email wider than a phone screen.
 */
function sessionLinks(a: AppointmentView, sessionLink: string | null) {
  const links: { label: string; url: string }[] = [];
  if (a.mode === 'online' && sessionLink) {
    links.push({ label: 'Join the online session', url: sessionLink });
  }
  links.push({ label: 'Add to Google Calendar', url: googleCalendarLink(a) });
  return links;
}

function googleCalendarLink(a: AppointmentView) {
  const utc = (iso: string) => new Date(iso).toISOString().replace(/-|:|\.\d+/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${a.service.name} — Be Whole Care`,
    dates: `${utc(a.startAt)}/${utc(a.endAt)}`,
    details: `Reference: ${a.reference}`,
    location: appointmentWhere(a),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function onlineLinkSentence(a: AppointmentView, sessionLink: string | null) {
  if (a.mode !== 'online') return '';
  return sessionLink
    ? 'You can join the online session using the link below.'
    : 'Your practitioner will send you the link to join the online session before your appointment.';
}

/* ------------------------------------------------------ medical aid checks */

async function onMedicalAidPending(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const profile = await getProfile(a.clientUserId);
  const scheme = profile?.medicalAid?.scheme;

  await notify({
    type: 'appointment.medical_aid_pending',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: 'Booking received — medical aid verification in progress',
    heading: 'We have received your booking',
    greeting: firstNameOf(a),
    body:
      `Thank you for booking with Be Whole Care. We have reserved the time below for you while we ` +
      `verify your medical aid cover${scheme ? ` with ${scheme}` : ''}.\n\n` +
      'No action is required from you at this stage. We will contact you once the verification is ' +
      'complete, usually within one working day. Please note that your appointment is confirmed ' +
      'only once your medical aid has been verified.',
    details: appointmentDetails(a),
    href: appointmentHref(a),
  });

  await notify({
    type: 'appointment.medical_aid_pending.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Medical aid to verify — ${a.client?.name ?? 'Client'}, ${appointmentWhen(a)}`,
    body:
      `${a.client?.name ?? 'A client'} has booked using medical aid. The appointment is reserved ` +
      'and awaiting verification.\n\n' +
      'Please accept or decline the medical aid on the appointments page. The client is notified ' +
      'automatically either way.',
    details: [
      ...staffDetails(a),
      { label: 'Scheme', value: profile?.medicalAid?.scheme || 'Not captured' },
      { label: 'Member number', value: profile?.medicalAid?.memberNumber || 'Not captured' },
      { label: 'Main member', value: profile?.medicalAid?.mainMember || 'Not captured' },
    ],
    href: `/admin/appointments?filter=medical_aid`,
  });
}

async function onMedicalAidDeclined(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const reason = a.medicalAidDeclineReason?.trim();

  await notify({
    type: 'appointment.medical_aid_declined',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: 'Update regarding your medical aid',
    heading: 'An update regarding your medical aid',
    greeting: firstNameOf(a),
    body:
      'We have completed the verification of your medical aid. Unfortunately, this session cannot ' +
      'be claimed from your scheme.\n\n' +
      (reason ? `${reason}\n\n` : '') +
      'Your appointment remains reserved. To keep it, the session may be settled by card using the ' +
      'button below. Your appointment is confirmed as soon as the payment is received.\n\n' +
      'Should you prefer to reschedule or cancel instead, please reply to this email and our team ' +
      'will assist you. No payment has been taken.',
    details: [...appointmentDetails(a), { label: 'Amount due', value: money(a.amountCents) }],
    cta: { label: 'Pay by card', url: appointmentPaymentUrl(a.id) },
    href: appointmentHref(a),
  });
}

/* --------------------------------------------------------------- handlers */

async function onAppointmentCreated(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  await notify({
    type: 'booking.created',
    audience: 'staff',
    channels: ['in_app'],
    to: {},
    subject: `New booking — ${a.service.name}`,
    body: `${a.client?.name ?? 'A client'} booked ${a.mode === 'online' ? 'an online' : 'an in-person'} session for ${appointmentWhen(a)}. Reference ${a.reference}.`,
    href: `/admin/appointments?ref=${a.reference}`,
  });

  if (a.status === 'pending_payment' && a.amountCents > 0) {
    await notify({
      type: 'payment.requested',
      audience: 'client',
      channels: [...settings.reminders.channels, 'in_app'],
      to: clientRecipient(a),
      subject: 'Payment required to confirm your appointment',
      heading: 'Your appointment is reserved',
      greeting: firstNameOf(a),
      body:
        'Thank you for booking with Be Whole Care. We have reserved the time below for you.\n\n' +
        'Your appointment will be confirmed once payment has been received. You may complete the ' +
        'payment securely using the button below.',
      details: [...appointmentDetails(a), { label: 'Amount due', value: money(a.amountCents) }],
      cta: { label: 'Complete payment', url: appointmentPaymentUrl(a.id) },
      href: appointmentHref(a),
    });
  }
}

/**
 * Keep the practice calendar in step with the appointment. Returns the
 * meeting link the calendar created, if any.
 */
async function syncCalendar(a: AppointmentView, description: string) {
  const calendar = getCalendarProvider();
  const result = await calendar.createOrUpdate({
    appointmentId: a.id,
    summary: `${a.service.name} — ${a.client?.name ?? 'Client'}`,
    description,
    location: appointmentWhere(a),
    startISO: a.startAt,
    endISO: a.endAt,
    timeZone: BUSINESS.timezone,
    attendeeEmail: a.client?.email ?? null,
    attendeeName: a.client?.name ?? null,
    conference: a.mode === 'online',
  });

  const existing = await getCalendarEventForAppointment(a.id);
  await upsertCalendarEvent({
    id: existing?.id ?? newId('cal'),
    appointmentId: a.id,
    provider: calendar.name,
    externalId: result.externalId ?? existing?.externalId ?? '',
    calendarId: calendar.calendarId,
    htmlLink: result.htmlLink ?? null,
    status: result.ok ? 'synced' : 'failed',
    lastError: result.error ?? null,
    syncedAt: result.ok ? nowISO() : (existing?.syncedAt ?? null),
    createdAt: existing?.createdAt ?? nowISO(),
    updatedAt: nowISO(),
  });

  // Keep a link staff entered by hand; otherwise take the calendar's.
  const sessionLink = a.sessionLink ?? result.meetLink ?? null;
  if (sessionLink && sessionLink !== a.sessionLink) {
    await updateAppointment(a.id, { sessionLink });
  }

  return { ok: result.ok, live: calendar.live, sessionLink };
}

function calendarDescription(a: AppointmentView) {
  return [
    `Client: ${a.client?.name ?? '—'}`,
    `Email: ${a.client?.email ?? '—'}`,
    `Phone: ${a.client?.phone ?? '—'}`,
    `Service: ${a.service.name}`,
    `Type: ${a.mode === 'online' ? 'Online' : 'In person'}`,
    `Payment: ${a.paymentMethod === 'card' ? 'Card' : 'Medical aid'} — ${money(a.amountCents)}`,
    `Reference: ${a.reference}`,
    a.reason ? `\nClient note: ${a.reason}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Staff-facing note when the practice calendar is not actually receiving events. */
function calendarNote(sync: { ok: boolean; live: boolean }) {
  if (!sync.live) {
    return '\n\nGoogle Calendar is not connected, so this appointment has not been added to the practice calendar.';
  }
  return sync.ok ? '' : '\n\nThe calendar sync failed. Please retry it from the appointment.';
}

async function onAppointmentConfirmed(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  const sync = await syncCalendar(a, calendarDescription(a));
  const sessionLink = sync.sessionLink;

  const medicalAidLine =
    a.medicalAidDecision === 'accepted'
      ? 'Your medical aid has been verified, and this session will be claimed from your scheme.' +
        (a.amountCents > 0
          ? ` A co-payment of ${money(a.amountCents)} is payable at your appointment.`
          : '')
      : '';

  await notify({
    type: 'appointment.confirmed',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: `Appointment confirmed — ${appointmentDate(a)}`,
    heading: 'Your appointment is confirmed',
    greeting: firstNameOf(a),
    body: [
      'Thank you for choosing Be Whole Care. We are pleased to confirm your appointment. The details are below.',
      medicalAidLine,
      onlineLinkSentence(a, sessionLink),
      'Should you need to reschedule or cancel, we kindly ask that you give us at least 24 hours’ notice. ' +
        'Late cancellations and missed appointments may be charged in full.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    details: appointmentDetails(a),
    links: sessionLinks(a, sessionLink),
    href: appointmentHref(a),
  });

  await notify({
    type: 'appointment.confirmed.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `New booking — ${a.client?.name ?? 'Client'}, ${appointmentWhen(a)}`,
    body: `A new appointment has been confirmed.${calendarNote(sync)}`,
    details: staffDetails(a),
    href: `/admin/appointments?ref=${a.reference}`,
  });

  // The link is passed in, not read from `a`: `a` was loaded before the
  // calendar produced it, so reminders used to go out without the link.
  await scheduleReminders(a, sessionLink);
}

/** Admin "retry calendar sync": the calendar only — no emails to anyone. */
async function onCalendarSync(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  await syncCalendar(a, calendarDescription(a));
}

/** Staff added (or changed) the link for an online session. */
async function onSessionLinkAdded(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a || a.mode !== 'online' || !a.sessionLink) return;
  if (a.status !== 'confirmed' || new Date(a.startAt).getTime() <= Date.now()) return;
  const settings = await getSettings();

  await notify({
    type: 'appointment.session_link',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: `Your online session link — ${appointmentDate(a)}`,
    heading: 'Your online session link',
    greeting: firstNameOf(a),
    body:
      'The link to join your online session is now available. Please use the button below at the ' +
      'time of your appointment. We recommend joining a few minutes early from a quiet, private space.',
    details: appointmentDetails(a),
    cta: { label: 'Join the online session', url: a.sessionLink },
    href: appointmentHref(a),
  });

  // Reminders already queued were written without the link.
  await scheduleReminders(a, a.sessionLink);
}

/**
 * Queue the appointment reminders and the post-session message.
 *
 * The reminder worker runs once a day, in the morning (Vercel Cron,
 * vercel.json). Reminders are therefore timed to that run — the morning
 * before the session and the morning of it — instead of "24 hours" and
 * "2 hours" before, which the daily worker could only ever deliver late:
 * "Your session is tomorrow" arrived on the day itself, and a "couple of
 * hours" reminder reached an 08:00 client at 07:51.
 *
 * Anything already queued for this appointment is withdrawn first, so
 * confirming twice, moving the session or adding a link never leaves two sets
 * of reminders behind.
 */
async function scheduleReminders(a: AppointmentView, sessionLink: string | null) {
  await withdrawQueuedNotificationLogs(appointmentHref(a), 'Superseded by updated reminders');

  const settings = await getSettings();
  const sessionDate = parts(a.startAt).date;
  const morningOf = (isoDate: string) => fromLocalParts(isoDate, '06:00').toISOString();
  const links = sessionLinks(a, sessionLink);

  const jobs: {
    at: string;
    type: string;
    subject: string;
    heading: string;
    body: string;
    withDetails: boolean;
  }[] = [];

  if (settings.reminders.firstReminderHours) {
    jobs.push({
      at: morningOf(addISODays(sessionDate, -1)),
      type: 'reminder.day_before',
      subject: `Reminder: your appointment on ${appointmentDate(a)}`,
      heading: 'Appointment reminder',
      body: [
        'This is a courtesy reminder of your upcoming appointment with Be Whole Care. The details are below.',
        onlineLinkSentence(a, sessionLink),
        'Should you need to reschedule, please let us know at least 24 hours before your appointment.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      withDetails: true,
    });
  }
  if (settings.reminders.secondReminderHours) {
    jobs.push({
      at: morningOf(sessionDate),
      type: 'reminder.day_of',
      subject: `Your appointment today at ${displayTime(parts(a.startAt).time)}`,
      heading: 'Your appointment is today',
      body: [
        'We look forward to seeing you today. The details of your appointment are below.',
        onlineLinkSentence(a, sessionLink),
      ]
        .filter(Boolean)
        .join('\n\n'),
      withDetails: true,
    });
  }
  if (settings.reminders.followUpAfterHours) {
    jobs.push({
      at: morningOf(addISODays(sessionDate, 1)),
      type: 'followup.check_in',
      subject: 'Thank you for your recent session',
      heading: 'Thank you for your recent session',
      body:
        'Thank you for attending your recent session with Be Whole Care. We trust that it was of value to you.\n\n' +
        'When you are ready to book your next session, you are welcome to do so at any time. ' +
        'Should you have any questions in the meantime, please reply to this email.',
      withDetails: false,
    });
  }

  for (const job of jobs) {
    if (new Date(job.at).getTime() <= Date.now()) continue;
    await notify({
      type: job.type,
      audience: 'client',
      channels: settings.reminders.channels,
      to: clientRecipient(a),
      subject: job.subject,
      heading: job.heading,
      greeting: firstNameOf(a),
      body: job.body,
      details: job.withDetails ? appointmentDetails(a) : undefined,
      links: job.withDetails ? links : [{ label: 'Book your next session', url: appUrl('/book') }],
      href: appointmentHref(a),
      scheduledFor: job.at,
    });
  }
}

async function onAppointmentRescheduled(appointmentId: ID, previousStart: string) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const previous = `${formatFullDate(parts(previousStart).date)} at ${displayTime(parts(previousStart).time)}`;

  const sync = await syncCalendar(
    a,
    `${calendarDescription(a)}\n\nRescheduled from ${previous}.`,
  );

  await notify({
    type: 'appointment.rescheduled',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: `Appointment rescheduled — ${appointmentDate(a)}`,
    heading: 'Your appointment has been rescheduled',
    greeting: firstNameOf(a),
    body: [
      `Your appointment, previously scheduled for ${previous}, has been moved. The updated details are below.`,
      onlineLinkSentence(a, sync.sessionLink),
      'Should this time not suit you, please reply to this email and our team will assist you.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    details: appointmentDetails(a),
    links: sessionLinks(a, sync.sessionLink),
    href: appointmentHref(a),
  });

  await notify({
    type: 'appointment.rescheduled.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Rescheduled — ${a.client?.name ?? 'Client'}, now ${appointmentWhen(a)}`,
    body: `This appointment was moved from ${previous}.${calendarNote(sync)}`,
    details: staffDetails(a),
    href: `/admin/appointments?ref=${a.reference}`,
  });

  // The old reminders named the old date. Replace them — but only for a
  // confirmed session; one still awaiting payment or medical aid has none.
  if (a.status === 'confirmed') {
    await scheduleReminders(a, sync.sessionLink);
  } else {
    await withdrawQueuedNotificationLogs(appointmentHref(a), 'Appointment rescheduled');
  }
}

async function onAppointmentCancelled(appointmentId: ID, byStaff: boolean, late: boolean) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  // A cancelled session must not keep sending "your appointment is today".
  await withdrawQueuedNotificationLogs(appointmentHref(a), 'Appointment cancelled');

  const event = await getCalendarEventForAppointment(a.id);
  if (event?.externalId) {
    const result = await getCalendarProvider().cancel(event.externalId);
    await upsertCalendarEvent({
      ...event,
      status: result.ok ? 'cancelled' : 'failed',
      lastError: result.error ?? null,
      updatedAt: nowISO(),
    });
  }

  await notify({
    type: 'appointment.cancelled',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: `Appointment cancelled — ${appointmentDate(a)}`,
    heading: 'Your appointment has been cancelled',
    greeting: firstNameOf(a),
    body: [
      byStaff
        ? `We regret to inform you that your appointment on ${appointmentWhen(a)} has been cancelled. ` +
          'Our team will be in contact with you to arrange a new time.'
        : `This email confirms that your appointment on ${appointmentWhen(a)} has been cancelled.`,
      !byStaff && late
        ? 'Please note that this cancellation was made less than 24 hours before the appointment. ' +
          'In line with our cancellation policy, a late cancellation may be charged in full. ' +
          'Our team will contact you regarding this.'
        : '',
      'You are welcome to book a new appointment whenever you are ready.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    details: appointmentDetails(a),
    links: [{ label: 'Book a new appointment', url: appUrl('/book') }],
    href: appointmentHref(a),
  });

  await notify({
    type: 'appointment.cancelled.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Cancelled — ${a.client?.name ?? 'Client'}, ${appointmentWhen(a)}`,
    body:
      `This appointment was cancelled ${byStaff ? 'by the practice' : 'by the client'}.` +
      (late ? ' The cancellation falls within the 24-hour window.' : ''),
    details: staffDetails(a),
    href: `/admin/appointments?ref=${a.reference}`,
  });
}

async function onAppointmentCompleted(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  // The session is over: nothing queued for it (including the next-morning
  // check-in) should follow this message.
  await withdrawQueuedNotificationLogs(appointmentHref(a), 'Session completed');

  await notify({
    type: 'appointment.completed',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: 'Thank you for your session',
    heading: 'Thank you for your session',
    greeting: firstNameOf(a),
    body:
      `Thank you for attending your session with Be Whole Care on ${appointmentWhen(a)}.\n\n` +
      'When you are ready to book your next session, you are welcome to do so at any time. ' +
      'Should you have any questions in the meantime, please reply to this email.',
    links: [{ label: 'Book your next session', url: appUrl('/book') }],
    href: appointmentHref(a),
  });
}

async function onPaymentFailed(appointmentId: ID | null, reason?: string) {
  if (!appointmentId) return;
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  await notify({
    type: 'payment.failed',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: 'Your payment was unsuccessful',
    heading: 'Your payment was unsuccessful',
    greeting: firstNameOf(a),
    body:
      'Unfortunately, we were unable to process your payment for the appointment below.' +
      (reason ? ` The reason given was: ${reason}.` : '') +
      '\n\nYour appointment remains reserved for now. You may try the payment again using the button ' +
      'below. Should you need assistance, please reply to this email.',
    details: [...appointmentDetails(a), { label: 'Amount due', value: money(a.amountCents) }],
    cta: { label: 'Try the payment again', url: appointmentPaymentUrl(a.id) },
    href: appointmentHref(a),
  });
}

/* --------------------------------------------------- follow-up messages */

/**
 * Follow-up sessions a practitioner arranges from the dashboard.
 *
 * These used to only emit events that nothing handled, so no email was ever
 * sent — a client asked to pay for a follow-up never received the request.
 */
async function followUpView(followUpId: ID): Promise<FollowUpView | null> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp) return null;
  const [hydrated] = await hydrateFollowUps([followUp]);
  return hydrated ?? null;
}

function followUpDetails(f: FollowUpView) {
  const where =
    f.mode === 'online'
      ? 'Online session'
      : f.location
        ? `${f.location.name} — ${f.location.addressLine}, ${f.location.city}, ${f.location.postalCode}`
        : 'In person';
  return [
    { label: 'Service', value: f.service.name },
    {
      label: 'Date',
      value: `${formatFullDate(f.dueDate)}${f.preferredTime ? ` at ${displayTime(f.preferredTime)}` : ''}`,
    },
    { label: 'Location', value: where },
  ];
}

function followUpRecipient(f: FollowUpView) {
  return { email: f.client?.email, phone: f.client?.phone, userId: f.clientUserId };
}

export async function sendFollowUpPaymentRequest(followUpId: ID, paymentUrl?: string): Promise<void> {
  const f = await followUpView(followUpId);
  if (!f) return;

  await notify({
    type: 'followup.payment_required',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: followUpRecipient(f),
    subject: `Your follow-up session — payment required to confirm`,
    heading: 'Your follow-up session',
    greeting: f.client?.name?.split(' ')[0] || null,
    body:
      'Your practitioner has arranged a follow-up session for you. The details are below.\n\n' +
      'To confirm the session, please complete the payment using the button below. Once the payment ' +
      'has been received, we will send you a confirmation.' +
      (f.notes ? `\n\nA note from your practitioner: ${f.notes}` : ''),
    details: [...followUpDetails(f), { label: 'Amount due', value: money(f.amountCents) }],
    cta: paymentUrl ? { label: 'Complete payment', url: paymentUrl } : null,
    href: '/portal/follow-ups',
  });
}

export async function sendFollowUpConfirmed(followUpId: ID): Promise<void> {
  const f = await followUpView(followUpId);
  // Once the follow-up has become an appointment, that appointment's own
  // confirmation is sent — sending this as well would be a duplicate.
  if (!f || f.appointmentId) return;

  await notify({
    type: 'followup.confirmed',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: followUpRecipient(f),
    subject: 'Your follow-up session is confirmed',
    heading: 'Your follow-up session is confirmed',
    greeting: f.client?.name?.split(' ')[0] || null,
    body:
      'Thank you. Your payment has been received and your follow-up session is confirmed. ' +
      'Our team will be in contact to finalise the time if it has not yet been set.',
    details: followUpDetails(f),
    href: '/portal/follow-ups',
  });
}

export async function sendFollowUpReminder(followUpId: ID): Promise<void> {
  const f = await followUpView(followUpId);
  if (!f) return;

  await notify({
    type: 'followup.reminder',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: followUpRecipient(f),
    subject: `Your follow-up session — ${formatFullDate(f.dueDate)}`,
    heading: 'Your follow-up session',
    greeting: f.client?.name?.split(' ')[0] || null,
    body:
      'Your practitioner has arranged a follow-up session for you. The details are below.' +
      (f.notes ? `\n\nA note from your practitioner: ${f.notes}` : '') +
      '\n\nShould this time not suit you, please reply to this email and our team will assist you.',
    details: followUpDetails(f),
    href: '/portal/follow-ups',
  });
}
