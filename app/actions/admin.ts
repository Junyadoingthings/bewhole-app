'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin, requireStaff } from '@/lib/auth';
import {
  audit,
  createAvailabilityBlock,
  createClientNote,
  deleteAvailabilityBlock,
  getAppointment,
  getPayment,
  markNotificationsRead,
  updateAppointment,
  getSettings,
  replaceWeeklyHours,
  updateSettings,
} from '@/lib/db';
import { noteSchema, fieldErrors } from '@/lib/validation';
import { cancelAppointment, decideMedicalAid, markAppointmentStatus } from '@/services/booking.service';
import { markPaymentReceivedManually, refundPayment, verifyAndApplyPayment } from '@/services/payment.service';
import { emit } from '@/services/events';
import { sendTestEmail } from '@/services/notifications';
import { getCalendarProvider } from '@/services/calendar';
import { getCalendarEventForAppointment, upsertCalendarEvent, nowISO } from '@/lib/db';

export interface AdminResult {
  ok: boolean;
  error?: string;
  errors?: Record<string, string>;
}

/* ------------------------------------------------------------- appointments */

export async function setAppointmentStatus(
  appointmentId: string,
  status: 'completed' | 'no_show' | 'confirmed',
): Promise<AdminResult> {
  const actor = await requireStaff();
  const result = await markAppointmentStatus(appointmentId, status, actor);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin/calendar');
  return { ok: true };
}

/**
 * Accept or decline a client's medical aid.
 *
 * requireStaff() both authorises and identifies — the returned actor is what
 * the audit entry records, so the decision is always attributable to a real
 * signed-in person rather than to an id passed in from the browser.
 *
 * A decline reason is optional but goes to the client verbatim, so it is
 * length-checked here rather than trusted: this is the one field in the flow
 * whose text a client reads at a disappointing moment.
 */
export async function setMedicalAidDecision(
  appointmentId: string,
  decision: 'accepted' | 'declined',
  reason?: string,
): Promise<AdminResult> {
  const actor = await requireStaff();

  const trimmed = reason?.trim() ?? '';
  if (trimmed.length > 600) {
    return { ok: false, error: 'Please keep the note under 600 characters.' };
  }

  const result = await decideMedicalAid(
    appointmentId,
    decision,
    actor,
    trimmed || undefined,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin/calendar');
  revalidatePath('/portal');
  return { ok: true };
}

export async function staffCancelAppointment(
  appointmentId: string,
  reason?: string,
): Promise<AdminResult> {
  const actor = await requireStaff();
  const result = await cancelAppointment(appointmentId, actor, reason);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin/calendar');
  return { ok: true };
}

export async function setSessionLink(appointmentId: string, link: string): Promise<AdminResult> {
  await requireStaff();
  const trimmed = link.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Please paste a full link starting with https://' };
  }
  const before = await getAppointment(appointmentId);
  await updateAppointment(appointmentId, { sessionLink: trimmed || null });
  // Send the client the link (and refresh their reminders) when it is new —
  // saving the same link again should not email them twice.
  if (trimmed && trimmed !== before?.sessionLink) {
    await emit({ type: 'appointment.session_link_added', appointmentId });
  }
  revalidatePath('/admin/appointments');
  return { ok: true };
}

/** Manual retry after a calendar outage — the same upsert, so no duplicates. */
export async function retryCalendarSync(appointmentId: string): Promise<AdminResult> {
  await requireStaff();
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'Appointment not found.' };
  if (appointment.status !== 'confirmed') {
    return { ok: false, error: 'Only a confirmed appointment syncs to the calendar.' };
  }
  // Calendar only. This used to re-run the whole confirmation, so retrying a
  // sync re-emailed the client and re-queued their reminders.
  await emit({ type: 'appointment.calendar_sync', appointmentId });
  const event = await getCalendarEventForAppointment(appointmentId);
  if (event && event.status === 'failed') {
    return { ok: false, error: event.lastError ?? 'Calendar sync failed again.' };
  }
  revalidatePath('/admin/appointments');
  return { ok: true };
}

export async function resendConfirmation(appointmentId: string): Promise<AdminResult> {
  await requireStaff();
  await emit({ type: 'appointment.confirmed', appointmentId });
  return { ok: true };
}

/* ------------------------------------------------------------------ payments */

export async function markPaymentPaid(paymentId: string): Promise<AdminResult> {
  const actor = await requireAdmin();
  const result = await markPaymentReceivedManually(paymentId, actor.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
  return { ok: true };
}

export async function refund(paymentId: string): Promise<AdminResult> {
  const actor = await requireAdmin();
  const result = await refundPayment(paymentId, actor.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/admin/payments');
  return { ok: true };
}

export async function recheckPayment(paymentId: string): Promise<AdminResult> {
  await requireStaff();
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found.' };
  await verifyAndApplyPayment(paymentId);
  revalidatePath('/admin/payments');
  return { ok: true };
}

/* --------------------------------------------------------------------- notes */

export async function addClientNote(input: unknown): Promise<AdminResult> {
  const actor = await requireStaff();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Please write a short note.', errors: fieldErrors(parsed.error) };
  }

  await createClientNote({
    clientUserId: parsed.data.clientUserId,
    authorUserId: actor.id,
    appointmentId: parsed.data.appointmentId ?? null,
    category: parsed.data.category,
    body: parsed.data.body,
  });

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'client_note.created',
    entity: 'client_note',
    entityId: parsed.data.clientUserId,
  });

  revalidatePath(`/admin/clients/${parsed.data.clientUserId}`);
  return { ok: true };
}

