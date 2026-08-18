import { z } from 'zod';

/**
 * Every write path validates through these schemas server-side.
 * The client forms use the same shapes so validation messages match exactly.
 */

const nameField = z
  .string()
  .trim()
  .min(2, 'Please enter at least 2 characters')
  .max(60, 'That looks too long')
  // Deliberately permissive: SA names include hyphens, apostrophes, spaces.
  .regex(/^[\p{L}\p{M}'\- .]+$/u, 'Letters, spaces, hyphens and apostrophes only');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Please enter your email address')
  .max(160)
  .email('That email address does not look right');

/** SA mobile: 0XX XXX XXXX or +27XXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^(\+27|0)[6-8][0-9]{8}$/.test(v), 'Enter a valid South African mobile number');

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const registerSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  consentTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the terms to continue' }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Please enter your password'),
});

export const profileSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  phone: phoneSchema,
  dateOfBirth: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use the date picker'),
  preferredContact: z.enum(['email', 'whatsapp', 'sms']),
});

export const medicalAidSchema = z.object({
  scheme: z.string().trim().min(2, 'Which scheme are you with?').max(80),
  memberNumber: z.string().trim().min(3, 'Enter your membership number').max(40),
  mainMember: z.string().trim().min(2, 'Who is the main member?').max(80),
});

export const bookingSchema = z
  .object({
    serviceId: z.string().min(1, 'Choose a service'),
    mode: z.enum(['online', 'in_person']),
    locationId: z.string().nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time'),
    firstName: nameField,
    lastName: nameField,
    email: emailSchema,
    phone: phoneSchema,
    reason: z.string().trim().max(1000, 'Please keep this under 1000 characters').optional(),
    isFirstSession: z.boolean().default(true),
    paymentMethod: z.enum(['card', 'medical_aid']),
    medicalAid: medicalAidSchema.optional().nullable(),
    consentTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm you accept the terms' }),
    }),
    consentAge: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm the age requirement' }),
    }),
  })
  .refine((v) => v.mode !== 'in_person' || Boolean(v.locationId), {
    message: 'Choose which practice you would like to visit',
    path: ['locationId'],
  })
  .refine((v) => v.paymentMethod !== 'medical_aid' || Boolean(v.medicalAid), {
    message: 'Please add your medical aid details',
    path: ['medicalAid'],
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const followUpSchema = z.object({
  clientUserId: z.string().min(1, 'Choose a client'),
  serviceId: z.string().min(1, 'Choose a service'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a follow-up date'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  mode: z.enum(['online', 'in_person']),
  locationId: z.string().nullable().optional(),
  paymentRequired: z.boolean(),
  amountRands: z.coerce.number().min(0).max(100000),
  reminderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a reminder date'),
  channel: z.enum(['email', 'whatsapp', 'sms']),
  notes: z.string().trim().max(1000).optional(),
  sourceAppointmentId: z.string().optional().nullable(),
});

export const cancelSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
  acknowledgePolicy: z.boolean().optional(),
});

export const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const noteSchema = z.object({
  clientUserId: z.string().min(1),
  category: z.enum(['admin', 'session_admin', 'billing']),
  body: z.string().trim().min(2, 'Write a short note').max(2000),
  appointmentId: z.string().optional().nullable(),
});

export const contactSchema = z.object({
  name: nameField,
  email: emailSchema,
  phone: z.string().trim().max(20).optional(),
  topic: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10, 'Tell us a little more').max(2000),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm we may reply to you' }),
  }),
});

/** Flatten a ZodError into { field: message } for inline form feedback. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
