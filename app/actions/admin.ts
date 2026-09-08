'use server';

import { revalidatePath } from 'next/cache';

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
  updateResource,
  updateService,
  updateSettings,
} from '@/lib/db';
import { noteSchema, fieldErrors } from '@/lib/validation';
import { cancelAppointment, decideMedicalAid, markAppointmentStatus } from '@/services/booking.service';
import { markPaymentReceivedManually, refundPayment, verifyAndApplyPayment } from '@/services/payment.service';
import { emit } from '@/services/events';
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
  await updateAppointment(appointmentId, { sessionLink: trimmed || null });
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
  await emit({ type: 'appointment.confirmed', appointmentId });
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

/* ---------------------------------------------------------------- catalogue */

export async function updateServicePricing(
  serviceId: string,
  input: { priceInPersonRands: number; priceOnlineRands: number; active: boolean },
): Promise<AdminResult> {
  const actor = await requireAdmin();
  if (input.priceInPersonRands < 0 || input.priceOnlineRands < 0) {
    return { ok: false, error: 'Prices cannot be negative.' };
  }

  await updateService(serviceId, {
    priceInPersonCents: Math.round(input.priceInPersonRands * 100),
    priceOnlineCents: Math.round(input.priceOnlineRands * 100),
    active: input.active,
  });

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'service.updated',
    entity: 'service',
    entityId: serviceId,
    meta: input as unknown as Record<string, unknown>,
  });

  revalidatePath('/admin/services');
  revalidatePath('/services');
  revalidatePath('/book');
  return { ok: true };
}

export async function toggleResourcePublished(
  resourceId: string,
  published: boolean,
): Promise<AdminResult> {
  const actor = await requireStaff();
  await updateResource(resourceId, { published });
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: published ? 'resource.published' : 'resource.unpublished',
    entity: 'resource',
    entityId: resourceId,
  });
  revalidatePath('/admin/resources');
  revalidatePath('/resources');
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

export async function saveSettings(patch: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const data = patch as Record<string, unknown>;

  await updateSettings(data as never);
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'settings.updated',
    entity: 'settings',
    meta: { keys: Object.keys(data) },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/book');
  return { ok: true };
}

/* ------------------------------------------------------------ notifications */

export async function markNotificationsSeen(ids: string[]): Promise<AdminResult> {
  await requireStaff();
  await markNotificationsRead(ids);
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
  return { ok: true };
}
