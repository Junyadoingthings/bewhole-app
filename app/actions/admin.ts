'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin, requireStaff } from '@/lib/auth';
import { today } from '@/lib/date';
import {
  audit,
  bumpCounter,
  createAvailabilityBlock,
  createClientNote,
  deleteAvailabilityBlock,
  getAppointment,
  getPayment,
  updateAppointment,
} from '@/lib/db';
import { calendarFeedUrls } from '@/lib/links';
import { noteSchema, fieldErrors } from '@/lib/validation';
import { cancelAppointment, decideMedicalAid, markAppointmentStatus } from '@/services/booking.service';
import {
  recordDirectPayment,
  recordPaymentNotReceived,
  recordPaymentReceived,
  refundPayment,
  undoPaymentReceived,
  verifyAndApplyPayment,
} from '@/services/payment.service';
import { emit, emitAfterResponse } from '@/services/events';
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
    emitAfterResponse({ type: 'appointment.session_link_added', appointmentId });
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
  emitAfterResponse({ type: 'appointment.confirmed', appointmentId });
  return { ok: true };
}

/* ------------------------------------------------------------------ payments */

/** Rands typed into the console → whole cents, or null if it is not a positive amount. */
function toCents(rands: unknown): number | null {
  const value = Number(String(rands ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100);
}

/** A received date: a real day, not in the future. */
function receivedOnOk(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && value <= today();
}

function refreshMoneyPages() {
  revalidatePath('/admin/payments');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
  revalidatePath('/portal/payments');
}

/** Tick a payment off as received, with the amount that actually arrived and when. */
export async function markPaymentReceived(
  paymentId: string,
  input: { amountRands: string; receivedOn: string },
): Promise<AdminResult> {
  const actor = await requireAdmin();
  const amountCents = toCents(input.amountRands);
  if (!amountCents) return { ok: false, error: 'Enter the amount received, in rand.' };
  if (!receivedOnOk(input.receivedOn)) return { ok: false, error: 'Choose the day it was received (not in the future).' };
  const result = await recordPaymentReceived(paymentId, { amountCents, receivedOn: input.receivedOn }, actor.id);
  if (!result.ok) return { ok: false, error: result.error };
  refreshMoneyPages();
  return { ok: true };
}

/** The money is not coming — e.g. the medical aid scheme declined the claim. */
export async function markPaymentNotReceived(paymentId: string, reason: string): Promise<AdminResult> {
  const actor = await requireAdmin();
  const result = await recordPaymentNotReceived(paymentId, reason.trim().slice(0, 300), actor.id);
  if (!result.ok) return { ok: false, error: result.error };
  refreshMoneyPages();
  return { ok: true };
}

/** Undo a tick made by mistake: the line goes back to awaiting. */
export async function undoPaymentTick(paymentId: string): Promise<AdminResult> {
  const actor = await requireAdmin();
  const result = await undoPaymentReceived(paymentId, actor.id);
  if (!result.ok) return { ok: false, error: result.error };
  refreshMoneyPages();
  return { ok: true };
}

/** Money taken directly for a booking (EFT, cash, a quoted fee, a scheme payment). */
export async function recordAppointmentPayment(
  appointmentId: string,
  input: { amountRands: string; method: 'card' | 'medical_aid'; receivedOn: string },
): Promise<AdminResult> {
  const actor = await requireAdmin();
  const amountCents = toCents(input.amountRands);
  if (!amountCents) return { ok: false, error: 'Enter the amount received, in rand.' };
  if (!receivedOnOk(input.receivedOn)) return { ok: false, error: 'Choose the day it was received (not in the future).' };
  if (input.method !== 'card' && input.method !== 'medical_aid') return { ok: false, error: 'Choose who paid.' };
  const result = await recordDirectPayment(
    appointmentId,
    { amountCents, method: input.method, receivedOn: input.receivedOn },
    actor.id,
  );
  if (!result.ok) return { ok: false, error: result.error };
  refreshMoneyPages();
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

/* ------------------------------------------------------ calendar subscription */

/**
 * Issue a new calendar subscription link. The old link stops working at once
 * — for when it may have been shared by mistake.
 */
export async function resetCalendarFeedLink(): Promise<AdminResult & { https?: string; webcal?: string }> {
  const actor = await requireAdmin();
  const version = await bumpCounter('calendar_feed');
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'calendar_feed.reset',
    entity: 'calendar_feed',
  });
  revalidatePath('/admin/calendar');
  return { ok: true, ...calendarFeedUrls(version) };
}
