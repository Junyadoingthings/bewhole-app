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

/**
 * The practitioner's registered professional identity.
 *
 * These are regulated credentials, not marketing copy: HPCSA registration and
 * a practice number are what make the practice lawfully able to see clients
 * and to bill medical aid. They live here, once, so that a change is made in a
 * single place and can never drift between the site, an email and an invoice.
 *
 * Do not edit these without the practitioner's confirmation, and do not invent
 * further qualifications alongside them.
 */
export const PRACTITIONER = {
  name: 'Ntombi Mothoagae',
  qualification: 'BPSYCH',
  title: 'Registered Counsellor',
  council: 'HPCSA',
  /**
   * Two different numbers, both real and both needed — they are not
   * alternatives to each other:
   *
   *    registrationNumber  HPCSA council registration. Identifies the
   *                        practitioner as licensed to practise. This is the
   *                        one that belongs on a consent form.
   *    practiceNumber      BHF practice number. Identifies the practice for
   *                        medical aid billing. Belongs on invoices and claims.
   */
  registrationNumber: 'PRC0038660',
  practiceNumber: '1096974',
} as const;

/**
 * Informed consent for counselling.
 *
 * Transcribed verbatim from the practice's own consent form — this is a
 * regulated disclosure, not marketing copy, so the wording is not to be
 * paraphrased, shortened or "improved" without the practitioner's approval.
 *
 * Held here as data rather than inside a component so that the booking flow,
 * the printable copy and any future PDF all render the SAME text. If it lived
 * in JSX it would eventually be edited in one place and not the other, and a
 * client could agree to wording the practice no longer uses.
 */
export const COUNSELLING_CONSENT = {
  version: '2026-01',
  items: [
    {
      id: 'purpose',
      body:
        'The purpose of counselling is to provide a supportive and confidential space for you to ' +
        'explore personal challenges, improve emotional well-being, and develop coping strategies.',
      agreeLabel: 'I agree',
    },
    {
      id: 'online',
      body:
        'Online counselling will take place via secure video call, voice call, or chat platforms. ' +
        'While every effort is made to maintain confidentiality, there are potential risks such as ' +
        "technical failures or breaches of privacy beyond the counsellor's control.",
      agreeLabel: 'I agree',
    },
    {
      id: 'confidentiality',
      body:
        'All information shared in counselling sessions will remain confidential except in the ' +
        'following situations: if there is reason to believe you or someone else is in danger, or ' +
        'if required by law or a court order.',
      agreeLabel: 'I agree',
    },
    {
      id: 'services',
      body:
        `I consent to receive counselling services from Be Whole Care / Ntombi Mothoagae ` +
        `(Registered Counsellor — PRC0038660 — HPCSA). I understand I may withdraw from ` +
        `counselling at any time.`,
      agreeLabel: 'I understand and consent',
    },
  ],
} as const;

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
  phone: '',
  phoneE164: '+27638837170',
  whatsapp: '27638837170',
  instagram: 'https://www.instagram.com/_bewhole/',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  currencySymbol: 'R',
} as const;

export const BUSINESS_HOURS = [
  { day: 1, label: 'Monday', open: '09:00', close: '17:00' },
  { day: 2, label: 'Tuesday', open: '09:00', close: '17:00' },
  { day: 3, label: 'Wednesday', open: '09:00', close: '17:00' },
  { day: 4, label: 'Thursday', open: '09:00', close: '17:00' },
  { day: 5, label: 'Friday', open: '09:00', close: '17:00' },
  { day: 6, label: 'Saturday', open: '09:00', close: '13:00' },
  { day: 0, label: 'Sunday', open: null, close: null },
] as const;

