'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { waitUntil } from '@vercel/functions';
import { Resend } from 'resend';

import { getCurrentUser } from '@/lib/auth';
import { displayTime, formatFullDate } from '@/lib/date';
import { withTimeout } from '@/lib/db/with-timeout';
import { OUTBOUND_TIMEOUT_MS } from '@/lib/outbound';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { bookingSchema, cancelSchema, fieldErrors, rescheduleSchema } from '@/lib/validation';
import { cancelAppointment, createBooking, moveAppointment } from '@/services/booking.service';
import {
  createCheckoutForAppointment,
  createEmbeddedCheckoutForAppointment,
  verifyAndApplyPayment,
} from '@/services/payment.service';
import { getAppointment } from '@/lib/db';

/**
 * Created on first use, and only with a key. `new Resend()` throws without
 * one, and at module level that failed every booking — not just the email.
 */
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return (resendClient ??= new Resend(process.env.RESEND_API_KEY));
}

/**
 * The email's wording follows the booking's real status. It used to say
 * "Booking Confirmed" for every booking — including a medical aid booking the
 * practice had not yet approved and a card booking not yet paid for, minutes
 * before a second email said the opposite.
 */
function bookingEmailCopy(status: string) {
  if (status === 'pending_medical_aid') {
    return {
      heading: 'Booking Received',
      intro:
        'Thank you for booking. We have held this time for you while we confirm your medical aid cover — usually within one working day. Your session is confirmed once that check is done. Here are your session details:',
    };
  }
  if (status === 'pending_payment') {
    return {
      heading: 'Almost There',
      intro:
        'We have held this time for you. Your session is confirmed once your payment is received. Here are your session details:',
    };
  }
  return {
    heading: 'Booking Confirmed',
    intro:
      'Your appointment has been successfully scheduled. We look forward to seeing you. Here are your session details:',
  };
}

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

  // Premium, minimalist HTML confirmation email matched to the brand UI.
  //
  // Sent after the response, with a time limit: it used to be awaited here, so
  // the client's "Please wait…" lasted as long as Resend took to answer — and
  // Resend's client has no timeout of its own.
  const resend = getResend();
  const copy = bookingEmailCopy(appointment.status);
  const send = resend?.emails.send({
    from: process.env.EMAIL_FROM ?? 'Be Whole Care <onboarding@resend.dev>',
    replyTo: process.env.EMAIL_REPLY_TO ?? 'bewholecare@gmail.com',
    to: [parsed.data.email],
    subject: `${copy.heading} - Ref: ${appointment.reference}`,
    html: `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #f7f9f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f9f8; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">

                  <!-- Header with Logo -->
                  <tr>
                    <td style="padding: 40px 40px 10px; text-align: center;">
                      <img src="https://bewholecare.co.za/logo.png" alt="Be Whole. CARE" width="180" style="display: block; margin: 0 auto; border: 0; max-width: 100%; height: auto;">
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 0 40px 30px;">
                      <h1 style="color: #113624; font-size: 22px; font-weight: 600; margin: 20px 0 20px; text-align: center;">${copy.heading}</h1>
                      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Hello ${parsed.data.firstName},</p>
                      <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">${copy.intro}</p>

                      <!-- Booking Details Card -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fcfcfc; border: 1px solid #edf2f7; border-radius: 8px;">
                        <tr>
                          <td style="padding: 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding-bottom: 12px; border-bottom: 1px solid #edf2f7;">
                                  <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a0aec0; margin-bottom: 4px;">Reference</span>
                                  <strong style="color: #1a202c; font-size: 15px;">${appointment.reference}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 12px 0; border-bottom: 1px solid #edf2f7;">
                                  <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a0aec0; margin-bottom: 4px;">Date</span>
                                  <strong style="color: #1a202c; font-size: 15px;">${formatFullDate(parsed.data.date)}</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-top: 12px;">
                                  <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a0aec0; margin-bottom: 4px;">Time</span>
                                  <strong style="color: #1a202c; font-size: 15px;">${displayTime(parsed.data.time)}</strong>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                        <strong style="color: #4a5568;">Need to make changes?</strong><br>
                        If you need to reschedule or cancel, please ensure you do so at least 24 hours in advance.
                      </p>
                    </td>
                  </tr>

                  <!-- Minimalist Footer -->
                  <tr>
                    <td style="background-color: #113624; padding: 24px 40px; text-align: center;">
                      <p style="color: #ffffff; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0;"><strong>Be Whole Care</strong></p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
    `,
  });
  if (send) {
    waitUntil(
      withTimeout(
        send.then(({ error }) => error?.message ?? null),
        'timed out',
        OUTBOUND_TIMEOUT_MS,
      )
        .then((failure) => {
          if (failure) console.error('[booking] Failed to send confirmation email:', failure);
        })
        .catch((emailError) => {
          console.error('[booking] Failed to send confirmation email:', emailError);
        }),
    );
  }

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