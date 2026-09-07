import 'server-only';

import { newId, nowISO } from './ids';
import {
  EXCLUSION_VIOLATION,
  dateOnly,
  getSql,
  iso,
  isPgError,
  isoRequired,
  timeOnly,
} from './sql';
import type {
  Appointment,
  AppointmentView,
  AuditLog,
  AvailabilityBlock,
  AvailabilityRule,
  CalendarEvent,
  ClientNote,
  Consent,
  FollowUp,
  FollowUpView,
  ID,
  Location,
  NotificationLog,
  NotificationRecord,
  Payment,
  PaymentEvent,
  Practitioner,
  Profile,
  Resource,
  Role,
  Service,
  ServiceCategory,
  Settings,
  User,
  Workshop,
} from '@/types';

/**
 * Repository layer — PostgreSQL.
 *
 * Mirrors lib/db/json-repo.ts exactly; lib/db/index.ts type-checks one against
 * the other, so a signature that drifts here is a compile error rather than a
 * runtime surprise.
 *
 * Column names are snake_case in the database and camelCase in the app. The
 * `row → object` mappers at the top of each section are the only place that
 * translation happens.
 */

/* ------------------------------------------------------------------ rows */
/* eslint-disable @typescript-eslint/no-explicit-any */

function mapUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    emailVerified: r.email_verified,
    disabled: r.disabled,
    isDemo: r.is_demo,
    lastLoginAt: iso(r.last_login_at),
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapProfile(r: any): Profile {
  return {
    id: r.id,
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    dateOfBirth: dateOnly(r.date_of_birth),
    address: r.address ?? null,
    emergencyContactName: r.emergency_contact_name ?? null,
    emergencyContactPhone: r.emergency_contact_phone ?? null,
    medicalAid: r.medical_aid ?? null,
    preferredContact: r.preferred_contact,
    notes: r.notes,
    isDemo: r.is_demo,
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapCategory(r: any): ServiceCategory {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    description: r.description,
    areas: r.areas ?? [],
    concerns: r.concerns ?? [],
    icon: r.icon,
    accent: r.accent,
    order: r.sort_order,
    active: r.active,
  };
}

function mapService(r: any): Service {
  return {
    id: r.id,
    categoryId: r.category_id,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    durationMinutes: r.duration_minutes,
    rateBand: r.rate_band,
    priceInPersonCents: r.price_in_person_cents,
    priceOnlineCents: r.price_online_cents,
    allowsOnline: r.allows_online,
    allowsInPerson: r.allows_in_person,
    requiresQuote: r.requires_quote,
    intakeNote: r.intake_note,
    order: r.sort_order,
    active: r.active,
  };
}

function mapLocation(r: any): Location {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    addressLine: r.address_line,
    city: r.city,
    postalCode: r.postal_code,
    region: r.region,
    active: r.active,
  };
}

function mapPractitioner(r: any): Practitioner {
  return {
    id: r.id,
    userId: r.user_id,
    displayName: r.display_name,
    title: r.title,
    bio: r.bio,
    locationIds: r.location_ids ?? [],
    offersOnline: r.offers_online,
    active: r.active,
    isDemo: r.is_demo,
  };
}

function mapAppointment(r: any): Appointment {
  return {
    id: r.id,
    reference: r.reference,
    clientUserId: r.client_user_id,
    serviceId: r.service_id,
    practitionerId: r.practitioner_id,
    mode: r.mode,
    locationId: r.location_id,
    startAt: isoRequired(r.start_at),
    endAt: isoRequired(r.end_at),
    durationMinutes: r.duration_minutes,
    status: r.status,
    paymentMethod: r.payment_method,
    amountCents: r.amount_cents,
    reason: r.reason,
    isFirstSession: r.is_first_session,
    sessionLink: r.session_link,
    calendarEventId: r.calendar_event_id,
    cancelledAt: iso(r.cancelled_at),
    cancelledBy: r.cancelled_by,
    cancellationReason: r.cancellation_reason,
    lateCancellation: r.late_cancellation,
    rescheduledFrom: r.rescheduled_from,
    completedAt: iso(r.completed_at),
    followUpId: r.follow_up_id,
    isDemo: r.is_demo,
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapPayment(r: any): Payment {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    followUpId: r.follow_up_id,
    clientUserId: r.client_user_id,
    amountCents: r.amount_cents,
    currency: r.currency,
    method: r.method,
    status: r.status,
    provider: r.provider,
    providerCheckoutId: r.provider_checkout_id,
    providerPaymentId: r.provider_payment_id,
    checkoutUrl: r.checkout_url,
    paidAt: iso(r.paid_at),
    failureReason: r.failure_reason,
    isDemo: r.is_demo,
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapFollowUp(r: any): FollowUp {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    serviceId: r.service_id,
    createdByUserId: r.created_by_user_id,
    sourceAppointmentId: r.source_appointment_id,
    appointmentId: r.appointment_id,
    dueDate: dateOnly(r.due_date) as string,
    preferredTime: timeOnly(r.preferred_time),
    mode: r.mode,
    locationId: r.location_id,
    paymentRequired: r.payment_required,
    amountCents: r.amount_cents,
    status: r.status,
    reminderDate: dateOnly(r.reminder_date) as string,
    reminderSentAt: iso(r.reminder_sent_at),
    channel: r.channel,
    notes: r.notes,
    isDemo: r.is_demo,
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapCalendarEvent(r: any): CalendarEvent {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    provider: r.provider,
    externalId: r.external_id,
    calendarId: r.calendar_id,
    htmlLink: r.html_link,
    status: r.status,
    lastError: r.last_error,
    syncedAt: iso(r.synced_at),
    createdAt: isoRequired(r.created_at),
    updatedAt: isoRequired(r.updated_at),
  };
}

function mapNotification(r: any): NotificationRecord {
  return {
    id: r.id,
    userId: r.user_id,
    audience: r.audience,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.read,
    createdAt: isoRequired(r.created_at),
  };
}

function mapNotificationLog(r: any): NotificationLog {
  return {
    id: r.id,
    notificationId: r.notification_id,
    channel: r.channel,
    to: r.recipient,
    subject: r.subject,
    body: r.body ?? '',
    href: r.href,
    status: r.status,
    provider: r.provider,
    error: r.error,
    scheduledFor: iso(r.scheduled_for),
    sentAt: iso(r.sent_at),
    createdAt: isoRequired(r.created_at),
  };
}

function mapResource(r: any): Resource {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    kind: r.kind,
    topic: r.topic,
    readMinutes: r.read_minutes,
    published: r.published,
    publishedAt: isoRequired(r.published_at),
    order: r.sort_order,
  };
}

function mapWorkshop(r: any): Workshop {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    description: r.description,
    audience: r.audience,
    format: r.format,
    date: dateOnly(r.workshop_date),
    durationLabel: r.duration_label,
    status: r.status,
    order: r.sort_order,
  };
}

function mapNote(r: any): ClientNote {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    authorUserId: r.author_user_id,
    appointmentId: r.appointment_id,
    category: r.category,
    body: r.body,
    isDemo: r.is_demo,
    createdAt: isoRequired(r.created_at),
  };
}

