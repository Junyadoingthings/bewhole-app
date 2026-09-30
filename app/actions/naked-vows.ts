'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { BUSINESS } from '@/config/business';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { emailSchema, fieldErrors, phoneSchema } from '@/lib/validation';
import { notify } from '@/services/notifications';

/**
 * Naked Vows — register interest.
 *
 * The annual couples event is invitation-based: the practice wants to speak to
 * a couple before inviting them, rather than selling tickets. So this captures
 * interest and notifies the practice; it does NOT book, charge or confirm
 * anything, and the copy on the form says so.
 *
 * Deliberately not a database table. Until there is a second event and a real
 * need to manage a list, an email to the practice is the honest amount of
 * machinery for this — and it lands in the same Notifications screen as every
 * other enquiry.
 */
const interestSchema = z.object({
  names: z
    .string()
    .trim()
    .min(2, 'Please tell us who you both are')
    .max(120),
  email: emailSchema,
  phone: phoneSchema,
  message: z.string().trim().max(1000).optional(),
});

export interface NakedVowsState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  errors?: Record<string, string>;
}

export async function registerNakedVowsInterest(
  _prev: NakedVowsState,
  formData: FormData,
): Promise<NakedVowsState> {
  const limit = rateLimit(clientKey(headers(), 'contact'), LIMITS.contact);
  if (!limit.ok) {
    return {
      status: 'error',
      message: `Too many submissions from this device. Please try again shortly, or WhatsApp us on ${BUSINESS.phone}.`,
    };
  }

  // Honeypot: a real person never fills this in.
  if (formData.get('company')) {
    return { status: 'success', message: 'Thank you — we have your details.' };
  }

  const parsed = interestSchema.safeParse({
    names: formData.get('names'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    message: formData.get('message') || undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      errors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  await notify({
    type: 'nakedvows.interest',
    audience: 'staff',
    channels: ['email', 'in_app'],
    to: { email: BUSINESS.email },
    subject: 'Naked Vows — interest registered',
    body:
      'A couple has registered their interest in Naked Vows.' +
      (data.message ? `\n\nTheir message:\n${data.message}` : ''),
    details: [
      { label: 'Couple', value: data.names },
      { label: 'Email', value: data.email },
      { label: 'Phone', value: data.phone },
    ],
    href: '/admin',
  });

  await notify({
    type: 'nakedvows.acknowledgement',
    audience: 'client',
    channels: ['email'],
    to: { email: data.email },
    subject: 'Thank you for your interest in Naked Vows',
    heading: 'Thank you for your interest',
    greeting: data.names,
    body:
      'Thank you for registering your interest in Naked Vows, our marriage programme for couples.\n\n' +
      'Ntombi will be in contact with you personally before the next gathering. In the meantime, ' +
      'you are welcome to join our marriage resources channel for ongoing encouragement.',
  });

  return {
    status: 'success',
    message: 'Thank you — your details are with us. Ntombi will be in touch personally.',
  };
}
