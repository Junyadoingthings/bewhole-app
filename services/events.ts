import 'server-only';

import {
  audit,
  getAppointment,
  getCalendarEventForAppointment,
  getProfile,
  getService,
  getLocation,
  findUserById,
  getSettings,
  hydrateAppointments,
  updateAppointment,
  upsertCalendarEvent,
  newId,
  nowISO,
} from '@/lib/db';
import { BUSINESS } from '@/config/business';
import { displayTime, formatFullDate, parts, relativeDay } from '@/lib/date';
import { appointmentPaymentUrl } from '@/lib/links';
import { money } from '@/lib/utils';
import { getCalendarProvider } from '@/services/calendar';
import { notify } from '@/services/notifications';
import type { AppointmentView, FollowUpView, ID } from '@/types';

/**
 * Where practice-facing notifications are emailed.
 *
 * The practice's own address, from config — the same inbox the calendar syncs
 * to. Booking, rescheduling and cancellation all reach it, so nobody has to
 * remember to check a dashboard to find out their day changed.
 */
const PRACTICE_INBOX = { email: BUSINESS.email } as const;

/**
 * Event-driven automation engine.
 *
 * Business flows emit domain events; handlers below turn those into calendar
 * syncs, client messages, staff notifications and scheduled reminders. Adding a
 * new side effect means adding a handler, not editing the booking code.
 *
 * Handlers are intentionally best-effort: a calendar outage must never fail a
 * confirmed booking. Failures are recorded and surfaced for retry instead.
 */

export type DomainEvent =
  | { type: 'appointment.created'; appointmentId: ID }
  | { type: 'appointment.confirmed'; appointmentId: ID }
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
  | { type: 'followup.confirmed'; followUpId: ID };

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
    // An automation failure must never break the request that triggered it.
    console.error('[bwc:events] handler failed', event.type, error);
  }
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

function sessionSummary(a: AppointmentView) {
  return [
    `Service: ${a.service.name}`,
    `When: ${appointmentWhen(a)}`,
    `Where: ${appointmentWhere(a)}`,
    `Reference: ${a.reference}`,
  ].join('\n');
}

/* ------------------------------------------------------ medical aid checks */

/**
 * Reusable, because "when and where" must read identically in the booking
 * acknowledgement, the confirmation and any reminder. Retyping these in each
 * email is how a venue ends up right in one message and wrong in another.
 */
function appointmentDetails(a: AppointmentView) {
  return [
    { label: 'Service', value: a.service.name },
    { label: 'When', value: appointmentWhen(a) },
    { label: 'Where', value: appointmentWhere(a) },
    { label: 'Reference', value: a.reference },
  ];
}

/**
 * A medical aid booking has been taken and is waiting on the practice.
 *
 * The client is told plainly that the slot is held but not yet confirmed. It
 * would be easier to write "You're booked" here and sort it out later; that
 * sentence is the one thing this message must not say, because the session may
 * still need to be paid for privately.
 */
async function onMedicalAidPending(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const firstName = a.client?.name?.split(' ')[0] ?? 'there';
  const profile = await getProfile(a.clientUserId);
  const scheme = profile?.medicalAid?.scheme;

  await notify({
    type: 'appointment.medical_aid_pending',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: 'We have your booking — checking your medical aid',
    body:
      `Hi ${firstName},\n\nThank you for booking with Be Whole Care. We have held this time for you ` +
      `while we confirm your medical aid cover${scheme ? ` with ${scheme}` : ''}.\n\n` +
      `You do not need to do anything right now. We will email you as soon as the check is done — ` +
      `usually within one working day — and your session is confirmed at that point, not before.`,
    details: appointmentDetails(a),
    href: `/portal/appointments/${a.id}`,
  });

  await notify({
    type: 'appointment.medical_aid_pending.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Medical aid to verify — ${a.client?.name ?? 'Client'}, ${appointmentWhen(a)}`,
    body:
      `${a.client?.name ?? 'Client'} booked using medical aid and is waiting on verification.\n\n` +
      (profile?.medicalAid
        ? `Scheme: ${profile.medicalAid.scheme}\nMember number: ${profile.medicalAid.memberNumber}\n` +
          `Main member: ${profile.medicalAid.mainMember}\n\n`
        : 'No medical aid details were captured on the profile.\n\n') +
      `Accept or decline it on the appointments page — the client is emailed either way.`,
    details: appointmentDetails(a),
    href: `/admin/appointments?filter=medical_aid`,
  });
}

