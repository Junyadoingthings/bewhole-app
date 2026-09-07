import 'server-only';

import crypto from 'node:crypto';

import {
  audit,
  createAppointmentIfFree,
  createUserWithProfile,
  findUserByEmail,
  getAppointment,
  getService,
  getSettings,
  hydrateAppointments,
  newId,
  newReference,
  nowISO,
  recordConsent,
  rescheduleAppointment,
  updateAppointment,
  updateProfile,
} from '@/lib/db';
import { COUNSELLING_CONSENT } from '@/config/business';
import { hashPassword } from '@/lib/auth/password';
import { fromLocalParts, hoursUntil, parts } from '@/lib/date';
import { emit } from '@/services/events';
import { createCheckoutForAppointment } from '@/services/payment.service';
import { resolveSlot } from '@/services/availability.service';
import type { Appointment, AppointmentView, ID, SessionUser } from '@/types';
import type { BookingInput } from '@/lib/validation';
import { paymentsAreLive } from '@/services/payments';

/**
 * Booking orchestration.
 *
 * Ordering matters here:
 *   1. price the session server-side (never trust an amount from the client)
 *   2. re-check availability
 *   3. claim the slot atomically
 *   4. only then create a payment
 *
 * A booking that fails at step 3 has cost nothing; a payment is never created
 * for a slot we do not hold.
 */

export interface PricedSession {
  amountCents: number;
  requiresPayment: boolean;
  label: string;
  note?: string;
}

/** Server-side pricing. The client sends a service and a mode, never a price. */
export async function priceSession(
  serviceId: ID,
  mode: 'online' | 'in_person',
  paymentMethod: 'card' | 'medical_aid',
): Promise<PricedSession> {
  const [service, settings] = await Promise.all([getService(serviceId), getSettings()]);
  if (!service) return { amountCents: 0, requiresPayment: false, label: 'Unavailable' };

  if (service.rateBand === 'free') {
    return { amountCents: 0, requiresPayment: false, label: 'Free', note: service.intakeNote ?? undefined };
  }

  if (service.requiresQuote) {
    return {
      amountCents: 0,
      requiresPayment: false,
      label: 'Fee confirmed after intake',
      note: service.intakeNote ?? undefined,
    };
  }

  if (paymentMethod === 'medical_aid') {
    const co = mode === 'in_person' ? settings.payments.medicalAidCoPaymentCents : 0;
    return {
      amountCents: co,
      requiresPayment: co > 0,
      label: co > 0 ? 'Medical aid co-payment' : 'Claimed from your medical aid',
      note:
        mode === 'in_person'
          ? 'A R100 co-payment applies to in-person consultations using medical aid benefits.'
          : 'Your session will be submitted to your scheme. Any amount not covered remains your responsibility.',
    };
  }

  const amountCents = mode === 'online' ? service.priceOnlineCents : service.priceInPersonCents;

  /**
   * No gateway, no online payment — and no pretending otherwise.
   *
   * When the practice has not connected a payment gateway, the fee is still
   * quoted so nobody is surprised by it, but the session is confirmed on
   * booking and settled directly with the practice. The alternative, which
   * this replaced, was a simulated checkout that marked bookings paid without
   * any money moving.
   *
   * The amount is still returned: the client should see what the session
   * costs. Only `requiresPayment` changes, and with it the appointment status,
   * which becomes 'confirmed' rather than 'pending_payment'.
   */
  if (amountCents > 0 && !paymentsAreLive()) {
    return {
      amountCents,
      requiresPayment: false,
      label: 'Payable to the practice',
      note: 'Your session is confirmed. The practice will send payment details before your appointment.',
    };
  }

  return { amountCents, requiresPayment: amountCents > 0, label: 'Private card payment' };
}

export interface CreateBookingResult {
  appointment: Appointment;
  requiresPayment: boolean;
  checkoutUrl?: string | null;
  /** Set when the booking created a brand-new account. */
  accountCreated: boolean;
}

