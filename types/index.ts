/** Domain model for the Be Whole Care platform. */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO 8601
export type TimeString = string; // HH:mm

/* ---------------------------------------------------------------- identity */

export const ROLES = ['CLIENT', 'STAFF', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Ranked so authorization checks can be a single >= comparison. */
export const ROLE_RANK: Record<Role, number> = {
  CLIENT: 0,
  STAFF: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export interface User {
  id: ID;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt?: ISODateTime | null;
  disabled?: boolean;
  isDemo?: boolean;
}

export interface Profile {
  id: ID;
  userId: ID;
  firstName: string;
  lastName: string;
  phone?: string | null;
  dateOfBirth?: ISODate | null;
  /** Collected at booking. Optional — an online client needs no address. */
  address?: string | null;
  /**
   * Required at booking. A counselling practice may need to reach someone on
   * the client's behalf; these are kept on the profile rather than the
   * appointment so they are findable from the client record.
   */
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  /** Only captured when the client chooses to pay by medical aid. */
  medicalAid?: {
    scheme: string;
    memberNumber: string;
    mainMember: string;
  } | null;
  preferredContact: 'email' | 'whatsapp' | 'sms';
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isDemo?: boolean;
}

/* ---------------------------------------------------------------- catalogue */

export interface ServiceCategory {
  id: ID;
  slug: string;
  name: string;
  /** Short editorial line used on cards. */
  summary: string;
  /** Longer copy for the service detail page. */
  description: string;
  /** The sub-items published on the live site. */
  areas: string[];
  /** Discovery tags matched by the concern selector on the homepage. */
  concerns: string[];
  icon: string;
  accent: 'forest' | 'clay' | 'cream';
  order: number;
  active: boolean;
}

export interface Service {
  id: ID;
  categoryId: ID;
  slug: string;
  name: string;
  summary: string;
  durationMinutes: number;
  /** Rate band this service is billed at. */
  rateBand: 'individual' | 'couple' | 'assessment' | 'free';
  priceInPersonCents: number;
  priceOnlineCents: number;
  allowsOnline: boolean;
  allowsInPerson: boolean;
  /** Assessment work is quoted after an intake call rather than paid upfront. */
  requiresQuote: boolean;
  intakeNote?: string | null;
  order: number;
  active: boolean;
}

export interface Location {
  id: ID;
  slug: string;
  name: string;
  addressLine: string;
  city: string;
  postalCode: string;
  region: string;
  active: boolean;
}

export interface Practitioner {
  id: ID;
  userId?: ID | null;
  displayName: string;
  title: string;
  bio?: string | null;
  locationIds: ID[];
  offersOnline: boolean;
  active: boolean;
  isDemo?: boolean;
}

/* ------------------------------------------------------------- availability */

export interface AvailabilityRule {
  id: ID;
  practitionerId?: ID | null;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  start: TimeString;
  end: TimeString;
  mode: 'any' | 'online' | 'in_person';
  locationId?: ID | null;
  active: boolean;
}

/** A one-off closure: leave, public holiday, or a blocked afternoon. */
export interface AvailabilityBlock {
  id: ID;
  practitionerId?: ID | null;
  date: ISODate;
  start?: TimeString | null;
  end?: TimeString | null;
  reason: string;
  createdAt: ISODateTime;
}

export interface TimeSlot {
  start: ISODateTime;
  end: ISODateTime;
  label: TimeString;
  available: boolean;
  practitionerId?: ID | null;
}

export interface DayAvailability {
  date: ISODate;
  status: 'open' | 'limited' | 'full' | 'closed' | 'past';
  openSlots: number;
}

/* ------------------------------------------------------------- appointments */

export const APPOINTMENT_STATUSES = [
  'pending_payment',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type AppointmentMode = 'online' | 'in_person';
export type PaymentMethod = 'card' | 'medical_aid';

export interface Appointment {
  id: ID;
  reference: string;
  clientUserId: ID;
  serviceId: ID;
  practitionerId?: ID | null;
  mode: AppointmentMode;
  locationId?: ID | null;
  startAt: ISODateTime;
  endAt: ISODateTime;
  durationMinutes: number;
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
  amountCents: number;
  /** Free-text from the client. Deliberately optional and never required. */
  reason?: string | null;
  isFirstSession: boolean;
  sessionLink?: string | null;
  calendarEventId?: ID | null;
  cancelledAt?: ISODateTime | null;
  cancelledBy?: ID | null;
  cancellationReason?: string | null;
  /** Set when a cancellation lands inside the 24-hour policy window. */
  lateCancellation?: boolean;
  rescheduledFrom?: ID | null;
  completedAt?: ISODateTime | null;
  followUpId?: ID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isDemo?: boolean;
}

/* ----------------------------------------------------------------- payments */

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
  'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Payment {
  id: ID;
  appointmentId?: ID | null;
  followUpId?: ID | null;
  clientUserId: ID;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: 'peach' | 'payfast' | 'yoco' | 'mock' | 'manual';
  /** Provider-side checkout id. Never a card number — we never see those. */
  providerCheckoutId?: string | null;
  providerPaymentId?: string | null;
  checkoutUrl?: string | null;
  paidAt?: ISODateTime | null;
  failureReason?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isDemo?: boolean;
}

export interface PaymentEvent {
  id: ID;
  paymentId: ID;
  type: string;
  payload: Record<string, unknown>;
  createdAt: ISODateTime;
}

/* --------------------------------------------------------------- follow-ups */

export const FOLLOW_UP_STATUSES = [
  'scheduled',
  'awaiting_payment',
  'paid',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export interface FollowUp {
  id: ID;
  clientUserId: ID;
  serviceId: ID;
  createdByUserId: ID;
  /** The session this follow-up came out of, when there is one. */
  sourceAppointmentId?: ID | null;
  /** The appointment created once the follow-up is confirmed. */
  appointmentId?: ID | null;
  dueDate: ISODate;
  preferredTime?: TimeString | null;
  mode: AppointmentMode;
  locationId?: ID | null;
  paymentRequired: boolean;
  amountCents: number;
  status: FollowUpStatus;
  reminderDate: ISODate;
  reminderSentAt?: ISODateTime | null;
  channel: 'email' | 'whatsapp' | 'sms';
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isDemo?: boolean;
}

/* ----------------------------------------------------------------- calendar */

export interface CalendarEvent {
  id: ID;
  appointmentId: ID;
  provider: 'google' | 'mock';
  externalId: string;
  calendarId: string;
  htmlLink?: string | null;
  status: 'synced' | 'pending' | 'failed' | 'cancelled';
  lastError?: string | null;
  syncedAt?: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------ notifications */

export type NotificationChannel = 'email' | 'whatsapp' | 'sms' | 'push' | 'in_app';

export interface NotificationRecord {
  id: ID;
  userId?: ID | null;
  /** Staff-facing notifications have audience 'staff'. */
  audience: 'client' | 'staff';
  type: string;
  title: string;
  body: string;
  href?: string | null;
  read: boolean;
  createdAt: ISODateTime;
}

export interface NotificationLog {
  id: ID;
  notificationId?: ID | null;
  channel: NotificationChannel;
  to: string;
  subject: string;
  /**
   * The rendered message. Required, not cosmetic: a reminder queued now is
   * sent by the cron worker hours later, and the worker has nothing else to
   * send. Without this, scheduled reminders are silently never delivered.
   */
  body: string;
  href?: string | null;
  status: 'queued' | 'sent' | 'failed';
  provider: string;
  error?: string | null;
  scheduledFor?: ISODateTime | null;
  sentAt?: ISODateTime | null;
  createdAt: ISODateTime;
}

/* ---------------------------------------------------------------- resources */

export interface Resource {
  id: ID;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  kind: 'article' | 'reflection' | 'podcast' | 'worksheet';
  topic: string;
  readMinutes: number;
  published: boolean;
  publishedAt: ISODateTime;
  order: number;
}

export interface Workshop {
  id: ID;
  slug: string;
  title: string;
  summary: string;
  description: string;
  audience: string;
  format: 'online' | 'in_person' | 'hybrid';
  date?: ISODate | null;
  durationLabel: string;
  status: 'open' | 'by_request' | 'closed';
  order: number;
}

/* ------------------------------------------------------- notes, consent, audit */

export interface ClientNote {
  id: ID;
  clientUserId: ID;
  authorUserId: ID;
  appointmentId?: ID | null;
  /** Administrative notes only. Clinical records live outside this system. */
  category: 'admin' | 'session_admin' | 'billing';
  body: string;
  createdAt: ISODateTime;
  isDemo?: boolean;
}

export interface Consent {
  id: ID;
  userId: ID;
  type: 'terms' | 'privacy' | 'informed_consent' | 'communications';
  version: string;
  granted: boolean;
  grantedAt: ISODateTime;
  ipHash?: string | null;
}

export interface AuditLog {
  id: ID;
  actorUserId?: ID | null;
  actorRole?: Role | null;
  action: string;
  entity: string;
  entityId?: ID | null;
  meta?: Record<string, unknown>;
  createdAt: ISODateTime;
}

/* ----------------------------------------------------------------- settings */

export interface Settings {
  business: {
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    website: string;
    timezone: string;
    currency: string;
  };
  scheduling: {
    durationMinutes: number;
    slotIntervalMinutes: number;
    bufferMinutes: number;
    minNoticeHours: number;
    maxAdvanceDays: number;
    cancellationWindowHours: number;
  };
  reminders: {
    confirmationImmediate: boolean;
    firstReminderHours: number;
    secondReminderHours: number | null;
    followUpAfterHours: number;
    channels: NotificationChannel[];
  };
  payments: {
    provider: 'peach' | 'payfast' | 'mock';
    medicalAidEnabled: boolean;
    medicalAidCoPaymentCents: number;
    requirePaymentToConfirm: boolean;
  };
  /**
   * The practice's own banking details, entered by an administrator.
   *
   * This is NOT where card payments settle — that account is registered with
   * the payment gateway during FICA onboarding and lives only in the gateway's
   * dashboard. These details exist so receipts and invoices can carry them,
   * and so the practice can accept a direct EFT if it chooses to.
   *
   * Deliberately a setting rather than a constant: an account number must
   * never be committed to a repository.
   */
  banking: {
    accountName: string;
    bank: string;
    accountNumber: string;
    branchCode: string;
    /** Show these details on receipts and invoices. */
    showOnInvoices: boolean;
  };
  calendar: {
    provider: 'google' | 'mock';
    calendarId: string;
    connected: boolean;
  };
  policy: {
    cancellation: string;
    minimumAge: number;
  };
  updatedAt: ISODateTime;
}

/* -------------------------------------------------------------- view models */

export interface AppointmentView extends Appointment {
  service: Service;
  category: ServiceCategory;
  location?: Location | null;
  practitioner?: Practitioner | null;
  payment?: Payment | null;
  client?: { id: ID; name: string; email: string; phone?: string | null };
}

export interface FollowUpView extends FollowUp {
  service: Service;
  location?: Location | null;
  payment?: Payment | null;
  client?: { id: ID; name: string; email: string; phone?: string | null };
}

export interface SessionUser {
  id: ID;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };
