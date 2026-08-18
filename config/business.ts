/**
 * Default business configuration for Be Whole Care.
 *
 * SOURCE OF TRUTH: https://imaginative-brown-jellyfish.bewholecare.co.za/en/
 * Every value here is taken verbatim from the live site. Nothing is invented.
 *
 * These are DEFAULTS ONLY. On first run they are written into the `settings`
 * table and from that point forward the admin dashboard is authoritative —
 * see services/settings.service.ts. Never read this file at request time for
 * anything an admin can change; read settings instead.
 */

export const BUSINESS = {
  name: 'Be Whole Care',
  legalName: 'Be Whole Care',
  tagline: 'A renewed mind, a prospering soul.',
  strapline: 'Professional. Ethical. Compassionate Care.',
  mission: 'Building stronger individuals. Nurturing healthier homes.',
  promise: 'We offer reliable, compassionate and affordable mental health care for all ages.',
  servicesPromise:
    'We provide confidential, ethical and client-centred counselling services you can trust.',
  website: 'www.bewholecare.co.za',
  email: 'bewholecare@gmail.com',
  phone: '0638837170',
  phoneE164: '+27638837170',
  whatsapp: '27638837170',
  instagram: 'https://www.instagram.com/_bewhole/',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  currencySymbol: 'R',
} as const;

export const BUSINESS_HOURS = [
  { day: 1, label: 'Monday', open: '08:00', close: '17:00' },
  { day: 2, label: 'Tuesday', open: '08:00', close: '17:00' },
  { day: 3, label: 'Wednesday', open: '08:00', close: '17:00' },
  { day: 4, label: 'Thursday', open: '08:00', close: '17:00' },
  { day: 5, label: 'Friday', open: '08:00', close: '17:00' },
  { day: 6, label: 'Saturday', open: '08:00', close: '12:00' },
  { day: 0, label: 'Sunday', open: null, close: null },
] as const;

export const HOURS_SUMMARY = [
  { label: 'Monday – Friday', value: '08:00 – 17:00' },
  { label: 'Saturday', value: '08:00 – 12:00' },
  { label: 'Sunday & public holidays', value: 'Closed' },
];

export const LOCATIONS = [
  {
    slug: 'centurion',
    name: 'Centurion',
    addressLine: '56 Van Ryneveld Ave, Pierre van Ryneveld Park',
    city: 'Centurion',
    postalCode: '0157',
    region: 'Gauteng',
    full: '56 Van Ryneveld Ave, Pierre van Ryneveld Park, Centurion, 0157',
  },
  {
    slug: 'tembisa',
    name: 'Tembisa',
    addressLine: '1423 Flint Mazibuko Str, Hospital View',
    city: 'Tembisa',
    postalCode: '1632',
    region: 'Gauteng',
    full: '1423 Flint Mazibuko Str, Hospital View, Tembisa, 1632',
  },
] as const;

/** Session defaults — 60 minutes, appointment only, online or in-person. */
export const SESSION_DEFAULTS = {
  durationMinutes: 60,
  bufferMinutes: 15,
  slotIntervalMinutes: 30,
  minNoticeHours: 12,
  maxAdvanceDays: 60,
  cancellationWindowHours: 24,
} as const;

/**
 * Private card payment rates, exactly as published.
 * Stored in cents to avoid float arithmetic anywhere in the payment path.
 */
/**
 * What the practice charges, in cents.
 *
 * Price depends on the service AND on where the session happens — the two
 * practices are not priced the same, so a single "in person" rate is wrong.
 * Confirmed with the practice on 2026-08-14:
 *
 *                     online   Centurion   Tembisa
 *   Individual         R700      R800       R700
 *   Couples            R800      R850       R800
 *   Follow-ups         same as the matching counselling session
 *   Psychometric       quoted after booking — see below
 *
 * These are the cash/private rates. Medical aid is billed at scheme rates,
 * which differ and are not published here.
 */
export const RATES = {
  individual: { online: 70000, centurion: 80000, tembisa: 70000 },
  couple: { online: 80000, centurion: 85000, tembisa: 80000 },
  medicalAidCoPaymentInPerson: 10000,
} as const;

/** Where a session can happen. Keys match the location slugs. */
export type SessionPlace = 'online' | 'centurion' | 'tembisa';

/**
 * The five things a client can book.
 *
 * `pricing: 'quoted'` is not a missing price — psychometric assessment is
 * genuinely priced per case, because the instruments used differ. It is booked
 * first and quoted afterwards, and the flow must never invent a number for it
 * or take a card payment up front.
 */
