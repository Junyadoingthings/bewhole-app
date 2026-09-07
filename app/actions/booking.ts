'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { bookingSchema, cancelSchema, fieldErrors, rescheduleSchema } from '@/lib/validation';
import { cancelAppointment, createBooking, moveAppointment } from '@/services/booking.service';
import {
  createCheckoutForAppointment,
  createEmbeddedCheckoutForAppointment,
  verifyAndApplyPayment,
} from '@/services/payment.service';
import { getAppointment } from '@/lib/db';

export interface BookingActionResult {
  ok: boolean;
  error?: string;
  errors?: Record<string, string>;
  reference?: string;
  appointmentId?: string;
  checkoutUrl?: string | null;
  requiresPayment?: boolean;
  accountCreated?: boolean;
}

/**
 * Create a booking.
 *
 * Everything the browser sends is treated as a proposal: the price, the slot
 * and the identity are all resolved server-side before anything is written.
 */
export async function submitBooking(payload: unknown): Promise<BookingActionResult> {
  const limit = rateLimit(clientKey(headers(), 'booking'), LIMITS.booking);
  if (!limit.ok) {
    return {
      ok: false,
      error: 'That is a lot of bookings in a short time. Please call us on 063 883 7170.',
    };
  }

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.', errors: fieldErrors(parsed.error) };
  }

  const user = await getCurrentUser();
  const ipHash = hashIp(headers().get('x-forwarded-for'));

  const result = await createBooking(parsed.data, user, { ipHash });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      errors: result.field ? { [result.field]: result.error } : undefined,
    };
  }

  const { appointment, requiresPayment, checkoutUrl, accountCreated } = result.data;

  // Lets the confirmation page be viewed by the browser that made the booking
  // without exposing appointment details behind a guessable URL.
  cookies().set(`bwc_booking_${appointment.reference}`, appointment.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  revalidatePath('/portal');
  revalidatePath('/admin');

  return {
    ok: true,
    reference: appointment.reference,
    appointmentId: appointment.id,
    requiresPayment,
    checkoutUrl,
    accountCreated,
  };
}

/** Start (or resume) payment for an existing appointment. */
export async function startPayment(appointmentId: string): Promise<BookingActionResult> {
  const user = await getCurrentUser();
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };

  // A client may only pay for their own appointment.
  if (user && user.role === 'CLIENT' && appointment.clientUserId !== user.id) {
    return { ok: false, error: 'That appointment is not on your account.' };
  }
  if (!user) {
    const cookieOwner = cookies().get(`bwc_booking_${appointment.reference}`)?.value;
    if (cookieOwner !== appointment.id) {
      return { ok: false, error: 'Please sign in to pay for this appointment.' };
    }
  }

  const checkout = await createCheckoutForAppointment(appointmentId);
  if (!checkout.ok) return { ok: false, error: checkout.error };
  return { ok: true, checkoutUrl: checkout.redirectUrl, appointmentId };
}

export async function cancelBooking(input: {
  appointmentId: string;
  reason?: string;
}): Promise<BookingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in first.' };

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Something was missing from that request.' };

  const appointment = await getAppointment(parsed.data.appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };
  if (user.role === 'CLIENT' && appointment.clientUserId !== user.id) {
    return { ok: false, error: 'That appointment is not on your account.' };
  }

  const result = await cancelAppointment(parsed.data.appointmentId, user, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/portal');
  revalidatePath('/portal/appointments');
  revalidatePath('/admin');
  return { ok: true };
}

export async function rescheduleBooking(input: {
  appointmentId: string;
  date: string;
  time: string;
}): Promise<BookingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in first.' };

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please choose a date and time.' };

  const appointment = await getAppointment(parsed.data.appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };
  if (user.role === 'CLIENT' && appointment.clientUserId !== user.id) {
    return { ok: false, error: 'That appointment is not on your account.' };
  }

  const result = await moveAppointment(
    parsed.data.appointmentId,
    parsed.data.date,
    parsed.data.time,
    user,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/portal');
  revalidatePath('/portal/appointments');
  revalidatePath('/admin');
  return { ok: true };
}

/** Consent records store a hash, never the address itself (POPIA minimisation). */
function hashIp(value: string | null) {
  if (!value) return null;
  const ip = value.split(',')[0].trim();
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.SESSION_SECRET ?? 'bwc'))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Start an in-page payment for a booking this browser just made.
 *
 * Ownership is the same check as startPayment: your own appointment, or the
 * booking cookie set when this browser created it.
 */
export async function startEmbeddedPayment(appointmentId: string): Promise<
  | { ok: true; paymentId: string; embedded: { checkoutId: string; scriptUrl: string; brands: string; resultUrl: string } }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  const appointment = await getAppointment(appointmentId);
  if (!appointment) return { ok: false, error: 'We could not find that appointment.' };

  if (user && user.role === 'CLIENT' && appointment.clientUserId !== user.id) {
    return { ok: false, error: 'That appointment is not on your account.' };
  }
  if (!user) {
    const cookieOwner = cookies().get(`bwc_booking_${appointment.reference}`)?.value;
    if (cookieOwner !== appointment.id) {
      return { ok: false, error: 'Please sign in to pay for this appointment.' };
    }
  }

  const result = await createEmbeddedCheckoutForAppointment(appointmentId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, paymentId: result.paymentId, embedded: result.embedded };
}

/**
 * Development only: settle a simulated payment.
 *
 * Refuses outright when a real gateway is configured, so it can never be used
 * to mark a live payment as paid.
 */
export async function settleMockPayment(
  checkoutId: string,
  outcome: 'paid' | 'failed',
): Promise<{ ok: boolean; error?: string }> {
  const { getPaymentProvider, settleMockCheckout, isProductionRuntime } = await import(
    '@/services/payments'
  );
  /**
   * Two independent refusals, because the earlier single check had a gap.
   *
   * Asking only "is a real gateway configured?" passes in precisely the
   * dangerous case — a production deployment with no gateway at all, where the
   * provider is the mock and this action would happily mark bookings paid.
   */
  if (isProductionRuntime()) {
    return { ok: false, error: 'Simulated payments are not available on the live site.' };
  }
  if (getPaymentProvider().name !== 'mock') {
    return { ok: false, error: 'Simulated payments are disabled when a real gateway is configured.' };
  }

  settleMockCheckout(checkoutId, outcome);

  const { getPaymentByCheckoutId } = await import('@/lib/db');
  const payment = await getPaymentByCheckoutId(checkoutId);
  if (!payment) return { ok: false, error: 'Payment not found' };

  // Goes through the same verification path as a real gateway callback.
  await verifyAndApplyPayment(payment.id);
  revalidatePath('/portal');
  revalidatePath('/admin');
  return { ok: true };
}
