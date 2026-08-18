import 'server-only';

import {
  audit,
  createAppointmentIfFree,
  createFollowUp,
  getFollowUp,
  getService,
  hydrateFollowUps,
  listFollowUps,
  newId,
  newReference,
  nowISO,
  updateFollowUp,
} from '@/lib/db';
import { fromLocalParts, today } from '@/lib/date';
import { emit, sendFollowUpConfirmed, sendFollowUpPaymentRequest, sendFollowUpReminder } from '@/services/events';
import { createCheckoutForFollowUp } from '@/services/payment.service';
import type { Appointment, FollowUp, FollowUpView, ID, SessionUser } from '@/types';

/**
 * Follow-up management — the workflow the practice specifically asked for:
 *
 *   staff records a follow-up  →  reminder is scheduled
 *   →  payment request goes out on the reminder date
 *   →  client pays  →  payment verified server-side
 *   →  follow-up confirmed  →  appointment created  →  calendar updated
 *   →  confirmation sent
 *
 * Each step below is one function, and each is safe to run twice.
 */

export interface CreateFollowUpInput {
  clientUserId: ID;
  serviceId: ID;
  dueDate: string;
  preferredTime?: string | null;
  mode: 'online' | 'in_person';
  locationId?: string | null;
  paymentRequired: boolean;
  amountCents: number;
  reminderDate: string;
  channel: 'email' | 'whatsapp' | 'sms';
  notes?: string | null;
  sourceAppointmentId?: string | null;
}

export async function createFollowUpRecord(
  input: CreateFollowUpInput,
  actor: SessionUser,
): Promise<{ ok: true; followUp: FollowUp } | { ok: false; error: string }> {
  const service = await getService(input.serviceId);
  if (!service) return { ok: false, error: 'That service no longer exists.' };
  if (input.reminderDate > input.dueDate)
    return { ok: false, error: 'The reminder must fall on or before the follow-up date.' };

  const ts = nowISO();
  const followUp: FollowUp = {
    id: newId('fup'),
    clientUserId: input.clientUserId,
    serviceId: input.serviceId,
    createdByUserId: actor.id,
    sourceAppointmentId: input.sourceAppointmentId ?? null,
    appointmentId: null,
    dueDate: input.dueDate,
    preferredTime: input.preferredTime ?? null,
    mode: input.mode,
    locationId: input.mode === 'in_person' ? (input.locationId ?? null) : null,
    paymentRequired: input.paymentRequired,
    amountCents: input.paymentRequired ? input.amountCents : 0,
    status: input.paymentRequired ? 'awaiting_payment' : 'scheduled',
    reminderDate: input.reminderDate,
    reminderSentAt: null,
    channel: input.channel,
    notes: input.notes?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
  };

  await createFollowUp(followUp);
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'followup.created',
    entity: 'follow_up',
    entityId: followUp.id,
    meta: { clientUserId: input.clientUserId, dueDate: input.dueDate },
  });
  await emit({ type: 'followup.created', followUpId: followUp.id });

  // A reminder dated today (or earlier) goes out immediately.
  if (followUp.reminderDate <= today()) {
    await dispatchFollowUp(followUp.id);
  }

  return { ok: true, followUp };
}

/**
 * Send the reminder — and, when payment is required, the payment request with
 * a fresh checkout link. Called by the cron worker and by the admin's
 * "Send now" action.
 */
export async function dispatchFollowUp(
  followUpId: ID,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp) return { ok: false, error: 'Follow-up not found' };
  if (followUp.status === 'cancelled' || followUp.status === 'completed') {
    return { ok: false, error: 'This follow-up is closed.' };
  }

  const [view] = await hydrateFollowUps([followUp]);

  if (followUp.paymentRequired && followUp.amountCents > 0) {
    const checkout = await createCheckoutForFollowUp(followUpId);
    const href = checkout.ok ? checkout.redirectUrl : '/portal/follow-ups';
    await sendFollowUpPaymentRequest(view, absolute(href));
    await updateFollowUp(followUpId, { status: 'awaiting_payment', reminderSentAt: nowISO() });
    await emit({ type: 'followup.payment_required', followUpId });
  } else {
    await sendFollowUpReminder(view);
    await updateFollowUp(followUpId, { reminderSentAt: nowISO() });
  }

  return { ok: true };
}

/**
 * Called from applyPaymentSuccess once a follow-up payment clears.
 * Creates the actual appointment and confirms it (which syncs the calendar).
 */
