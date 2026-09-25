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

  /**
   * No email is sent from here.
   *
   * There used to be a second, inline confirmation email built and sent right
   * in this function — always titled "Booking Confirmed", even for a medical
   * aid booking still awaiting review or a card booking not yet paid. Every
   * booking already gets the correct email from `createBooking` above, via
   * `emitAfterResponse` -> the client-facing handlers in services/events.ts,
   * which choose the right message for the booking's actual status and use
   * the one branded template in services/notifications/index.ts. Sending a
   * second one here meant two emails per booking, sometimes disagreeing with
   * each other about whether the session was confirmed.
   */

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

export async function startPayment(appointmentId: string): Promise<BookingActionResult> {
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

function hashIp(value: string | null) {
  if (!value) return null;
  const ip = value.split(',')[0].trim();
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.SESSION_SECRET ?? 'bwc'))
    .digest('hex')
    .slice(0, 32);
}

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

export async function settleMockPayment(
  checkoutId: string,
  outcome: 'paid' | 'failed',
): Promise<{ ok: boolean; error?: string }> {
  const { getPaymentProvider, settleMockCheckout, isProductionRuntime } = await import(
    '@/services/payments'
  );
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

  await verifyAndApplyPayment(payment.id);
  revalidatePath('/portal');
  revalidatePath('/admin');
  return { ok: true };
}