/* ------------------------------------------------------------- availability */

export async function blockTime(input: {
  date: string;
  start?: string | null;
  end?: string | null;
  reason: string;
}): Promise<AdminResult> {
  const actor = await requireStaff();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: 'Choose a date.' };
  if (!input.reason.trim()) return { ok: false, error: 'Add a short reason.' };
  if (input.start && input.end && input.start >= input.end) {
    return { ok: false, error: 'The end time must be after the start time.' };
  }

  await createAvailabilityBlock({
    practitionerId: 'prc_practice',
    date: input.date,
    start: input.start || null,
    end: input.end || null,
    reason: input.reason.trim(),
  });

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'availability.blocked',
    entity: 'availability_block',
    meta: input,
  });

  revalidatePath('/admin/calendar');
  revalidatePath('/book');
  return { ok: true };
}

export async function unblockTime(blockId: string): Promise<AdminResult> {
  await requireStaff();
  await deleteAvailabilityBlock(blockId);
  revalidatePath('/admin/calendar');
  revalidatePath('/book');
  return { ok: true };
}

/* ----------------------------------------------------------------- settings */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const whole = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

/**
 * What the Settings screen may change. Anything not listed here — the payment
 * provider, the calendar connection, the medical aid co-payment — is decided
 * by the server and the deploy, never by the browser.
 */
const settingsInputSchema = z.object({
  business: z.object({
    name: z.string().trim().min(1, 'Add the practice name.').max(120),
    email: z.string().trim().email('Enter a valid practice email address.'),
    phone: z.string().trim().max(40),
    website: z.string().trim().max(200),
  }),
  scheduling: z.object({
    slotIntervalMinutes: z.coerce.number().refine((n) => [15, 30, 60].includes(n), 'Choose 15, 30 or 60 minutes.'),
    bufferMinutes: whole(0, 120),
    minNoticeHours: whole(0, 336),
    maxAdvanceDays: whole(7, 365),
    cancellationWindowHours: whole(0, 168),
  }),
  reminders: z.object({
    dayBefore: z.boolean(),
    dayOf: z.boolean(),
    checkIn: z.boolean(),
  }),
  policy: z.object({
    cancellation: z.string().trim().min(1, 'The cancellation policy cannot be empty.').max(2000),
  }),
  banking: z.object({
    accountName: z.string().trim().max(120),
    bank: z.string().trim().max(80),
    accountNumber: z.string().trim().regex(/^\d*$/, 'The account number may only contain digits.').max(20),
    branchCode: z.string().trim().regex(/^\d*$/, 'The branch code may only contain digits.').max(10),
    showOnInvoices: z.boolean(),
  }),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;

export async function saveSettings(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the settings.' };
  }
  const data = parsed.data;
  const current = await getSettings();

  // Each section is written whole (the merge in updateSettings is per
  // section), so fields this screen does not show are carried over as-is.
  await updateSettings({
    business: { ...current.business, ...data.business },
    scheduling: { ...current.scheduling, ...data.scheduling },
    reminders: {
      ...current.reminders,
      // The reminder jobs only check whether these are set: reminders always
      // go out at 06:00 on the day before and the day of the session, and the
      // check-in the morning after.
      firstReminderHours: data.reminders.dayBefore ? 24 : 0,
      secondReminderHours: data.reminders.dayOf ? 2 : null,
      followUpAfterHours: data.reminders.checkIn ? 24 : 0,
    },
    policy: { ...current.policy, ...data.policy },
    banking: { ...current.banking, ...data.banking },
  });
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'settings.updated',
    entity: 'settings',
    meta: { sections: Object.keys(data) },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/book');
  return { ok: true };
}

const openingHoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      open: z.boolean(),
      start: z.string().regex(TIME),
      end: z.string().regex(TIME),
    }),
  )
  .length(7);

/** The weekly hours clients can book in. Days marked closed get no times. */
export async function saveOpeningHours(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const parsed = openingHoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the opening hours.' };

  const days = parsed.data;
  if (new Set(days.map((d) => d.weekday)).size !== 7) {
    return { ok: false, error: 'Please check the opening hours.' };
  }
  const open = days.filter((d) => d.open);
  const backwards = open.find((d) => d.start >= d.end);
  if (backwards) {
    return { ok: false, error: `${WEEKDAY_NAMES[backwards.weekday]}: closing time must be after opening time.` };
  }

  await replaceWeeklyHours(open.map(({ weekday, start, end }) => ({ weekday, start, end })));
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'opening_hours.updated',
    entity: 'settings',
    meta: { hours: open },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/admin/calendar');
  revalidatePath('/book');
  return { ok: true };
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Sends a test email to the practice address saved in Settings. */
export async function sendSettingsTestEmail(): Promise<AdminResult> {
  await requireAdmin();
  const { business } = await getSettings();
  if (!business.email) return { ok: false, error: 'Add the practice email address first.' };
  const result = await sendTestEmail(business.email);
  revalidatePath('/admin/notifications');
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? 'The email could not be sent.' };
}

/* ------------------------------------------------------------ notifications */

export async function markNotificationsSeen(ids: string[]): Promise<AdminResult> {
  await requireStaff();
  await markNotificationsRead(ids);
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
  return { ok: true };
}