/**
 * The scheme will not cover this session, so it becomes a private booking.
 *
 * The client gets a link that goes straight to payment without signing in —
 * they have never set a password, and a login wall between a declined claim
 * and a held appointment is how the appointment gets lost.
 */
async function onMedicalAidDeclined(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const firstName = a.client?.name?.split(' ')[0] ?? 'there';
  const reason = a.medicalAidDeclineReason?.trim();

  await notify({
    type: 'appointment.medical_aid_declined',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: 'About your medical aid — your session is still held',
    body:
      `Hi ${firstName},\n\nWe have heard back about your medical aid, and unfortunately this session ` +
      `cannot be claimed from your scheme.\n\n` +
      (reason ? `${reason}\n\n` : '') +
      `Your time is still held. To keep it, the session can be paid for by card using the button ` +
      `below — it takes about a minute, and your booking is confirmed the moment it goes through.\n\n` +
      `If you would rather move or cancel the session instead, reply to this email and we will sort ` +
      `it out. Nothing has been charged to you.`,
    details: [
      ...appointmentDetails(a),
      { label: 'Amount due', value: money(a.amountCents) },
    ],
    cta: { label: 'Pay by card', url: appointmentPaymentUrl(a.id) },
    href: `/portal/appointments/${a.id}`,
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
    body: `${a.client?.name ?? 'A client'} booked a ${a.mode === 'online' ? 'online' : 'in-person'} session.\n\n${sessionSummary(a)}`,
    href: `/admin/appointments?ref=${a.reference}`,
  });

  if (a.status === 'pending_payment' && a.amountCents > 0) {
    await notify({
      type: 'payment.requested',
      audience: 'client',
      channels: [...settings.reminders.channels, 'in_app'],
      to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
      subject: 'Complete your payment to confirm your session',
      body: `Hi ${a.client?.name?.split(' ')[0] ?? 'there'},\n\nWe've held this time for you. Your booking is confirmed once payment is received.\n\n${sessionSummary(a)}\nAmount: ${money(a.amountCents)}\n\nYou can pay from your appointment page at any time.`,
      href: `/portal/appointments/${a.id}`,
    });
  }
}

/**
 * The confirmation path: calendar event, session link, client confirmation,
 * and the reminder schedule.
 */