export const HOURS_SUMMARY = [
  { label: 'Monday – Friday', value: '09:00 – 17:00' },
  { label: 'Saturday', value: '09:00 – 13:00' },
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
 *                    online    Centurion    Tembisa
 *    Individual       R700       R800        R700
 *    Couples          R800       R850        R800
 *    Pre-Marital      R800       R800        R800  (Default cash rate baseline)
 *    Follow-ups       same as the matching counselling session
 *    Psychometric     quoted after booking — see below
 *
 * These are the cash/private rates. Medical aid is billed at scheme rates,
 * which differ and are not published here.
 */
export const RATES = {
  individual: { online: 70000, centurion: 80000, tembisa: 70000 },
  couple: { online: 80000, centurion: 85000, tembisa: 80000 },
  preMarital: { online: 80000, centurion: 80000, tembisa: 80000 },
  medicalAidCoPaymentInPerson: 0,
} as const;

/** Where a session can happen. Keys match the location slugs. */
export type SessionPlace = 'online' | 'centurion' | 'tembisa';

/**
 * The things a client can book.
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
    id: 'pre-marital-counselling',
    name: 'Pre-Marital Counselling',
    rate: 'preMarital',
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
  'Please note: medical aid rates differ from the cash rates shown, and are billed according to your scheme. Providing your medical aid details does not guarantee payment by your scheme. You are responsible for confirming that you have sufficient mental health benefits available, and any amount not covered or reimbursed by your scheme remains payable by you.';

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
    'Clients paying privately will receive a secure payment link after booking. Payment must be made before the appointment to confirm the booking.',
  medicalAid:
    "Clients intending to use their medical aid are responsible for ensuring that they have sufficient mental health benefits available before booking. Claims are submitted subject to your scheme's rules, available benefits, authorisation requirements and reimbursement policies. Fees charged to medical aid schemes may differ from the private consultation rates. Acceptance of your medical aid details does not guarantee payment by your medical aid. Any amount not covered or reimbursed remains the client's responsibility.",
  medicalAidCoPayment: '',
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

/* ------------------------------------------------------------- resources */

/**
 * The Be Whole Wellness Journal — a purchasable digital workbook.
 *
 * `priceCents: null` means "not on sale yet": the page shows the journal and
 * invites an enquiry instead of rendering a Buy button that cannot charge.
 * Set a real figure here to switch purchasing on. That is deliberate — a
 * checkout button that fails is worse than one that is honestly absent.
 */
export const WELLNESS_JOURNAL = {
  name: 'Be Whole Wellness Journal',
  subtitle: 'Counselling workbook & daily devotional',
  priceCents: null as number | null,
  /**
   * The cover artwork. `null` would render a designed typographic placeholder
   * instead of a broken image; now that the file exists, it points at it.
   *
   * Note the extension: the file supplied was named .jpg but is actually a
   * WebP. Renaming a file does not convert it, so it is stored under its true
   * extension — serving WebP bytes as image/jpeg relies on browser sniffing
   * and breaks anything that trusts the content type.
   */
  cover: '/images/wellness-journal.webp',
  /** Plain, honest description — no therapeutic claims. */
  intro:
    'A 30-day guided journal for the seasons that feel heavy — low mood, hopelessness, ' +
    'discouragement. It pairs a short daily devotional with the kind of reflective ' +
    'exercises used in counselling, so you have somewhere to put your thoughts between ' +
    'sessions, or on your own.',
  includes: [
    'A 30-day guided plan you can start any day',
    'A short devotional reading for each day',
    'Counselling-style reflection prompts and exercises',
    'Space to track mood, gratitude and what you are learning',
    'Yours to keep — download and print as many copies as you need',
  ],
} as const;

/**
 * Naked Vows — the practice's marriage segment for couples.
 *
 * Two ways in, deliberately different in commitment:
 *   channel   ongoing marriage resources and empowerment sessions, open to all
 *   interest  registering for the annual gathering, which is invitation-based
 *
 * `whatsappChannelUrl: null` hides the channel button rather than linking
 * nowhere. Set it once the channel exists.
 */
export const NAKED_VOWS = {
  name: 'Naked Vows',
  tagline: 'For married couples',
  /** See the note on WELLNESS_JOURNAL.cover. Supplied as .jpg, actually a PNG. */
  cover: '/images/naked-vows.png',
  whatsappChannelUrl: 'https://whatsapp.com/channel/0029VbDnUSoJf05jNIIrls3E',
  intro:
    'Naked Vows is a space for married couples to do the honest work of staying close — ' +
    'the conversations most couples avoid until they have to have them. It runs as an ' +
    'annual gathering, alongside ongoing marriage resources and empowerment sessions.',
} as const;