/* ------------------------------------------------------------------ users */

export async function findUserByEmail(email: string): Promise<User | null> {
  const sql = getSql();
  const rows = await sql`select * from users where email = ${email.trim()} limit 1`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id: ID): Promise<User | null> {
  const sql = getSql();
  const rows = await sql`select * from users where id = ${id} limit 1`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getProfile(userId: ID): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`select * from profiles where user_id = ${userId} limit 1`;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function createUserWithProfile(input: {
  email: string;
  passwordHash: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone?: string | null;
  preferredContact?: Profile['preferredContact'];
}): Promise<{ user: User; profile: Profile }> {
  const sql = getSql();
  const userId = newId('usr');
  const profileId = newId('prf');

  // One transaction: a user without a profile would break every screen.
  return sql.begin(async (tx) => {
    const [userRow] = await tx`
      insert into users (id, email, password_hash, role)
      values (${userId}, ${input.email.trim().toLowerCase()}, ${input.passwordHash}, ${input.role})
      returning *`;
    const [profileRow] = await tx`
      insert into profiles (id, user_id, first_name, last_name, phone, preferred_contact)
      values (${profileId}, ${userId}, ${input.firstName.trim()}, ${input.lastName.trim()},
              ${input.phone ?? null}, ${input.preferredContact ?? 'email'})
      returning *`;
    return { user: mapUser(userRow), profile: mapProfile(profileRow) };
  }) as Promise<{ user: User; profile: Profile }>;
}

export async function updateProfile(userId: ID, patch: Partial<Profile>): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    update profiles set
      first_name        = coalesce(${patch.firstName ?? null}, first_name),
      last_name         = coalesce(${patch.lastName ?? null}, last_name),
      phone             = ${patch.phone !== undefined ? patch.phone : sql`phone`},
      date_of_birth     = ${patch.dateOfBirth !== undefined ? patch.dateOfBirth : sql`date_of_birth`},
      address           = ${patch.address !== undefined ? patch.address : sql`address`},
      emergency_contact_name  = ${patch.emergencyContactName !== undefined ? patch.emergencyContactName : sql`emergency_contact_name`},
      emergency_contact_phone = ${patch.emergencyContactPhone !== undefined ? patch.emergencyContactPhone : sql`emergency_contact_phone`},
      medical_aid       = ${patch.medicalAid !== undefined ? sql.json(patch.medicalAid as never) : sql`medical_aid`},
      preferred_contact = coalesce(${patch.preferredContact ?? null}, preferred_contact),
      notes             = ${patch.notes !== undefined ? patch.notes : sql`notes`}
    where user_id = ${userId}
    returning *`;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function updateUser(userId: ID, patch: Partial<User>): Promise<User | null> {
  const sql = getSql();
  const rows = await sql`
    update users set
      password_hash  = coalesce(${patch.passwordHash ?? null}, password_hash),
      role           = coalesce(${patch.role ?? null}, role),
      email_verified = coalesce(${patch.emailVerified ?? null}, email_verified),
      disabled       = coalesce(${patch.disabled ?? null}, disabled),
      last_login_at  = ${patch.lastLoginAt !== undefined ? patch.lastLoginAt : sql`last_login_at`}
    where id = ${userId}
    returning *`;
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listStaff(): Promise<{ user: User; profile: Profile | null }[]> {
  const sql = getSql();
  const rows = await sql`
    select u.*, row_to_json(p.*) as profile
    from users u left join profiles p on p.user_id = u.id
    where u.role <> 'CLIENT'
    order by u.created_at`;
  return rows.map((r: any) => ({
    user: mapUser(r),
    profile: r.profile ? mapProfile(r.profile) : null,
  }));
}

export async function listClients(): Promise<{ user: User; profile: Profile }[]> {
  const sql = getSql();
  const rows = await sql`
    select u.*, row_to_json(p.*) as profile
    from users u join profiles p on p.user_id = u.id
    where u.role = 'CLIENT'
    order by p.first_name, p.last_name`;
  return rows.map((r: any) => ({ user: mapUser(r), profile: mapProfile(r.profile) }));
}

/* --------------------------------------------------------------- sessions */

/**
 * One round trip, on the critical path of every sign-in.
 *
 * This was a transaction wrapping three statements, which over a pooled
 * connection costs five round trips — BEGIN, delete, insert, update, COMMIT.
 * At ~90ms each that is most of half a second spent waiting, with the user
 * staring at a spinner, before the redirect even starts.
 *
 * Now it is a single statement: a CTE inserts the session and the outer query
 * stamps the login time. Postgres runs both in one implicit transaction, so
 * the atomicity the explicit BEGIN was providing is unchanged.
 *
 * The opportunistic `delete from sessions where expires_at <= now()` was
 * dropped from here entirely. Housekeeping does not belong on the login path —
 * it made every person signing in pay for a table sweep. The reminder cron
 * prunes expired sessions instead; see services/followup.service.
 */
export async function createSession(userId: ID, token: string, expiresAt: string) {
  const sql = getSql();
  await sql`
    with new_session as (
      insert into sessions (token, user_id, expires_at)
      values (${token}, ${userId}, ${expiresAt})
    )
    update users set last_login_at = now() where id = ${userId}`;
}

/**
 * Resolve a session token to the signed-in user in ONE round trip.
 *
 * Authentication used to cost three sequential queries — find the session,
 * then the user, then the profile — and it runs on every request to every
 * portal and admin page. Three trips at ~90ms each is most of a third of a
 * second spent before the page has started its own work, paid again on every
 * click.
 *
 * A `left join` on profiles, not an inner one: an account created by a guest
 * booking may not have a profile row yet, and such a user must still be able
 * to sign in rather than silently appear not to exist.
 */
export async function findSessionUser(token: string): Promise<{
  id: ID;
  email: string;
  role: Role;
  disabled: boolean;
  firstName: string;
  lastName: string;
} | null> {
  const sql = getSql();
  const rows = await sql`
    select u.id, u.email, u.role, u.disabled,
           coalesce(p.first_name, '') as first_name,
           coalesce(p.last_name, '')  as last_name
    from sessions s
    join users u on u.id = s.user_id
    left join profiles p on p.user_id = u.id
    where s.token = ${token} and s.expires_at > now()
    limit 1`;

  const row = rows[0];
  if (!row || row.disabled) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    disabled: row.disabled,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

/** Housekeeping, called by the cron rather than by anyone signing in. */
export async function pruneExpiredSessions(): Promise<number> {
  const sql = getSql();
  const rows = await sql`delete from sessions where expires_at <= now() returning token`;
  return rows.length;
}

export async function findSession(token: string) {
  const sql = getSql();
  const rows = await sql`
    select token, user_id, expires_at, created_at
    from sessions where token = ${token} and expires_at > now() limit 1`;
  if (!rows[0]) return null;
  return {
    token: rows[0].token,
    userId: rows[0].user_id,
    expiresAt: isoRequired(rows[0].expires_at),
    createdAt: isoRequired(rows[0].created_at),
  };
}

export async function deleteSession(token: string) {
  const sql = getSql();
  await sql`delete from sessions where token = ${token}`;
}

export async function deleteSessionsForUser(userId: ID) {
  const sql = getSql();
  await sql`delete from sessions where user_id = ${userId}`;
}

/* -------------------------------------------------------------- catalogue */

export async function listCategories(): Promise<ServiceCategory[]> {
  const sql = getSql();
  const rows = await sql`select * from service_categories where active order by sort_order`;
  return rows.map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<ServiceCategory | null> {
  const sql = getSql();
  const rows = await sql`select * from service_categories where slug = ${slug} and active limit 1`;
  return rows[0] ? mapCategory(rows[0]) : null;
}

export async function listServices(): Promise<Service[]> {
  const sql = getSql();
  const rows = await sql`select * from services where active order by sort_order`;
  return rows.map(mapService);
}

export async function listAllServices(): Promise<Service[]> {
  const sql = getSql();
  const rows = await sql`select * from services order by sort_order`;
  return rows.map(mapService);
}

export async function getService(id: ID): Promise<Service | null> {
  const sql = getSql();
  const rows = await sql`select * from services where id = ${id} limit 1`;
  return rows[0] ? mapService(rows[0]) : null;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const sql = getSql();
  const rows = await sql`select * from services where slug = ${slug} limit 1`;
  return rows[0] ? mapService(rows[0]) : null;
}

export async function updateService(id: ID, patch: Partial<Service>) {
  const sql = getSql();
  const rows = await sql`
    update services set
      price_in_person_cents = coalesce(${patch.priceInPersonCents ?? null}, price_in_person_cents),
      price_online_cents    = coalesce(${patch.priceOnlineCents ?? null}, price_online_cents),
      active                = coalesce(${patch.active ?? null}, active),
      name                  = coalesce(${patch.name ?? null}, name),
      summary               = coalesce(${patch.summary ?? null}, summary),
      duration_minutes      = coalesce(${patch.durationMinutes ?? null}, duration_minutes)
    where id = ${id}
    returning *`;
  return rows[0] ? mapService(rows[0]) : null;
}

export async function listLocations(): Promise<Location[]> {
  const sql = getSql();
  const rows = await sql`select * from locations where active order by sort_order`;
  return rows.map(mapLocation);
}

export async function getLocation(id: ID | null | undefined): Promise<Location | null> {
  if (!id) return null;
  const sql = getSql();
  const rows = await sql`select * from locations where id = ${id} limit 1`;
  return rows[0] ? mapLocation(rows[0]) : null;
}

export async function listPractitioners(): Promise<Practitioner[]> {
  const sql = getSql();
  const rows = await sql`select * from practitioners where active order by display_name`;
  return rows.map(mapPractitioner);
}

/* ----------------------------------------------------------- availability */

export async function listAvailabilityRules(): Promise<AvailabilityRule[]> {
  const sql = getSql();
  const rows = await sql`select * from availability_rules where active order by weekday, start_time`;
  return rows.map((r: any) => ({
    id: r.id,
    practitionerId: r.practitioner_id,
    weekday: r.weekday,
    start: timeOnly(r.start_time) as string,
    end: timeOnly(r.end_time) as string,
    mode: r.mode,
    locationId: r.location_id,
    active: r.active,
  }));
}

export async function listAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  const sql = getSql();
  const rows = await sql`select * from availability_blocks order by block_date`;
  return rows.map((r: any) => ({
    id: r.id,
    practitionerId: r.practitioner_id,
    date: dateOnly(r.block_date) as string,
    start: timeOnly(r.start_time),
    end: timeOnly(r.end_time),
    reason: r.reason,
    createdAt: isoRequired(r.created_at),
  }));
}

export async function createAvailabilityBlock(input: Omit<AvailabilityBlock, 'id' | 'createdAt'>) {
  const sql = getSql();
  const id = newId('blk');
  const [row] = await sql`
    insert into availability_blocks (id, practitioner_id, block_date, start_time, end_time, reason)
    values (${id}, ${input.practitionerId ?? null}, ${input.date},
            ${input.start ?? null}, ${input.end ?? null}, ${input.reason})
    returning *`;
  return {
    id: row.id,
    practitionerId: row.practitioner_id,
    date: dateOnly(row.block_date) as string,
    start: timeOnly(row.start_time),
    end: timeOnly(row.end_time),
    reason: row.reason,
    createdAt: isoRequired(row.created_at),
  };
}

export async function deleteAvailabilityBlock(id: ID) {
  const sql = getSql();
  await sql`delete from availability_blocks where id = ${id}`;
}

/* ------------------------------------------------------------ appointments */

const BLOCKING: Appointment['status'][] = ['pending_payment', 'confirmed', 'completed'];

export async function listAppointments(filter?: {
  clientUserId?: ID;
  from?: string;
  to?: string;
  statuses?: Appointment['status'][];
}): Promise<Appointment[]> {
  const sql = getSql();
  const rows = await sql`
    select * from appointments
    where true
      ${filter?.clientUserId ? sql`and client_user_id = ${filter.clientUserId}` : sql``}
      ${filter?.from ? sql`and start_at >= ${filter.from}` : sql``}
      ${filter?.to ? sql`and start_at <= ${filter.to}` : sql``}
      ${filter?.statuses?.length ? sql`and status = any(${filter.statuses})` : sql``}
    order by start_at`;
  return rows.map(mapAppointment);
}

export async function getAppointment(id: ID): Promise<Appointment | null> {
  const sql = getSql();
  const rows = await sql`select * from appointments where id = ${id} limit 1`;
  return rows[0] ? mapAppointment(rows[0]) : null;
}

export async function getAppointmentByReference(reference: string): Promise<Appointment | null> {
  const sql = getSql();
  const rows = await sql`select * from appointments where reference = ${reference} limit 1`;
  return rows[0] ? mapAppointment(rows[0]) : null;
}

export async function listBookedIntervals(from: string, to: string) {
  const sql = getSql();
  const rows = await sql`
    select id, start_at, end_at, practitioner_id
    from appointments
    where status = any(${BLOCKING}) and end_at > ${from} and start_at < ${to}`;
  return rows.map((r: any) => ({
    id: r.id,
    start: isoRequired(r.start_at),
    end: isoRequired(r.end_at),
    practitionerId: r.practitioner_id ?? null,
  }));
}

/**
 * Claim a slot.
 *
 * There is no read-then-write race here: the insert either succeeds or the
 * `appointments_no_overlap` exclusion constraint rejects it. Two simultaneous
 * bookings for the same time end with exactly one winner, decided by Postgres.
 */
export async function createAppointmentIfFree(
  appointment: Appointment,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: 'taken' }> {
  const sql = getSql();
  try {
    const [row] = await sql`
      insert into appointments (
        id, reference, client_user_id, service_id, practitioner_id, mode, location_id,
        start_at, end_at, duration_minutes, status, payment_method, amount_cents,
        reason, is_first_session, session_link, calendar_event_id, follow_up_id, is_demo,
        created_at, updated_at
      ) values (
        ${appointment.id}, ${appointment.reference}, ${appointment.clientUserId},
        ${appointment.serviceId}, ${appointment.practitionerId ?? null}, ${appointment.mode},
        ${appointment.locationId ?? null}, ${appointment.startAt}, ${appointment.endAt},
        ${appointment.durationMinutes}, ${appointment.status}, ${appointment.paymentMethod},
        ${appointment.amountCents}, ${appointment.reason ?? null}, ${appointment.isFirstSession},
        ${appointment.sessionLink ?? null}, ${appointment.calendarEventId ?? null},
        ${appointment.followUpId ?? null}, ${appointment.isDemo ?? false},
        ${appointment.createdAt}, ${appointment.updatedAt}
      ) returning *`;
    return { ok: true, appointment: mapAppointment(row) };
  } catch (error) {
    if (isPgError(error, EXCLUSION_VIOLATION)) return { ok: false, reason: 'taken' };
    throw error;
  }
}

export async function updateAppointment(id: ID, patch: Partial<Appointment>) {
  const sql = getSql();
  const rows = await sql`
    update appointments set
      status              = coalesce(${patch.status ?? null}, status),
      session_link        = ${patch.sessionLink !== undefined ? patch.sessionLink : sql`session_link`},
      calendar_event_id   = ${patch.calendarEventId !== undefined ? patch.calendarEventId : sql`calendar_event_id`},
      cancelled_at        = ${patch.cancelledAt !== undefined ? patch.cancelledAt : sql`cancelled_at`},
      cancelled_by        = ${patch.cancelledBy !== undefined ? patch.cancelledBy : sql`cancelled_by`},
      cancellation_reason = ${patch.cancellationReason !== undefined ? patch.cancellationReason : sql`cancellation_reason`},
      late_cancellation   = coalesce(${patch.lateCancellation ?? null}, late_cancellation),
      completed_at        = ${patch.completedAt !== undefined ? patch.completedAt : sql`completed_at`},
      follow_up_id        = ${patch.followUpId !== undefined ? patch.followUpId : sql`follow_up_id`},
      amount_cents        = coalesce(${patch.amountCents ?? null}, amount_cents)
    where id = ${id}
    returning *`;
  return rows[0] ? mapAppointment(rows[0]) : null;
}

export async function rescheduleAppointment(
  id: ID,
  startAt: string,
  endAt: string,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: 'taken' | 'missing' }> {
  const sql = getSql();
  try {
    const rows = await sql`
      update appointments set start_at = ${startAt}, end_at = ${endAt}
      where id = ${id} returning *`;
    if (!rows[0]) return { ok: false, reason: 'missing' };
    return { ok: true, appointment: mapAppointment(rows[0]) };
  } catch (error) {
    if (isPgError(error, EXCLUSION_VIOLATION)) return { ok: false, reason: 'taken' };
    throw error;
  }
}

/* ---------------------------------------------------------------- payments */

export async function createPayment(payment: Payment) {
  const sql = getSql();
  await sql`
    insert into payments (
      id, appointment_id, follow_up_id, client_user_id, amount_cents, currency, method,
      status, provider, provider_checkout_id, provider_payment_id, checkout_url,
      paid_at, failure_reason, is_demo, created_at, updated_at
    ) values (
      ${payment.id}, ${payment.appointmentId ?? null}, ${payment.followUpId ?? null},
      ${payment.clientUserId}, ${payment.amountCents}, ${payment.currency}, ${payment.method},
      ${payment.status}, ${payment.provider}, ${payment.providerCheckoutId ?? null},
      ${payment.providerPaymentId ?? null}, ${payment.checkoutUrl ?? null},
      ${payment.paidAt ?? null}, ${payment.failureReason ?? null}, ${payment.isDemo ?? false},
      ${payment.createdAt}, ${payment.updatedAt}
    )`;
  return payment;
}

export async function getPayment(id: ID): Promise<Payment | null> {
  const sql = getSql();
  const rows = await sql`select * from payments where id = ${id} limit 1`;
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function getPaymentByCheckoutId(checkoutId: string): Promise<Payment | null> {
  const sql = getSql();
  const rows = await sql`select * from payments where provider_checkout_id = ${checkoutId} limit 1`;
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function getPaymentForAppointment(appointmentId: ID): Promise<Payment | null> {
  const sql = getSql();
  const rows = await sql`
    select * from payments where appointment_id = ${appointmentId}
    order by created_at desc limit 1`;
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function getPaymentForFollowUp(followUpId: ID): Promise<Payment | null> {
  const sql = getSql();
  const rows = await sql`
    select * from payments where follow_up_id = ${followUpId}
    order by created_at desc limit 1`;
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function updatePayment(id: ID, patch: Partial<Payment>) {
  const sql = getSql();
  const rows = await sql`
    update payments set
      status               = coalesce(${patch.status ?? null}, status),
      provider             = coalesce(${patch.provider ?? null}, provider),
      provider_checkout_id = ${patch.providerCheckoutId !== undefined ? patch.providerCheckoutId : sql`provider_checkout_id`},
      provider_payment_id  = ${patch.providerPaymentId !== undefined ? patch.providerPaymentId : sql`provider_payment_id`},
      checkout_url         = ${patch.checkoutUrl !== undefined ? patch.checkoutUrl : sql`checkout_url`},
      paid_at              = ${patch.paidAt !== undefined ? patch.paidAt : sql`paid_at`},
      failure_reason       = ${patch.failureReason !== undefined ? patch.failureReason : sql`failure_reason`}
    where id = ${id}
    returning *`;
  return rows[0] ? mapPayment(rows[0]) : null;
}

export async function listPayments(filter?: { clientUserId?: ID }): Promise<Payment[]> {
  const sql = getSql();
  const rows = await sql`
    select * from payments
    where true ${filter?.clientUserId ? sql`and client_user_id = ${filter.clientUserId}` : sql``}
    order by created_at desc`;
  return rows.map(mapPayment);
}

export async function recordPaymentEvent(paymentId: ID, type: string, payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`
    insert into payment_events (id, payment_id, type, payload)
    values (${newId('pev')}, ${paymentId}, ${type}, ${sql.json(payload as never)})`;
}

export async function listPaymentEvents(paymentId: ID): Promise<PaymentEvent[]> {
  const sql = getSql();
  const rows = await sql`
    select * from payment_events where payment_id = ${paymentId} order by created_at`;
  return rows.map((r: any) => ({
    id: r.id,
    paymentId: r.payment_id,
    type: r.type,
    payload: r.payload ?? {},
    createdAt: isoRequired(r.created_at),
  }));
}

/* -------------------------------------------------------------- follow-ups */

export async function listFollowUps(filter?: { clientUserId?: ID }): Promise<FollowUp[]> {
  const sql = getSql();
  const rows = await sql`
    select * from follow_ups
    where true ${filter?.clientUserId ? sql`and client_user_id = ${filter.clientUserId}` : sql``}
    order by due_date`;
  return rows.map(mapFollowUp);
}

export async function getFollowUp(id: ID): Promise<FollowUp | null> {
  const sql = getSql();
  const rows = await sql`select * from follow_ups where id = ${id} limit 1`;
  return rows[0] ? mapFollowUp(rows[0]) : null;
}

export async function createFollowUp(followUp: FollowUp) {
  const sql = getSql();
  await sql`
    insert into follow_ups (
      id, client_user_id, service_id, created_by_user_id, source_appointment_id, appointment_id,
      due_date, preferred_time, mode, location_id, payment_required, amount_cents, status,
      reminder_date, reminder_sent_at, channel, notes, is_demo, created_at, updated_at
    ) values (
      ${followUp.id}, ${followUp.clientUserId}, ${followUp.serviceId}, ${followUp.createdByUserId},
      ${followUp.sourceAppointmentId ?? null}, ${followUp.appointmentId ?? null},
      ${followUp.dueDate}, ${followUp.preferredTime ?? null}, ${followUp.mode},
      ${followUp.locationId ?? null}, ${followUp.paymentRequired}, ${followUp.amountCents},
      ${followUp.status}, ${followUp.reminderDate}, ${followUp.reminderSentAt ?? null},
      ${followUp.channel}, ${followUp.notes ?? null}, ${followUp.isDemo ?? false},
      ${followUp.createdAt}, ${followUp.updatedAt}
    )`;
  return followUp;
}

export async function updateFollowUp(id: ID, patch: Partial<FollowUp>) {
  const sql = getSql();
  const rows = await sql`
    update follow_ups set
      status           = coalesce(${patch.status ?? null}, status),
      appointment_id   = ${patch.appointmentId !== undefined ? patch.appointmentId : sql`appointment_id`},
      reminder_sent_at = ${patch.reminderSentAt !== undefined ? patch.reminderSentAt : sql`reminder_sent_at`},
      notes            = ${patch.notes !== undefined ? patch.notes : sql`notes`},
      due_date         = coalesce(${patch.dueDate ?? null}, due_date),
      reminder_date    = coalesce(${patch.reminderDate ?? null}, reminder_date),
      amount_cents     = coalesce(${patch.amountCents ?? null}, amount_cents)
    where id = ${id}
    returning *`;
  return rows[0] ? mapFollowUp(rows[0]) : null;
}

/* ---------------------------------------------------------------- calendar */

export async function getCalendarEventForAppointment(appointmentId: ID): Promise<CalendarEvent | null> {
  const sql = getSql();
  const rows = await sql`select * from calendar_events where appointment_id = ${appointmentId} limit 1`;
  return rows[0] ? mapCalendarEvent(rows[0]) : null;
}

export async function upsertCalendarEvent(event: CalendarEvent) {
  const sql = getSql();
  const [row] = await sql`
    insert into calendar_events (
      id, appointment_id, provider, external_id, calendar_id, html_link, status,
      last_error, synced_at, created_at, updated_at
    ) values (
      ${event.id}, ${event.appointmentId}, ${event.provider}, ${event.externalId},
      ${event.calendarId}, ${event.htmlLink ?? null}, ${event.status},
      ${event.lastError ?? null}, ${event.syncedAt ?? null}, ${event.createdAt}, ${event.updatedAt}
    )
    on conflict (appointment_id) do update set
      external_id = excluded.external_id,
      calendar_id = excluded.calendar_id,
      html_link   = excluded.html_link,
      status      = excluded.status,
      last_error  = excluded.last_error,
      synced_at   = excluded.synced_at,
      updated_at  = now()
    returning *`;
  return mapCalendarEvent(row);
}

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const sql = getSql();
  const rows = await sql`select * from calendar_events order by created_at desc`;
  return rows.map(mapCalendarEvent);
}

/* ----------------------------------------------------------- notifications */

export async function createNotification(input: Omit<NotificationRecord, 'id' | 'createdAt' | 'read'>) {
  const sql = getSql();
  const [row] = await sql`
    insert into notifications (id, user_id, audience, type, title, body, href)
    values (${newId('ntf')}, ${input.userId ?? null}, ${input.audience}, ${input.type},
            ${input.title}, ${input.body}, ${input.href ?? null})
    returning *`;
  return mapNotification(row);
}

export async function listNotifications(filter: { audience: 'client' | 'staff'; userId?: ID }) {
  const sql = getSql();
  const rows = await sql`
    select * from notifications
    where audience = ${filter.audience}
      ${filter.userId ? sql`and user_id = ${filter.userId}` : sql``}
    order by created_at desc
    limit 200`;
  return rows.map(mapNotification);
}

export async function markNotificationsRead(ids: ID[]) {
  if (!ids.length) return;
  const sql = getSql();
  await sql`update notifications set read = true where id = any(${ids})`;
}

export async function createNotificationLog(entry: Omit<NotificationLog, 'id' | 'createdAt'>) {
  const sql = getSql();
  const [row] = await sql`
    insert into notification_logs (
      id, notification_id, channel, recipient, subject, body, href, status, provider,
      error, scheduled_for, sent_at
    ) values (
      ${newId('nlg')}, ${entry.notificationId ?? null}, ${entry.channel}, ${entry.to},
      ${entry.subject}, ${entry.body ?? ''}, ${entry.href ?? null}, ${entry.status},
      ${entry.provider}, ${entry.error ?? null}, ${entry.scheduledFor ?? null}, ${entry.sentAt ?? null}
    ) returning *`;
  return mapNotificationLog(row);
}

export async function listNotificationLogs(limit = 100): Promise<NotificationLog[]> {
  const sql = getSql();
  const rows = await sql`select * from notification_logs order by created_at desc limit ${limit}`;
  return rows.map(mapNotificationLog);
}

export async function listNotificationLogsForUser(email: string): Promise<NotificationLog[]> {
  const sql = getSql();
  const rows = await sql`
    select * from notification_logs where recipient = ${email} order by created_at desc limit 200`;
  return rows.map(mapNotificationLog);
}

/** Queued messages whose time has come. Read by the reminder worker. */
export async function listDueNotificationLogs(limit = 200): Promise<NotificationLog[]> {
  const sql = getSql();
  const rows = await sql`
    select * from notification_logs
    where status = 'queued' and scheduled_for is not null and scheduled_for <= now()
    order by scheduled_for
    limit ${limit}`;
  return rows.map(mapNotificationLog);
}

export async function markNotificationLogResult(
  id: ID,
  result: { ok: boolean; error?: string | null },
) {
  const sql = getSql();
  await sql`
    update notification_logs
    set status  = ${result.ok ? 'sent' : 'failed'},
        sent_at = ${result.ok ? nowISO() : null},
        error   = ${result.error ?? null}
    where id = ${id}`;
}

/* ---------------------------------------------------------------- content */

export async function listResources(publishedOnly = true): Promise<Resource[]> {
  const sql = getSql();
  const rows = await sql`
    select * from resources
    where true ${publishedOnly ? sql`and published` : sql``}
    order by sort_order`;
  return rows.map(mapResource);
}

export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  const sql = getSql();
  const rows = await sql`select * from resources where slug = ${slug} limit 1`;
  return rows[0] ? mapResource(rows[0]) : null;
}

export async function updateResource(id: ID, patch: Partial<Resource>) {
  const sql = getSql();
  const rows = await sql`
    update resources set
      published = coalesce(${patch.published ?? null}, published),
      title     = coalesce(${patch.title ?? null}, title),
      excerpt   = coalesce(${patch.excerpt ?? null}, excerpt),
      body      = coalesce(${patch.body ?? null}, body),
      topic     = coalesce(${patch.topic ?? null}, topic)
    where id = ${id}
    returning *`;
  return rows[0] ? mapResource(rows[0]) : null;
}

export async function listWorkshops(): Promise<Workshop[]> {
  const sql = getSql();
  const rows = await sql`select * from workshops order by sort_order`;
  return rows.map(mapWorkshop);
}

/* ------------------------------------------------------- notes and consent */

export async function listClientNotes(clientUserId: ID): Promise<ClientNote[]> {
  const sql = getSql();
  const rows = await sql`
    select * from client_notes where client_user_id = ${clientUserId} order by created_at desc`;
  return rows.map(mapNote);
}

export async function createClientNote(note: Omit<ClientNote, 'id' | 'createdAt'>) {
  const sql = getSql();
  const [row] = await sql`
    insert into client_notes (id, client_user_id, author_user_id, appointment_id, category, body, is_demo)
    values (${newId('nte')}, ${note.clientUserId}, ${note.authorUserId},
            ${note.appointmentId ?? null}, ${note.category}, ${note.body}, ${note.isDemo ?? false})
    returning *`;
  return mapNote(row);
}

export async function recordConsent(consent: Omit<Consent, 'id'>) {
  const sql = getSql();
  const [row] = await sql`
    insert into consents (id, user_id, type, version, granted, granted_at, ip_hash)
    values (${newId('cns')}, ${consent.userId}, ${consent.type}, ${consent.version},
            ${consent.granted}, ${consent.grantedAt}, ${consent.ipHash ?? null})
    returning *`;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    version: row.version,
    granted: row.granted,
    grantedAt: isoRequired(row.granted_at),
    ipHash: row.ip_hash,
  } as Consent;
}

export async function listConsents(userId: ID): Promise<Consent[]> {
  const sql = getSql();
  const rows = await sql`select * from consents where user_id = ${userId} order by granted_at`;
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    version: r.version,
    granted: r.granted,
    grantedAt: isoRequired(r.granted_at),
    ipHash: r.ip_hash,
  }));
}

/* -------------------------------------------------------------- audit log */

export async function audit(entry: Omit<AuditLog, 'id' | 'createdAt'>) {
  const sql = getSql();
  await sql`
    insert into audit_logs (id, actor_user_id, actor_role, action, entity, entity_id, meta)
    values (${newId('aud')}, ${entry.actorUserId ?? null}, ${entry.actorRole ?? null},
            ${entry.action}, ${entry.entity}, ${entry.entityId ?? null},
            ${sql.json((entry.meta ?? {}) as never)})`;
}

export async function listAuditLogs(filter?: { entityId?: ID; limit?: number }): Promise<AuditLog[]> {
  const sql = getSql();
  const rows = await sql`
    select * from audit_logs
    where true ${filter?.entityId ? sql`and entity_id = ${filter.entityId}` : sql``}
    order by created_at desc
    limit ${filter?.limit ?? 200}`;
  return rows.map((r: any) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorRole: r.actor_role,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    meta: r.meta ?? {},
    createdAt: isoRequired(r.created_at),
  }));
}

/* --------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const sql = getSql();
  const rows = await sql`select data from settings where id = 1 limit 1`;
  if (!rows[0]) {
    throw new Error('Settings row is missing. Run db/seed.sql against the database.');
  }
  return rows[0].data as Settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  const sql = getSql();
  // Merge in SQL so two concurrent admin saves cannot clobber each other's
  // untouched sections.
  const [row] = await sql`
    update settings
    set data = data
          || ${sql.json(patch as never)}
          || jsonb_build_object('updatedAt', ${nowISO()}),
        updated_at = now()
    where id = 1
    returning data`;
  return row.data as Settings;
}

/* ------------------------------------------------------------ view models */

/**
 * Placeholders for records an appointment or follow-up refers to that no
 * longer exist. Shared by both hydrators — see the note in
 * hydrateAppointments for why substituting beats casting.
 */
function missingServiceFallback(id: ID): Service {
  return {
    id,
    categoryId: '',
    slug: 'unknown',
    name: 'Unknown service',
    summary: 'This service is no longer in the catalogue.',
    durationMinutes: 60,
    rateBand: 'individual',
    priceInPersonCents: 0,
    priceOnlineCents: 0,
    allowsOnline: true,
    allowsInPerson: true,
    requiresQuote: false,
    active: false,
  } as unknown as Service;
}

function missingCategoryFallback(id: string): ServiceCategory {
  return {
    id,
    slug: 'unknown',
    name: 'Uncategorised',
    summary: '',
    description: '',
    areas: [],
    concerns: [],
    icon: 'Sprout',
    accent: 'forest',
    order: 999,
    active: false,
  } as unknown as ServiceCategory;
}

export async function hydrateAppointments(appointments: Appointment[]): Promise<AppointmentView[]> {
  if (!appointments.length) return [];
  const sql = getSql();
  const ids = appointments.map((a) => a.id);
  const clientIds = [...new Set(appointments.map((a) => a.clientUserId))];

  /**
   * Two waves of three, not six at once.
   *
   * This used to fire all six queries in a single `Promise.all`. With a small
   * connection pool that claimed every connection at once, leaving nothing for
   * anything else the request was doing — and if one connection was briefly
   * stuck, the sixth query queued behind it with no timeout and the page hung
   * until the platform killed it. Every heavy admin page (dashboard, calendar,
   * appointments, payments) runs this, so it was the common cause of pages
   * "loading forever."
   *
   * Splitting into two sequential waves of three caps the concurrency this
   * function needs at three connections, leaving headroom in the pool. The
   * four reference reads are tiny tables; the extra round trip is negligible
   * next to never hanging.
   */
  const [services, categories, locations] = await Promise.all([
    sql`select * from services`,
    sql`select * from service_categories`,
    sql`select * from locations`,
  ]);
  const [practitioners, payments, clients] = await Promise.all([
    sql`select * from practitioners`,
    // Latest payment per appointment.
    sql`select distinct on (appointment_id) * from payments
        where appointment_id = any(${ids})
        order by appointment_id, created_at desc`,
    sql`select u.id, u.email, p.first_name, p.last_name, p.phone
        from users u join profiles p on p.user_id = u.id
        where u.id = any(${clientIds})`,
  ]);

  const serviceMap = new Map(services.map((r: any) => [r.id, mapService(r)]));
  const categoryMap = new Map(categories.map((r: any) => [r.id, mapCategory(r)]));
  const locationMap = new Map(locations.map((r: any) => [r.id, mapLocation(r)]));
  const practitionerMap = new Map(practitioners.map((r: any) => [r.id, mapPractitioner(r)]));
  const paymentMap = new Map(payments.map((r: any) => [r.appointment_id, mapPayment(r)]));
  const clientMap = new Map(
    clients.map((r: any) => [
      r.id,
      {
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone as string | null,
      },
    ]),
  );

  /**
   * Never hand back a view with a missing service or category.
   *
   * This used to do `serviceMap.get(a.serviceId) as Service` — a cast that
   * asserts the row exists when it may not. An appointment can outlive the
   * service it points at: the service is renamed, deactivated, reseeded with a
   * different id, or removed from the catalogue. The cast made every consumer
   * believe `view.service` was safe, and reading anything off it threw
   * `Cannot read properties of undefined`, which took down the whole admin
   * dashboard — and with it sign-in, because the login redirect waits for
   * /admin to render.
   *
   * Guarding at each call site was the wrong fix; there are dozens, and the
   * next one added would reintroduce it. The hydrator is the single place that
   * knows a lookup failed, so it substitutes a clearly-labelled placeholder.
   * A row showing "Unknown service" is a data problem someone can see and fix.
   * A crashed console is not.
   */
  return appointments.map((a) => {
    const service = serviceMap.get(a.serviceId) ?? missingServiceFallback(a.serviceId);
    const category = categoryMap.get(service.categoryId) ?? missingCategoryFallback(service.categoryId);
    return {
      ...a,
      service,
      category,
      location: a.locationId ? (locationMap.get(a.locationId) ?? null) : null,
      practitioner: a.practitionerId ? (practitionerMap.get(a.practitionerId) ?? null) : null,
      payment: paymentMap.get(a.id) ?? null,
      // Consumers treat a missing client as anonymous rather than crashing.
      client: clientMap.get(a.clientUserId) ?? {
        id: a.clientUserId,
        name: 'Unknown client',
        email: '',
        phone: null,
      },
    };
  });
}

export async function hydrateFollowUps(followUps: FollowUp[]): Promise<FollowUpView[]> {
  if (!followUps.length) return [];
  const sql = getSql();
  const ids = followUps.map((f) => f.id);
  const clientIds = [...new Set(followUps.map((f) => f.clientUserId))];

  const [services, locations, payments, clients] = await Promise.all([
    sql`select * from services`,
    sql`select * from locations`,
    sql`select distinct on (follow_up_id) * from payments
        where follow_up_id = any(${ids})
        order by follow_up_id, created_at desc`,
    sql`select u.id, u.email, p.first_name, p.last_name, p.phone
        from users u join profiles p on p.user_id = u.id
        where u.id = any(${clientIds})`,
  ]);

  const serviceMap = new Map(services.map((r: any) => [r.id, mapService(r)]));
  const locationMap = new Map(locations.map((r: any) => [r.id, mapLocation(r)]));
  const paymentMap = new Map(payments.map((r: any) => [r.follow_up_id, mapPayment(r)]));
  const clientMap = new Map(
    clients.map((r: any) => [
      r.id,
      {
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone as string | null,
      },
    ]),
  );

  // Same reasoning as hydrateAppointments above: a follow-up can outlive the
  // service it refers to, and an unchecked cast turns that into a crash on the
  // follow-ups screen.
  return followUps.map((f) => ({
    ...f,
    service: serviceMap.get(f.serviceId) ?? missingServiceFallback(f.serviceId),
    location: f.locationId ? (locationMap.get(f.locationId) ?? null) : null,
    payment: paymentMap.get(f.id) ?? null,
    client: clientMap.get(f.clientUserId) ?? {
      id: f.clientUserId,
      name: 'Unknown client',
      email: '',
      phone: null,
    },
  }));
}