async function onAppointmentConfirmed(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();
  const calendar = getCalendarProvider();

  const result = await calendar.createOrUpdate({
    appointmentId: a.id,
    summary: `${a.service.name} — ${a.client?.name ?? 'Client'}`,
    description: [
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
      .join('\n'),
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
    syncedAt: result.ok ? nowISO() : null,
    createdAt: existing?.createdAt ?? nowISO(),
    updatedAt: nowISO(),
  });

  // An online session gets its meeting link from the calendar provider.
  const sessionLink = a.sessionLink ?? result.meetLink ?? null;
  if (sessionLink && sessionLink !== a.sessionLink) {
    await updateAppointment(a.id, { sessionLink });
  }

  const firstName = a.client?.name?.split(' ')[0] ?? 'there';
  const joinLine = a.mode === 'online' && sessionLink ? `\n\nYour session link: ${sessionLink}` : '';
  /**
   * Say so explicitly when the confirmation follows a medical aid check. The
   * client has been waiting on exactly this answer, and "confirmed" alone
   * leaves them wondering whether the scheme was accepted or quietly ignored.
   */
  const medicalAidLine =
    a.medicalAidDecision === 'accepted'
      ? `\n\nYour medical aid has been verified and this session will be claimed from your scheme.` +
        (a.amountCents > 0
          ? ` A co-payment of ${money(a.amountCents)} is payable at your appointment.`
          : '')
      : '';
     const { calendarLine: clientCalendarLinks } = generateCalendarLinks(a);
    const calendarLine = (result.ok
      ? ''
      : '\n\n(We could not sync this to our calendar automatically — our team has been notified and will confirm.)')
      + clientCalendarLinks;


  await notify({
    type: 'appointment.confirmed',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: "You're booked",
    /**
     * The facts move into the details block rather than sitting inside the
     * sentence, so date, time and venue survive a phone glance. The thank-you
     * closes it: this is the message a client keeps, and it should read like
     * it came from a person.
     */
    body:
      `Hi ${firstName},\n\nYour session with Be Whole Care is confirmed.` +
      `${medicalAidLine}${joinLine}\n\n` +
      `Thank you for trusting us with this. We are looking forward to seeing you.\n\n` +
      `If you need to change or cancel, please give us at least 24 hours' notice.${calendarLine}`,
    details: appointmentDetails(a),
    href: `/portal/appointments/${a.id}`,
  });

  await notify({
    type: 'appointment.confirmed.staff',
    audience: 'staff',
    // Email as well as in-app. A notification the practice only sees by
    // opening the dashboard is no use to someone who runs their day out of
    // an inbox — a new booking has to arrive where they already look.
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `New booking — ${a.service.name}, ${appointmentWhen(a)}`,
    body: `${a.client?.name ?? 'Client'} · ${appointmentWhen(a)}\n\n${sessionSummary(a)}${
      a.client?.email ? `\n\nClient email: ${a.client.email}` : ''
    }${result.ok ? '' : '\n\nCalendar sync failed — retry from the appointment.'}`,
    href: `/admin/appointments?ref=${a.reference}`,
  });

  await scheduleReminders(a);
}

/** Queue the 24h / 2h reminders and the post-session follow-up message. */
async function scheduleReminders(a: AppointmentView) {
  const settings = await getSettings();
  const start = new Date(a.startAt).getTime();
  const firstName = a.client?.name?.split(' ')[0] ?? 'there';

  const jobs: { hoursBefore: number | null; subject: string; body: string; type: string }[] = [];

  if (settings.reminders.firstReminderHours) {
    jobs.push({
      hoursBefore: settings.reminders.firstReminderHours,
      type: 'reminder.24h',
      subject: 'Your session is tomorrow',
      body: `Hi ${firstName},\n\nA gentle reminder about your session.\n\n${sessionSummary(a)}${a.sessionLink ? `\nLink: ${a.sessionLink}` : ''}\n\nIf you need to reschedule, please let us know at least 24 hours beforehand.`,
    });
  }
  if (settings.reminders.secondReminderHours) {
    jobs.push({
      hoursBefore: settings.reminders.secondReminderHours,
      type: 'reminder.2h',
      subject: 'Your session is in a couple of hours',
      body: `Hi ${firstName},\n\nSee you at ${displayTime(parts(a.startAt).time)}.\n\n${appointmentWhere(a)}${a.sessionLink ? `\nLink: ${a.sessionLink}` : ''}`,
    });
  }
  if (settings.reminders.followUpAfterHours) {
    jobs.push({
      hoursBefore: -settings.reminders.followUpAfterHours,
      type: 'followup.check_in',
      subject: 'How are you doing?',
      body: `Hi ${firstName},\n\nThank you for making the time yesterday. If you'd like to book your next session, you can do that from your portal whenever you're ready.\n\nThere's no pressure either way — we're here when you need us.`,
    });
  }

  for (const job of jobs) {
    const when = new Date(start - (job.hoursBefore ?? 0) * 3_600_000).toISOString();
    if (new Date(when).getTime() <= Date.now()) continue; // already past
    await notify({
      type: job.type,
      audience: 'client',
      channels: settings.reminders.channels,
      to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
      subject: job.subject,
      body: job.body,
      href: `/portal/appointments/${a.id}`,
      scheduledFor: when,
    });
  }
}

async function onAppointmentRescheduled(appointmentId: ID, previousStart: string) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  // Reuses the same deterministic event id, so this updates rather than duplicates.
  const calendar = getCalendarProvider();
  const existing = await getCalendarEventForAppointment(a.id);
  const result = await calendar.createOrUpdate({
    appointmentId: a.id,
    summary: `${a.service.name} — ${a.client?.name ?? 'Client'}`,
    description: `Rescheduled from ${formatFullDate(parts(previousStart).date)} ${displayTime(parts(previousStart).time)}.\nReference: ${a.reference}`,
    location: appointmentWhere(a),
    startISO: a.startAt,
    endISO: a.endAt,
    timeZone: BUSINESS.timezone,
    attendeeEmail: a.client?.email ?? null,
    attendeeName: a.client?.name ?? null,
    conference: a.mode === 'online',
  });

  if (existing) {
    await upsertCalendarEvent({
      ...existing,
      externalId: result.externalId ?? existing.externalId,
      status: result.ok ? 'synced' : 'failed',
      lastError: result.error ?? null,
      syncedAt: result.ok ? nowISO() : existing.syncedAt,
      updatedAt: nowISO(),
    });
  }

  await notify({
    type: 'appointment.rescheduled',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: 'Your session has been moved',
    body: `Your session is now on ${appointmentWhen(a)}.\n\n${sessionSummary(a)}`,
    href: `/portal/appointments/${a.id}`,
  });

  await notify({
    type: 'appointment.rescheduled.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Rescheduled — ${a.client?.name ?? 'Client'}`,
    body: `Moved from ${formatFullDate(parts(previousStart).date)} to ${appointmentWhen(a)}.`,
    href: `/admin/appointments?ref=${a.reference}`,
  });

  await scheduleReminders(a);
}