export async function confirmFollowUpPayment(followUpId: ID): Promise<void> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp) return;
  if (followUp.status === 'confirmed' || followUp.status === 'completed') return;

  await updateFollowUp(followUpId, { status: 'paid' });
  await emit({ type: 'followup.payment_received', followUpId });

  const appointmentId = await materialiseAppointment(followUpId);

  await updateFollowUp(followUpId, {
    status: 'confirmed',
    appointmentId: appointmentId ?? null,
  });

  const [view] = await hydrateFollowUps([(await getFollowUp(followUpId))!]);
  await sendFollowUpConfirmed(view);
  await emit({ type: 'followup.confirmed', followUpId });

  if (appointmentId) {
    await emit({ type: 'appointment.confirmed', appointmentId });
  }
}

/**
 * Turn a confirmed follow-up into a real appointment.
 *
 * If the preferred time has since been taken, the follow-up stays confirmed
 * but without an appointment — staff are shown a "needs a time" prompt rather
 * than the client silently losing their slot.
 */
async function materialiseAppointment(followUpId: ID): Promise<ID | null> {
  const followUp = await getFollowUp(followUpId);
  if (!followUp || followUp.appointmentId) return followUp?.appointmentId ?? null;

  const service = await getService(followUp.serviceId);
  if (!service) return null;

  const time = followUp.preferredTime ?? '09:00';
  const start = fromLocalParts(followUp.dueDate, time);
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);
  const ts = nowISO();

  const appointment: Appointment = {
    id: newId('apt'),
    reference: newReference(),
    clientUserId: followUp.clientUserId,
    serviceId: followUp.serviceId,
    practitionerId: 'prc_practice',
    mode: followUp.mode,
    locationId: followUp.locationId ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    durationMinutes: service.durationMinutes,
    status: 'confirmed',
    paymentMethod: 'card',
    amountCents: followUp.amountCents,
    reason: followUp.notes ?? null,
    isFirstSession: false,
    sessionLink: null,
    calendarEventId: null,
    followUpId,
    createdAt: ts,
    updatedAt: ts,
  };

  const claim = await createAppointmentIfFree(appointment);
  if (!claim.ok) return null;

  await audit({
    actorUserId: followUp.createdByUserId,
    action: 'appointment.created_from_followup',
    entity: 'appointment',
    entityId: appointment.id,
    meta: { followUpId },
  });

  return appointment.id;
}

export async function cancelFollowUp(followUpId: ID, actor: SessionUser) {
  await updateFollowUp(followUpId, { status: 'cancelled' });
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'followup.cancelled',
    entity: 'follow_up',
    entityId: followUpId,
  });
  return { ok: true as const };
}

export async function completeFollowUp(followUpId: ID, actor: SessionUser) {
  await updateFollowUp(followUpId, { status: 'completed' });
  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'followup.completed',
    entity: 'follow_up',
    entityId: followUpId,
  });
  return { ok: true as const };
}

/* ------------------------------------------------------------- dashboards */

export type FollowUpBucket = 'due' | 'overdue' | 'awaiting_payment' | 'upcoming' | 'completed';

export function bucketFollowUp(f: FollowUp): FollowUpBucket {
  const t = today();
  if (f.status === 'completed' || f.status === 'cancelled') return 'completed';
  if (f.status === 'awaiting_payment') return f.dueDate < t ? 'overdue' : 'awaiting_payment';
  if (f.dueDate < t) return 'overdue';
  if (f.dueDate === t) return 'due';
  return 'upcoming';
}

export async function getFollowUpBoard(): Promise<Record<FollowUpBucket, FollowUpView[]>> {
  const all = await listFollowUps();
  const views = await hydrateFollowUps(all);
  const board: Record<FollowUpBucket, FollowUpView[]> = {
    overdue: [],
    due: [],
    awaiting_payment: [],
    upcoming: [],
    completed: [],
  };
  for (const f of views) board[bucketFollowUp(f)].push(f);
  return board;
}

/** Follow-ups whose reminder date has arrived and which have not been sent. */
export async function pendingReminders(): Promise<FollowUp[]> {
  const t = today();
  const all = await listFollowUps();
  return all.filter(
    (f) =>
      !f.reminderSentAt &&
      f.reminderDate <= t &&
      (f.status === 'scheduled' || f.status === 'awaiting_payment'),
  );
}

function absolute(href: string) {
  if (href.startsWith('http')) return href;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:5600';
  return `${base}${href}`;
}