export const BOOKABLE_SERVICES = [
  {
    id: 'individual-counselling',
    name: 'Individual counselling',
    rate: 'individual',
    pricing: 'fixed',
  },
  {
    id: 'couples-counselling',
    name: 'Couples counselling',
    rate: 'couple',
    pricing: 'fixed',
  },
  {
    id: 'individual-follow-up',
    name: 'Individual follow-up session',
    rate: 'individual',
    pricing: 'fixed',
  },
  {
    id: 'couples-follow-up',
    name: 'Couples follow-up session',
    rate: 'couple',
    pricing: 'fixed',
  },
  {
    id: 'psychometric-assessment',
    name: 'Psychometric assessment',
    rate: null,
    pricing: 'quoted',
  },
] as const;

export type BookableServiceId = (typeof BOOKABLE_SERVICES)[number]['id'];

/** Cash price in cents, or null when the service is quoted after booking. */
export function priceFor(serviceId: BookableServiceId, place: SessionPlace): number | null {
  const service = BOOKABLE_SERVICES.find((s) => s.id === serviceId);
  if (!service || service.rate === null) return null;
  return RATES[service.rate][place];
}

/**
 * Shown in bold ABOVE the medical aid details form, never after it.
 *
 * Someone entering scheme details is about to assume they are covered. The
 * practice's position — that acceptance of details is not a guarantee of
 * payment, and any shortfall is theirs — has to be read before they type, not
 * discovered when an account arrives.
 */
export const MEDICAL_AID_DISCLAIMER =
  'Please note: medical aid rates differ from the cash rates shown, and are billed according to your scheme. Providing your medical aid details does not guarantee payment by your scheme. You are responsible for confirming that you have sufficient mental health benefits available, and any amount not covered or reimbursed by your scheme remains payable by you. A R100 co-payment applies to all in-person consultations for clients using medical aid.';

export const POLICY = {
  cancellation:
    'Cancellations must be made at least 24 hours before the scheduled session. Late cancellations or missed appointments may be charged in full. Exceptions may be considered in cases of genuine emergency.',
  eligibility:
    'Clients must be 16 years or older, or have written consent from a parent or legal guardian for services provided to minors.',
  nature:
    'Be Whole Care provides counselling, wellness support, psychoeducation, and related services. These services are not a substitute for medical, psychiatric, or emergency care. Where necessary, clients may be referred to appropriate healthcare or emergency services.',
  confidentiality:
    'All sessions are confidential and handled in accordance with ethical and legal requirements.',
  confidentialityLimits: [
    'Risk of harm to the client or others',
    'Abuse or neglect of a child, elderly person, or vulnerable individual',
    'A legal requirement to disclose information',
  ],
  cardPayments:
    'Clients paying privately will receive a secure payment link after booking. Payment must be made before the appointment to confirm the booking. No co-payments apply to card payments.',
  medicalAid:
    "Clients intending to use their medical aid are responsible for ensuring that they have sufficient mental health benefits available before booking. Claims are submitted subject to your scheme's rules, available benefits, authorisation requirements and reimbursement policies. Fees charged to medical aid schemes may differ from the private consultation rates. Acceptance of your medical aid details does not guarantee payment by your medical aid. Any amount not covered or reimbursed remains the client's responsibility.",
  medicalAidCoPayment:
    'A R100 co-payment per session applies to all in-person consultations for clients using medical aid benefits. Co-payments are payable at the time of your in-person consultation or prior, and are separate from any medical aid reimbursement.',
} as const;

/**
 * Crisis routing. Be Whole Care is not an emergency service — the app never
 * attempts to handle a crisis in-product, it routes out to national services.
 */
export const CRISIS_SUPPORT = {
  note: 'Be Whole Care is not an emergency service. If you or someone else is in immediate danger, please contact emergency services or a 24-hour crisis line.',
  contacts: [
    { label: 'Emergency services (SA)', value: '112', href: 'tel:112' },
    { label: 'Ambulance', value: '10177', href: 'tel:10177' },
    {
      label: 'SADAG 24hr Helpline',
      value: '0800 456 789',
      href: 'tel:0800456789',
    },
    {
      label: 'SADAG Suicide Crisis Line',
      value: '0800 567 567',
      href: 'tel:0800567567',
    },
  ],
} as const;

export const AI_ASSISTANT = {
  name: 'Wholeness Guide',
  disclaimer:
    'I am an AI assistant, not a counsellor. I can help you understand services and book a session, but I cannot diagnose or give clinical advice.',
} as const;