async function onAppointmentCancelled(appointmentId: ID, byStaff: boolean, late: boolean) {
  const a = await view(appointmentId);
  if (!a) return;
  const settings = await getSettings();

  const event = await getCalendarEventForAppointment(a.id);
  if (event?.externalId) {
    const calendar = getCalendarProvider();
    const result = await calendar.cancel(event.externalId);
    await upsertCalendarEvent({
      ...event,
      status: result.ok ? 'cancelled' : 'failed',
      lastError: result.error ?? null,
      updatedAt: nowISO(),
    });
  }

  const lateLine = late
    ? `\n\nThis cancellation falls inside our 24-hour window. Our policy is that late cancellations may be charged in full — we'll be in touch about your session.`
    : '';

  await notify({
    type: 'appointment.cancelled',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: byStaff ? 'Your session has been cancelled' : 'Your cancellation is confirmed',
    body: `${byStaff ? 'We have had to cancel this session and will be in touch to rebook.' : "Your session has been cancelled and the time released."}\n\n${sessionSummary(a)}${lateLine}\n\nYou can book again whenever you're ready.`,
    href: '/book',
  });

  await notify({
    type: 'appointment.cancelled.staff',
    audience: 'staff',
    channels: ['in_app', 'email'],
    to: PRACTICE_INBOX,
    subject: `Cancelled — ${a.client?.name ?? 'Client'}`,
    body: `${appointmentWhen(a)}${late ? ' · inside the 24-hour window' : ''}`,
    href: `/admin/appointments?ref=${a.reference}`,
  });
}

async function onAppointmentCompleted(appointmentId: ID) {
  const a = await view(appointmentId);
  if (!a) return;
  await notify({
    type: 'appointment.completed',
    audience: 'staff',
    channels: ['in_app'],
    to: {},
    subject: `Session completed — ${a.client?.name ?? 'Client'}`,
    body: `${a.service.name} on ${appointmentWhen(a)}. Create a follow-up if one is needed.`,
    href: `/admin/clients/${a.clientUserId}`,
  });
}

async function onPaymentFailed(appointmentId: ID | null, reason?: string) {
  if (!appointmentId) return;
  const a = await view(appointmentId);
  if (!a) return;

  await notify({
    type: 'payment.failed',
    audience: 'client',
    channels: ['email', 'in_app'],
    to: { email: a.client?.email, phone: a.client?.phone, userId: a.clientUserId },
    subject: "Your payment didn't go through",
    body: `We weren't able to process your payment for ${a.service.name} on ${appointmentWhen(a)}.\n\nYour time is still held for now. You can try again from your appointment page.${reason ? `\n\nReason given: ${reason}` : ''}`,
    href: `/portal/appointments/${a.id}`,
  });

  await notify({
    type: 'payment.failed.staff',
    audience: 'staff',
    channels: ['in_app'],
    to: {},
    subject: `Payment failed — ${a.client?.name ?? 'Client'}`,
    body: `${money(a.amountCents)} for ${a.service.name} on ${appointmentWhen(a)}.`,
    href: '/admin/payments',
  });
}

/* ------------------------------------------------------- follow-up notices */

