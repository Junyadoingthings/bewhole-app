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
    body: `From: ${data.name}\nEmail: ${data.email}${data.phone ? `\nPhone: ${data.phone}` : ''}\n\n${data.message}`,
    href: '/admin/notifications',
  });

  await notify({
    type: 'contact.acknowledgement',
    audience: 'client',
    channels: ['email'],
    to: { email: data.email },
    subject: 'We have your message',
    body: `Hi ${data.name.split(' ')[0]},\n\nThank you for getting in touch with Be Whole Care. Someone will come back to you during business hours — Monday to Friday 08:00–17:00, Saturdays 08:00–12:00.\n\nIf it's urgent, you can call or WhatsApp us on ${BUSINESS.phone}.\n\nWhat you sent us:\n"${data.message}"`,
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