export async function createBooking(
  input: BookingInput,
  actor: SessionUser | null,
  meta: { ipHash?: string | null } = {},
): Promise<{ ok: true; data: CreateBookingResult } | { ok: false; error: string; field?: string }> {
  const service = await getService(input.serviceId);
  if (!service || !service.active) return { ok: false, error: 'That service is not available.', field: 'serviceId' };
  if (input.mode === 'online' && !service.allowsOnline)
    return { ok: false, error: 'This service is only offered in person.', field: 'mode' };
  if (input.mode === 'in_person' && !service.allowsInPerson)
    return { ok: false, error: 'This service is only offered online.', field: 'mode' };

  const query = {
    serviceId: input.serviceId,
    mode: input.mode,
    locationId: input.mode === 'in_person' ? (input.locationId ?? null) : null,
  };

  // Availability is re-derived server-side; the client's view may be stale.
  const slot = await resolveSlot(input.date, input.time, query);
  if (!slot.ok) return { ok: false, error: slot.reason, field: 'time' };

  const pricing = await priceSession(input.serviceId, input.mode, input.paymentMethod);

  /* -------------------------------------------------- resolve the account */
  let accountCreated = false;
  let clientUserId: ID;

  if (actor && actor.role === 'CLIENT') {
    clientUserId = actor.id;
  } else if (actor) {
    // Staff booking on a client's behalf still resolves by email.
    clientUserId = await resolveOrCreateClient(input, () => (accountCreated = true));
  } else {
    clientUserId = await resolveOrCreateClient(input, () => (accountCreated = true));
  }

  /**
   * Persist what the booking form collected about the person, not just the
   * appointment. Address and emergency contact belong on the profile: they are
   * facts about the client that outlive any single session, and the practice
   * needs them findable from the client record rather than by opening whichever
   * booking happened to capture them.
   *
   * Written in one update so a booking costs at most one profile write.
   */
  const profilePatch: Parameters<typeof updateProfile>[1] = {};
  if (input.paymentMethod === 'medical_aid' && input.medicalAid) {
    profilePatch.medicalAid = input.medicalAid;
  }
  if (input.address?.trim()) profilePatch.address = input.address.trim();
  if (input.emergencyName?.trim()) {
    profilePatch.emergencyContactName = input.emergencyName.trim();
    profilePatch.emergencyContactPhone = input.emergencyPhone.trim();
  }
  if (Object.keys(profilePatch).length > 0) {
    await updateProfile(clientUserId, profilePatch);
  }

  /* ------------------------------------------------------- claim the slot */
  const start = fromLocalParts(input.date, input.time);
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);
  const ts = nowISO();

  const appointment: Appointment = {
    id: newId('apt'),
    reference: newReference(),
    clientUserId,
    serviceId: service.id,
    practitionerId: slot.slot.practitionerId ?? null,
    mode: input.mode,
    locationId: query.locationId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    durationMinutes: service.durationMinutes,
    status: pricing.requiresPayment ? 'pending_payment' : 'confirmed',
    paymentMethod: input.paymentMethod,
    amountCents: pricing.amountCents,
    reason: input.reason?.trim() || null,
    isFirstSession: input.isFirstSession,
    sessionLink: null,
    calendarEventId: null,
    createdAt: ts,
    updatedAt: ts,
  };

  const claim = await createAppointmentIfFree(appointment);
  if (!claim.ok) {
    return { ok: false, error: 'That time was taken a moment ago. Please choose another.', field: 'time' };
  }

  await recordConsent({
    userId: clientUserId,
    type: 'terms',
    version: '2026-01',
    granted: true,
    grantedAt: ts,
    ipHash: meta.ipHash ?? null,
  });
  /**
   * Informed consent, recorded honestly.
   *
   * This used to hardcode `granted: true` regardless of what the client
   * actually did — which would have made the consent record worthless as
   * evidence, since it said "yes" even when nothing was agreed. It now
   * reflects the clause-by-clause answers from the booking form, and carries
   * the consent document's own version so a future change to the wording does
   * not retroactively rewrite what past clients agreed to.
   *
   * A staff member booking on a client's behalf takes consent in the room, on
   * paper; `clinicalConsent` is absent there and the record is written as not
   * granted online, which is accurate rather than convenient.
   */
  const consentClauses = input.clinicalConsent ?? {};
  const consentGranted =
    COUNSELLING_CONSENT.items.length > 0 &&
    COUNSELLING_CONSENT.items.every((item) => consentClauses[item.id] === true);

  await recordConsent({
    userId: clientUserId,
    type: 'informed_consent',
    version: COUNSELLING_CONSENT.version,
    granted: consentGranted,
    grantedAt: ts,
    ipHash: meta.ipHash ?? null,
  });

  await audit({
    actorUserId: actor?.id ?? clientUserId,
    actorRole: actor?.role ?? 'CLIENT',
    action: 'appointment.created',
    entity: 'appointment',
    entityId: appointment.id,
    meta: { reference: appointment.reference, amountCents: appointment.amountCents },
  });

  await emit({ type: 'appointment.created', appointmentId: appointment.id });

  /* ------------------------------------------------------------- payment */
  if (!pricing.requiresPayment) {
    await emit({ type: 'appointment.confirmed', appointmentId: appointment.id });
    const refreshed = (await getAppointment(appointment.id)) ?? appointment;
    return { ok: true, data: { appointment: refreshed, requiresPayment: false, accountCreated } };
  }

  const checkout = await createCheckoutForAppointment(appointment.id);
  return {
    ok: true,
    data: {
      appointment,
      requiresPayment: true,
      checkoutUrl: checkout.ok ? checkout.redirectUrl : null,
      accountCreated,
    },
  };
}

