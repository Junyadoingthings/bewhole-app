'use server';

import { headers } from 'next/headers';

import { contactSchema, fieldErrors } from '@/lib/validation';
import { LIMITS, clientKey, rateLimit } from '@/lib/rate-limit';
import { notify } from '@/services/notifications';
import { audit } from '@/lib/db';
import { BUSINESS } from '@/config/business';

export interface ContactState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string>;
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const limit = rateLimit(clientKey(headers(), 'contact'), LIMITS.contact);
  if (!limit.ok) {
    return {
      status: 'error',
      message: `Too many messages from this device. Please try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, or call ${BUSINESS.phone}.`,
    };
  }

  // Honeypot: a real person never fills this in.
  if (formData.get('company')) {
    return { status: 'success', message: 'Thank you — your message has been sent.' };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    topic: formData.get('topic') || undefined,
    message: formData.get('message'),
    consent: formData.get('consent') === 'on',
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
    type: 'contact.message',
    audience: 'staff',
    channels: ['email', 'in_app'],
    to: { email: BUSINESS.email },
    subject: `Website enquiry — ${data.topic || 'General'}`,
    body: `A new enquiry has been submitted through the website.\n\n${data.message}`,
    details: [
      { label: 'Name', value: data.name },
      { label: 'Email', value: data.email },
      { label: 'Phone', value: data.phone || 'Not provided' },
      { label: 'Topic', value: data.topic || 'General' },
    ],
    href: '/admin/notifications',
  });

  await notify({
    type: 'contact.acknowledgement',
    audience: 'client',
    channels: ['email'],
    to: { email: data.email },
    subject: 'Thank you for contacting Be Whole Care',
    heading: 'Thank you for your message',
    greeting: data.name.split(' ')[0],
    body:
      'Thank you for contacting Be Whole Care. We have received your message, and a member of our ' +
      'team will respond during business hours: Monday to Friday, 08:00 to 17:00, and Saturday, ' +
      '08:00 to 12:00.\n\n' +
      // Written out rather than taken from BUSINESS.phone, which is empty —
      // this line used to read "call or WhatsApp us on ." as a result.
      'Should your matter be urgent, please call or WhatsApp us on 063 883 7170.\n\n' +
      `For your reference, your message read:\n“${data.message}”`,
  });

  await audit({
    actorUserId: null,
    action: 'contact.submitted',
    entity: 'contact',
    meta: { topic: data.topic ?? 'general' },
  });

  return {
    status: 'success',
    message: 'Thank you — your message is with us. We reply during business hours.',
  };
}
