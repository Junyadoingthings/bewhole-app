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
  upsertCalendarEvent,
  withdrawQueuedNotificationLogs,
  newId,
  nowISO,
} from '@/lib/db';
import { BUSINESS, CLIENT_EMAIL } from '@/config/business';
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

/* ------------------------------------------ the practice's email wording */

/** "03 September 2026" — the date style the practice uses in its emails. */
function emailDate(a: AppointmentView) {
  const [year, month, day] = parts(a.startAt).date.split('-');
  const monthName = new Intl.DateTimeFormat('en-ZA', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1)),
  );
  return `${day} ${monthName} ${year}`;
}

function emailTime(a: AppointmentView) {
  return displayTime(parts(a.startAt).time);
}

/** The street address given to in-person clients once they are confirmed. */
function practiceAddress(a: AppointmentView) {
  const slug = a.location?.slug;
  return (slug && CLIENT_EMAIL.practiceAddresses[slug]) || appointmentWhere(a);
}

/**
 * Where every online session is held. A link staff set on one appointment
 * (admin → session link) takes precedence; otherwise the practice's room.
 */
function onlineSessionLink(a: AppointmentView) {
  return a.sessionLink || CLIENT_EMAIL.onlineSessionLink;
}

/**
 * Details for emails sent BEFORE a booking is confirmed (awaiting payment or
 * medical aid). By the practice's rule these carry neither the street address
 * nor the session link — those go out only after payment or verification.
 */
function appointmentDetails(a: AppointmentView) {
  return [
    { label: 'Service', value: a.service.name },
    { label: 'Date and time', value: appointmentWhen(a) },
    { label: 'Duration', value: `${a.durationMinutes} minutes` },
    {
      label: 'Location',
      value: a.mode === 'online' ? 'Online session' : `In person — ${a.location ? `${a.location.name} Practice` : 'practice'}`,
    },
    { label: 'Reference', value: a.reference },
  ];
}

/**
 * Details for a CONFIRMED booking, in the practice's own layout: date, time,
 * duration, and the address for an in-person session. (An online session's
 * link has its own section — see sessionLinkSection.)
 */
function confirmedDetails(a: AppointmentView, { duration = true } = {}) {
  return [
    { label: 'Date', value: emailDate(a) },
    { label: 'Time', value: emailTime(a) },
    ...(duration ? [{ label: 'Duration', value: `${a.durationMinutes} minutes` }] : []),
    ...(a.mode === 'in_person' ? [{ label: 'Address', value: practiceAddress(a) }] : []),
  ];
}

/** The practice's online-session section: heading, link and checklist. */
function sessionLinkSection(a: AppointmentView) {
  if (a.mode !== 'online') return '';
  return [
    '## Session Link',
    'Please join your session using the link below:',
    onlineSessionLink(a),
    'Kindly ensure that you:\n' +
      '• Join from a private and quiet space.\n' +
      '• Have a stable internet connection.\n' +
      '• Join a few minutes before the scheduled start time.',
  ].join('\n\n');
}

/** Ntombi's signature, as written in the practice's templates. */
function practitionerSignOff(closing: string, practiceNumberLabel: 'Practice No' | 'Practice Number') {
  const p = CLIENT_EMAIL.practitioner;
  return [closing, p.name, p.title, p.registration, `${practiceNumberLabel}: ${p.practiceNumber}`];
}

function joinParagraphs(...paragraphs: string[]) {
  return paragraphs.filter(Boolean).join('\n\n');
}

/** Staff see who the client is alongside the session facts, full address included. */
function staffDetails(a: AppointmentView) {
  return [
    { label: 'Client', value: a.client?.name || 'Not captured' },
    { label: 'Email', value: a.client?.email || 'Not captured' },
    { label: 'Phone', value: a.client?.phone || 'Not captured' },
    // Couples, family and pre-marital sessions: everyone else attending,
    // each of whom agreed to the informed consent when booking.
    ...(a.participants ?? []).map((p, i, all) => ({
      label: all.length > 1 ? `Also attending (${i + 1})` : 'Also attending',
      value: [`${p.firstName} ${p.lastName}`, p.phone, p.email].filter(Boolean).join(' · '),
    })),
    { label: 'Service', value: a.service.name },
    { label: 'Date and time', value: appointmentWhen(a) },
    { label: 'Duration', value: `${a.durationMinutes} minutes` },
    { label: 'Location', value: appointmentWhere(a) },
    { label: 'Reference', value: a.reference },
  ];
}

/** "Add to Google Calendar", as a short tappable line (never the raw address). */
function calendarLinks(a: AppointmentView) {
  return [{ label: 'Add to Google Calendar', url: googleCalendarLink(a) }];
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
    // The practice's own wording. Any note staff typed when declining is kept,
    // placed after the explanation it adds to.
    body: joinParagraphs(
      'I hope you are doing well.',
      'Unfortunately, your medical aid benefits do not provide cover for counselling services. ' +
        'As a result, payment for your sessions will need to be made on a cash basis.',
      reason ?? '',
      'Please find the payment link below to complete your payment at your earliest convenience, ' +
        'to confirm your counselling session.',
      '{{cta}}',
      "If you have any questions or need any assistance with the payment process, please don't " +
        'hesitate to get in touch.',
    ),
    cta: { label: 'Make payment', url: CLIENT_EMAIL.medicalAidDeclinedPaymentLink },
    signOff: practitionerSignOff('Kind regards,', 'Practice No'),
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
 * Keep the practice calendar in step with the appointment.
 *
 * A meeting link the calendar might create is not kept: every online session
 * is held at the practice's own link (CLIENT_EMAIL.onlineSessionLink).
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

  return { ok: result.ok, live: calendar.live };
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

  // This handler only runs once a booking is confirmed — paid, medical aid
  // accepted, or a service that needs no payment — so the session link and
  // street address may go out here (and in the reminders queued below).
  if (a.medicalAidDecision === 'accepted') {
    // The practice's medical aid verification email, which is also the
    // confirmation — the client receives one email, not two.
    await notify({
      type: 'appointment.confirmed',
      audience: 'client',
      channels: [...settings.reminders.channels, 'in_app'],
      to: clientRecipient(a),
      subject: `Medical aid verified — appointment confirmed for ${emailDate(a)}`,
      heading: 'Your medical aid has been verified',
      greeting: firstNameOf(a),
      body: joinParagraphs(
        'Thank you for submitting your medical aid information.',
        'We are pleased to confirm that your medical aid details have been successfully verified ' +
          'and that you are registered as a beneficiary on the medical aid scheme provided.',
        'Your appointment details are as follows:',
        '{{details}}',
        sessionLinkSection(a),
        'Should there be any changes to your medical aid membership or benefits prior to your ' +
          'appointment, please notify us as soon as possible.',
        'We look forward to supporting you on your wellness journey.',
      ),
      details: confirmedDetails(a, { duration: false }),
      signOff: practitionerSignOff('Warm regards,', 'Practice Number'),
      href: appointmentHref(a),
    });
  } else {
    // The practice's booking confirmation (after payment).
    await notify({
      type: 'appointment.confirmed',
      audience: 'client',
      channels: [...settings.reminders.channels, 'in_app'],
      to: clientRecipient(a),
      subject: `Appointment confirmation — ${emailDate(a)}`,
      heading: 'Appointment confirmation',
      greeting: firstNameOf(a),
      body: joinParagraphs(
        'Thank you for booking your counselling session with Be Whole Care.',
        'This email serves as confirmation of your upcoming appointment.',
        '## Appointment Details',
        '{{details}}',
        sessionLinkSection(a),
        'I look forward to meeting with you.',
      ),
      details: confirmedDetails(a),
      signOff: practitionerSignOff('Warm regards,', 'Practice No'),
      href: appointmentHref(a),
    });
  }

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

  await scheduleReminders(a);
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
    subject: `Your online session link — ${emailDate(a)}`,
    heading: 'Your online session link',
    greeting: firstNameOf(a),
    body: joinParagraphs(
      'Please note that the link for your upcoming online session has been updated.',
      '## Appointment Details',
      '{{details}}',
      sessionLinkSection(a),
      'I look forward to meeting with you.',
    ),
    details: confirmedDetails(a),
    signOff: practitionerSignOff('Warm regards,', 'Practice No'),
    href: appointmentHref(a),
  });

  // Reminders already queued carry the previous link.
  await scheduleReminders(a);
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
async function scheduleReminders(a: AppointmentView) {
  await withdrawQueuedNotificationLogs(appointmentHref(a), 'Superseded by updated reminders');

  // Read the status now, not from the copy the caller loaded: these handlers
  // run after the response, and the session may have been cancelled in the
  // seconds since (a reschedule followed quickly by a cancel did exactly this
  // in testing, leaving reminders queued for a cancelled session).
  const current = await getAppointment(a.id);
  if (!current || current.status !== 'confirmed') return;

  const settings = await getSettings();
  const sessionDate = parts(a.startAt).date;
  const morningOf = (isoDate: string) => fromLocalParts(isoDate, '06:00').toISOString();
  // Reminders only exist for confirmed sessions, so every one carries the
  // session link (online) or the practice address (in person).

  const jobs: {
    at: string;
    type: string;
    subject: string;
    heading: string;
    body: string;
    withDetails: boolean;
  }[] = [];

  /**
   * Both reminders use the practice's own wording (2026-10): "Reminder:
   * Counselling Session", opening "Good day," and closing "We look forward
   * to seeing you." / "Kind regards,". The date, time, duration and the
   * session link or practice address stay in, as the practice asked for them
   * in every reminder.
   */
  const reminderBody = joinParagraphs(
    'This is a friendly reminder of your upcoming counselling session.',
    '## Appointment Details',
    '{{details}}',
    sessionLinkSection(a),
    'We look forward to seeing you.',
  );
  if (settings.reminders.firstReminderHours) {
    jobs.push({
      at: morningOf(addISODays(sessionDate, -1)),
      type: 'reminder.day_before',
      subject: 'Reminder: Counselling Session',
      heading: 'Reminder: Counselling Session',
      body: reminderBody,
      withDetails: true,
    });
  }
  if (settings.reminders.secondReminderHours) {
    jobs.push({
      at: morningOf(sessionDate),
      type: 'reminder.day_of',
      subject: 'Reminder: Counselling Session',
      heading: 'Reminder: Counselling Session',
      body: reminderBody,
      withDetails: true,
    });
  }
  // No email after the session, at the practice's request: the next-morning
  // "Thank you for your recent session" check-in was removed (2026-10).

  for (const job of jobs) {
    if (new Date(job.at).getTime() <= Date.now()) continue;
    await notify({
      type: job.type,
      audience: 'client',
      channels: settings.reminders.channels,
      to: clientRecipient(a),
      subject: job.subject,
      heading: job.heading,
      salutation: 'Good day,',
      body: job.body,
      details: job.withDetails ? confirmedDetails(a) : undefined,
      links: job.withDetails
        ? calendarLinks(a)
        : [{ label: 'Book your next session', url: appUrl('/book') }],
      signOff: job.withDetails ? practitionerSignOff('Kind regards,', 'Practice No') : undefined,
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

  // A confirmed session gets the new details with its link or address; one
  // still awaiting payment or medical aid gets neither yet.
  const confirmed = a.status === 'confirmed';
  await notify({
    type: 'appointment.rescheduled',
    audience: 'client',
    channels: [...settings.reminders.channels, 'in_app'],
    to: clientRecipient(a),
    subject: `Appointment rescheduled — ${emailDate(a)}`,
    heading: 'Your appointment has been rescheduled',
    greeting: firstNameOf(a),
    body: joinParagraphs(
      `Your appointment, previously scheduled for ${previous}, has been moved. The updated details are below.`,
      '## Appointment Details',
      '{{details}}',
      confirmed ? sessionLinkSection(a) : '',
      'Should this time not suit you, please reply to this email and our team will assist you.',
    ),
    details: confirmed ? confirmedDetails(a) : appointmentDetails(a),
    links: confirmed ? calendarLinks(a) : undefined,
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
  if (confirmed) {
    await scheduleReminders(a);
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
    subject: `Appointment cancelled — ${emailDate(a)}`,
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

  // The session is over: nothing still queued for it should go out. The
  // client is not emailed when a session is marked completed — the practice
  // asked for no post-session email (2026-10).
  await withdrawQueuedNotificationLogs(appointmentHref(a), 'Session completed');
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

/**
 * The street address goes out only once the session is paid for (the
 * practice's rule): a payment request or reminder names the practice, and the
 * confirmation sent after payment carries the address.
 */
function followUpDetails(f: FollowUpView, { withAddress = false } = {}) {
  const where =
    f.mode === 'online'
      ? 'Online session'
      : f.location
        ? withAddress
          ? `${f.location.name} — ${f.location.addressLine}, ${f.location.city}, ${f.location.postalCode}`
          : `In person — ${f.location.name} Practice`
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
    details: followUpDetails(f, { withAddress: true }),
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