/**
 * Find the client by email, or create a passwordless account for them.
 *
 * A random unusable password is set so the row is never login-able until the
 * client sets their own via the reset flow — we never email a password.
 */
async function resolveOrCreateClient(input: BookingInput, onCreate: () => void): Promise<ID> {
  const existing = await findUserByEmail(input.email);
  if (existing) return existing.id;

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString('base64url'));
  const { user } = await createUserWithProfile({
    email: input.email,
    passwordHash,
    role: 'CLIENT',
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  });
  onCreate();
  return user.id;
}

/* ---------------------------------------------------------- cancel / move */

export interface CancellationCheck {
  withinPolicy: boolean;
  hoursNotice: number;
  windowHours: number;
  message: string;
}

/** Never cancels silently: the caller must show this to the client first. */
export async function checkCancellationPolicy(appointmentId: ID): Promise<CancellationCheck | null> {
  const [appointment, settings] = await Promise.all([getAppointment(appointmentId), getSettings()]);
  if (!appointment) return null;

  const hours = hoursUntil(appointment.startAt);
  const windowHours = settings.scheduling.cancellationWindowHours;
  const withinPolicy = hours >= windowHours;

  return {
    withinPolicy,
    hoursNotice: Math.max(0, Math.round(hours)),
    windowHours,
    message: withinPolicy
      ? `You're cancelling with more than ${windowHours} hours' notice, so no fee applies.`
      : settings.policy.cancellation,
  };
}

export async function cancelAppointment(
  appointmentId: ID,
  actor: SessionUser,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };
  if (appointment.status === 'cancelled') return { ok: true };
  if (appointment.status === 'completed')
    return { ok: false, error: 'That session has already taken place.' };

  const policy = await checkCancellationPolicy(appointmentId);
  const late = policy ? !policy.withinPolicy : false;
  const byStaff = actor.role !== 'CLIENT';

  await updateAppointment(appointmentId, {
    status: 'cancelled',
    cancelledAt: nowISO(),
    cancelledBy: actor.id,
    cancellationReason: reason?.trim() || null,
    lateCancellation: late,
  });

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'appointment.cancelled',
    entity: 'appointment',
    entityId: appointmentId,
    meta: { late, byStaff },
  });

  await emit({ type: 'appointment.cancelled', appointmentId, byStaff, late });
  return { ok: true };
}

export async function moveAppointment(
  appointmentId: ID,
  date: string,
  time: string,
  actor: SessionUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };
  if (appointment.status === 'cancelled' || appointment.status === 'completed')
    return { ok: false, error: 'That appointment can no longer be moved.' };

  const slot = await resolveSlot(date, time, {
    serviceId: appointment.serviceId,
    mode: appointment.mode,
    locationId: appointment.locationId,
  });
  if (!slot.ok) return { ok: false, error: slot.reason };

  const previousStart = appointment.startAt;
  const result = await rescheduleAppointment(appointmentId, slot.slot.start, slot.slot.end);
  if (!result.ok) {
    return { ok: false, error: 'That time was taken a moment ago. Please choose another.' };
  }

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: 'appointment.rescheduled',
    entity: 'appointment',
    entityId: appointmentId,
    meta: { from: previousStart, to: slot.slot.start },
  });

  await emit({ type: 'appointment.rescheduled', appointmentId, previousStart });
  return { ok: true };
}

export async function markAppointmentStatus(
  appointmentId: ID,
  status: 'completed' | 'no_show' | 'confirmed',
  actor: SessionUser,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };

  await updateAppointment(appointmentId, {
    status,
    completedAt: status === 'completed' ? nowISO() : null,
  });

  await audit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: `appointment.${status}`,
    entity: 'appointment',
    entityId: appointmentId,
  });

  if (status === 'completed') await emit({ type: 'appointment.completed', appointmentId });
  if (status === 'confirmed') await emit({ type: 'appointment.confirmed', appointmentId });
  return { ok: true };
}

/** Shared display helper for confirmation screens and portal cards. */
export function appointmentDisplay(a: AppointmentView) {
  const p = parts(a.startAt);
  return {
    date: p.date,
    time: p.time,
    weekday: p.weekdayName,
    where:
      a.mode === 'online'
        ? 'Online'
        : a.location
          ? `${a.location.name} practice`
          : 'In person',
  };
}