export async function sendFollowUpPaymentRequest(f: FollowUpView, checkoutHref: string) {
  const firstName = f.client?.name?.split(' ')[0] ?? 'there';
  const amount = money(f.amountCents);

  await notify({
    type: 'followup.payment_required',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: { email: f.client?.email, phone: f.client?.phone, userId: f.clientUserId },
    subject: 'Your follow-up session — payment to confirm',
    body: `Hi ${firstName},\n\nWe've set aside ${relativeDay(f.dueDate).toLowerCase()} (${formatFullDate(f.dueDate)}${f.preferredTime ? ` at ${displayTime(f.preferredTime)}` : ''}) for your follow-up ${f.service.name.toLowerCase()} session.\n\nTo confirm it, please complete payment of ${amount}. Once we receive it, we'll send your confirmation and calendar invitation.\n\n${f.notes ? `Note from your practitioner: ${f.notes}\n\n` : ''}Pay here: ${checkoutHref}`,
    href: '/portal/follow-ups',
  });
}

export async function sendFollowUpConfirmed(f: FollowUpView) {
  const firstName = f.client?.name?.split(' ')[0] ?? 'there';
  await notify({
    type: 'followup.confirmed',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: { email: f.client?.email, phone: f.client?.phone, userId: f.clientUserId },
    subject: 'Your follow-up is confirmed',
    body: `Hi ${firstName},\n\nThank you — your follow-up session is confirmed for ${formatFullDate(f.dueDate)}${f.preferredTime ? ` at ${displayTime(f.preferredTime)}` : ''}.\n\n${f.mode === 'online' ? "We'll send your session link before we meet." : f.location ? `Where: ${f.location.addressLine}, ${f.location.city}` : ''}`,
    href: '/portal/follow-ups',
  });

  await notify({
    type: 'followup.confirmed.staff',
    audience: 'staff',
    channels: ['in_app'],
    to: {},
    subject: `Follow-up confirmed — ${f.client?.name ?? 'Client'}`,
    body: `${f.service.name} on ${formatFullDate(f.dueDate)}.`,
    href: '/admin/follow-ups',
  });
}

export async function sendFollowUpReminder(f: FollowUpView) {
  const firstName = f.client?.name?.split(' ')[0] ?? 'there';
  await notify({
    type: 'followup.reminder',
    audience: 'client',
    channels: [f.channel, 'in_app'],
    to: { email: f.client?.email, phone: f.client?.phone, userId: f.clientUserId },
    subject: f.paymentRequired ? 'A reminder about your follow-up payment' : 'Your follow-up is coming up',
    body: f.paymentRequired
      ? `Hi ${firstName},\n\nYour follow-up ${f.service.name.toLowerCase()} session on ${formatFullDate(f.dueDate)} is still awaiting payment of ${money(f.amountCents)}.\n\nYou can complete it from your portal — once it's through, we'll confirm the booking straight away.`
      : `Hi ${firstName},\n\nJust a reminder that your follow-up is on ${formatFullDate(f.dueDate)}${f.preferredTime ? ` at ${displayTime(f.preferredTime)}` : ''}.`,
    href: '/portal/follow-ups',
  });
}

/* ------------------------------------------------- helpers used elsewhere */

export async function buildClientContact(userId: ID) {
  const [user, profile] = await Promise.all([findUserById(userId), getProfile(userId)]);
  return {
    email: user?.email ?? null,
    phone: profile?.phone ?? null,
    name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '',
    firstName: profile?.firstName ?? '',
  };
}

export async function describeService(serviceId: ID, locationId?: ID | null) {
  const [service, location] = await Promise.all([getService(serviceId), getLocation(locationId)]);
  return { service, location };
}
/**
 * Generates an iCalendar (.ics) string and direct web links for an appointment.
 */
function generateCalendarLinks(a: AppointmentView) {
  const start = new Date(a.startAt).toISOString().replace(/-|:|\.\d+/g, "");
  const endDate = a.endAt ? new Date(a.endAt) : new Date(new Date(a.startAt).getTime() + 60 * 60 * 1000);
  const end = endDate.toISOString().replace(/-|:|\.\d+/g, "");

  const title = `Appointment: ${a.service?.name ?? 'BeWholeCare Consultation'}`;
  const description = `Your appointment with BeWholeCare.\nReference: ${a.reference || a.id}`;
  const location = a.sessionLink ?? 'Online / Office';

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BeWholeCare//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${a.id || Date.now()}@bewholecare.com`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
    title
  )}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(
    location
  )}&startdt=${new Date(a.startAt).toISOString()}&enddt=${endDate.toISOString()}`;

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(
    location
  )}&dates=${start}/${end}`;

  return {
    icsContent,
    outlookUrl,
    googleUrl,
    calendarLine: `\n\nAdd to calendar: Outlook (${outlookUrl}) | Google (${googleUrl})`
  };
}
