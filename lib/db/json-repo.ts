import 'server-only';

import { getDb, newId, nowISO, transact } from './store';
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
 * Repository layer — JSON file store (local development).
 *
 * Everything above this file (services, routes, components) speaks only in
 * these functions. Replacing the JSON store with Supabase means rewriting this
 * module against postgres — nothing else changes.
 */

/* ------------------------------------------------------------------ users */

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export async function findUserById(id: ID): Promise<User | null> {
  const db = await getDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function getProfile(userId: ID): Promise<Profile | null> {
  const db = await getDb();
  return db.profiles.find((p) => p.userId === userId) ?? null;
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
  return transact((db) => {
    const ts = nowISO();
    const user: User = {
      id: newId('usr'),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      emailVerified: false,
      createdAt: ts,
      updatedAt: ts,
    };
    const profile: Profile = {
      id: newId('prf'),
      userId: user.id,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone ?? null,
      preferredContact: input.preferredContact ?? 'email',
      createdAt: ts,
      updatedAt: ts,
    };
    db.users.push(user);
    db.profiles.push(profile);
    return { user, profile };
  });
}

export async function updateProfile(userId: ID, patch: Partial<Profile>): Promise<Profile | null> {
  return transact((db) => {
    const profile = db.profiles.find((p) => p.userId === userId);
    if (!profile) return null;
    Object.assign(profile, patch, { updatedAt: nowISO() });
    return profile;
  });
}

export async function updateUser(userId: ID, patch: Partial<User>): Promise<User | null> {
  return transact((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    Object.assign(user, patch, { updatedAt: nowISO() });
    return user;
  });
}

export async function listStaff(): Promise<{ user: User; profile: Profile | null }[]> {
  const db = await getDb();
  return db.users
    .filter((u) => u.role !== 'CLIENT')
    .map((user) => ({ user, profile: db.profiles.find((p) => p.userId === user.id) ?? null }));
}

export async function listClients(): Promise<{ user: User; profile: Profile }[]> {
  const db = await getDb();
  return db.users
    .filter((u) => u.role === 'CLIENT')
    .map((user) => ({ user, profile: db.profiles.find((p) => p.userId === user.id)! }))
    .filter((r) => Boolean(r.profile));
}

/* --------------------------------------------------------------- sessions */

export async function createSession(userId: ID, token: string, expiresAt: string) {
  return transact((db) => {
    // No pruning here — sign-in should not pay for housekeeping. See the note
    // on the Postgres implementation; the cron calls pruneExpiredSessions.
    db.sessions.push({ token, userId, expiresAt, createdAt: nowISO() });
    const user = db.users.find((u) => u.id === userId);
    if (user) user.lastLoginAt = nowISO();
  });
}

/** Session → user in one pass. Mirrors the Postgres single-query version. */
export async function findSessionUser(token: string) {
  const db = await getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;

  const user = db.users.find((u) => u.id === session.userId);
  if (!user || user.disabled) return null;

  const profile = db.profiles.find((p) => p.userId === user.id);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    disabled: Boolean(user.disabled),
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
  };
}

/** Housekeeping, called by the cron rather than by anyone signing in. */
export async function pruneExpiredSessions(): Promise<number> {
  let removed = 0;
  await transact((db) => {
    const now = Date.now();
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
    removed = before - db.sessions.length;
  });
  return removed;
}

export async function findSession(token: string) {
  const db = await getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

export async function deleteSession(token: string) {
  return transact((db) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
  });
}

export async function deleteSessionsForUser(userId: ID) {
  return transact((db) => {
    db.sessions = db.sessions.filter((s) => s.userId !== userId);
  });
}

/* -------------------------------------------------------------- catalogue */

export async function listCategories(): Promise<ServiceCategory[]> {
  const db = await getDb();
  return db.serviceCategories.filter((c) => c.active).sort((a, b) => a.order - b.order);
}

export async function getCategoryBySlug(slug: string): Promise<ServiceCategory | null> {
  const db = await getDb();
  return db.serviceCategories.find((c) => c.slug === slug && c.active) ?? null;
}

export async function listServices(): Promise<Service[]> {
  const db = await getDb();
  return db.services.filter((s) => s.active).sort((a, b) => a.order - b.order);
}

export async function listAllServices(): Promise<Service[]> {
  const db = await getDb();
  return [...db.services].sort((a, b) => a.order - b.order);
}

export async function getService(id: ID): Promise<Service | null> {
  const db = await getDb();
  return db.services.find((s) => s.id === id) ?? null;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const db = await getDb();
  return db.services.find((s) => s.slug === slug) ?? null;
}

export async function updateService(id: ID, patch: Partial<Service>) {
  return transact((db) => {
    const service = db.services.find((s) => s.id === id);
    if (!service) return null;
    Object.assign(service, patch);
    return service;
  });
}

export async function listLocations(): Promise<Location[]> {
  const db = await getDb();
  return db.locations.filter((l) => l.active);
}

export async function getLocation(id: ID | null | undefined): Promise<Location | null> {
  if (!id) return null;
  const db = await getDb();
  return db.locations.find((l) => l.id === id) ?? null;
}

export async function listPractitioners(): Promise<Practitioner[]> {
  const db = await getDb();
  return db.practitioners.filter((p) => p.active);
}

/* ----------------------------------------------------------- availability */

export async function listAvailabilityRules(): Promise<AvailabilityRule[]> {
  const db = await getDb();
  return db.availabilityRules.filter((r) => r.active);
}

export async function listAvailabilityBlocks(): Promise<AvailabilityBlock[]> {
  const db = await getDb();
  return db.availabilityBlocks;
}

export async function createAvailabilityBlock(input: Omit<AvailabilityBlock, 'id' | 'createdAt'>) {
  return transact((db) => {
    const block: AvailabilityBlock = { ...input, id: newId('blk'), createdAt: nowISO() };
    db.availabilityBlocks.push(block);
    return block;
  });
}

export async function deleteAvailabilityBlock(id: ID) {
  return transact((db) => {
    db.availabilityBlocks = db.availabilityBlocks.filter((b) => b.id !== id);
  });
}

/* ------------------------------------------------------------ appointments */

/** Statuses that occupy a slot. Cancelled/no-show free the time up again. */
const BLOCKING_STATUSES: Appointment['status'][] = ['pending_payment', 'confirmed', 'completed'];

export async function listAppointments(filter?: {
  clientUserId?: ID;
  from?: string;
  to?: string;
  statuses?: Appointment['status'][];
}): Promise<Appointment[]> {
  const db = await getDb();
  return db.appointments
    .filter((a) => (filter?.clientUserId ? a.clientUserId === filter.clientUserId : true))
    .filter((a) => (filter?.from ? a.startAt >= filter.from : true))
    .filter((a) => (filter?.to ? a.startAt <= filter.to : true))
    .filter((a) => (filter?.statuses ? filter.statuses.includes(a.status) : true))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function getAppointment(id: ID): Promise<Appointment | null> {
  const db = await getDb();
  return db.appointments.find((a) => a.id === id) ?? null;
}

export async function getAppointmentByReference(reference: string): Promise<Appointment | null> {
  const db = await getDb();
  return db.appointments.find((a) => a.reference === reference) ?? null;
}

/** Occupied intervals used by the availability engine. */
export async function listBookedIntervals(from: string, to: string) {
  const db = await getDb();
  return db.appointments
    .filter((a) => BLOCKING_STATUSES.includes(a.status))
    .filter((a) => a.endAt > from && a.startAt < to)
    .map((a) => ({
      start: a.startAt,
      end: a.endAt,
      practitionerId: a.practitionerId ?? null,
      id: a.id,
    }));
}

/**
 * Atomically claim a slot.
 *
 * The overlap check and the insert happen inside one transaction, so two
 * simultaneous bookings for the same time cannot both succeed. Postgres gets
 * the same guarantee from the exclusion constraint in db/schema.sql.
 */
export async function createAppointmentIfFree(
  appointment: Appointment,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: 'taken' }> {
  return transact((db) => {
    const clash = db.appointments.some(
      (a) =>
        BLOCKING_STATUSES.includes(a.status) &&
        (a.practitionerId ?? null) === (appointment.practitionerId ?? null) &&
        a.startAt < appointment.endAt &&
        a.endAt > appointment.startAt,
    );
    if (clash) return { ok: false as const, reason: 'taken' as const };
    db.appointments.push(appointment);
    return { ok: true as const, appointment };
  });
}

export async function updateAppointment(id: ID, patch: Partial<Appointment>) {
  return transact((db) => {
    const appointment = db.appointments.find((a) => a.id === id);
    if (!appointment) return null;
    Object.assign(appointment, patch, { updatedAt: nowISO() });
    return appointment;
  });
}

/** Move an appointment, re-checking the destination slot under the same lock. */
export async function rescheduleAppointment(
  id: ID,
  startAt: string,
  endAt: string,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; reason: 'taken' | 'missing' }> {
  return transact((db) => {
    const appointment = db.appointments.find((a) => a.id === id);
    if (!appointment) return { ok: false as const, reason: 'missing' as const };
    const clash = db.appointments.some(
      (a) =>
        a.id !== id &&
        BLOCKING_STATUSES.includes(a.status) &&
        (a.practitionerId ?? null) === (appointment.practitionerId ?? null) &&
        a.startAt < endAt &&
        a.endAt > startAt,
    );
    if (clash) return { ok: false as const, reason: 'taken' as const };
    appointment.startAt = startAt;
    appointment.endAt = endAt;
    appointment.updatedAt = nowISO();
    return { ok: true as const, appointment };
  });
}

/* ---------------------------------------------------------------- payments */

export async function createPayment(payment: Payment) {
  return transact((db) => {
    db.payments.push(payment);
    return payment;
  });
}

export async function getPayment(id: ID): Promise<Payment | null> {
  const db = await getDb();
  return db.payments.find((p) => p.id === id) ?? null;
}

export async function getPaymentByCheckoutId(checkoutId: string): Promise<Payment | null> {
  const db = await getDb();
  return db.payments.find((p) => p.providerCheckoutId === checkoutId) ?? null;
}

export async function getPaymentForAppointment(appointmentId: ID): Promise<Payment | null> {
  const db = await getDb();
  return (
    [...db.payments]
      .filter((p) => p.appointmentId === appointmentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export async function getPaymentForFollowUp(followUpId: ID): Promise<Payment | null> {
  const db = await getDb();
  return (
    [...db.payments]
      .filter((p) => p.followUpId === followUpId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export async function updatePayment(id: ID, patch: Partial<Payment>) {
  return transact((db) => {
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) return null;
    Object.assign(payment, patch, { updatedAt: nowISO() });
    return payment;
  });
}

export async function listPayments(filter?: { clientUserId?: ID }): Promise<Payment[]> {
  const db = await getDb();
  return db.payments
    .filter((p) => (filter?.clientUserId ? p.clientUserId === filter.clientUserId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function recordPaymentEvent(paymentId: ID, type: string, payload: Record<string, unknown>) {
  return transact((db) => {
    db.paymentEvents.push({ id: newId('pev'), paymentId, type, payload, createdAt: nowISO() });
  });
}

export async function listPaymentEvents(paymentId: ID) {
  const db = await getDb();
  return db.paymentEvents
    .filter((e) => e.paymentId === paymentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* -------------------------------------------------------------- follow-ups */

export async function listFollowUps(filter?: { clientUserId?: ID }): Promise<FollowUp[]> {
  const db = await getDb();
  return db.followUps
    .filter((f) => (filter?.clientUserId ? f.clientUserId === filter.clientUserId : true))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function getFollowUp(id: ID): Promise<FollowUp | null> {
  const db = await getDb();
  return db.followUps.find((f) => f.id === id) ?? null;
}

export async function createFollowUp(followUp: FollowUp) {
  return transact((db) => {
    db.followUps.push(followUp);
    return followUp;
  });
}

export async function updateFollowUp(id: ID, patch: Partial<FollowUp>) {
  return transact((db) => {
    const followUp = db.followUps.find((f) => f.id === id);
    if (!followUp) return null;
    Object.assign(followUp, patch, { updatedAt: nowISO() });
    return followUp;
  });
}

/* ---------------------------------------------------------------- calendar */

export async function getCalendarEventForAppointment(appointmentId: ID): Promise<CalendarEvent | null> {
  const db = await getDb();
  return db.calendarEvents.find((e) => e.appointmentId === appointmentId) ?? null;
}

export async function upsertCalendarEvent(event: CalendarEvent) {
  return transact((db) => {
    const index = db.calendarEvents.findIndex((e) => e.appointmentId === event.appointmentId);
    if (index >= 0) {
      db.calendarEvents[index] = { ...db.calendarEvents[index], ...event, updatedAt: nowISO() };
      return db.calendarEvents[index];
    }
    db.calendarEvents.push(event);
    return event;
  });
}

export async function listCalendarEvents() {
  const db = await getDb();
  return db.calendarEvents;
}

/* ----------------------------------------------------------- notifications */

export async function createNotification(input: Omit<NotificationRecord, 'id' | 'createdAt' | 'read'>) {
  return transact((db) => {
    const record: NotificationRecord = {
      ...input,
      id: newId('ntf'),
      read: false,
      createdAt: nowISO(),
    };
    db.notifications.unshift(record);
    return record;
  });
}

export async function listNotifications(filter: { audience: 'client' | 'staff'; userId?: ID }) {
  const db = await getDb();
  return db.notifications
    .filter((n) => n.audience === filter.audience)
    .filter((n) => (filter.userId ? n.userId === filter.userId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationsRead(ids: ID[]) {
  return transact((db) => {
    for (const n of db.notifications) if (ids.includes(n.id)) n.read = true;
  });
}

export async function createNotificationLog(entry: Omit<NotificationLog, 'id' | 'createdAt'>) {
  return transact((db) => {
    const log: NotificationLog = { ...entry, id: newId('nlg'), createdAt: nowISO() };
    db.notificationLogs.unshift(log);
    return log;
  });
}

export async function listNotificationLogs(limit = 100) {
  const db = await getDb();
  return db.notificationLogs.slice(0, limit);
}

/** Queued messages whose time has come. Read by the reminder worker. */
export async function listDueNotificationLogs(limit = 200): Promise<NotificationLog[]> {
  const db = await getDb();
  const now = nowISO();
  return db.notificationLogs
    .filter((l) => l.status === 'queued' && l.scheduledFor && l.scheduledFor <= now)
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
    .slice(0, limit);
}

export async function markNotificationLogResult(
  id: ID,
  result: { ok: boolean; error?: string | null },
) {
  return transact((db) => {
    const log = db.notificationLogs.find((l) => l.id === id);
    if (!log) return;
    log.status = result.ok ? 'sent' : 'failed';
    log.sentAt = result.ok ? nowISO() : null;
    log.error = result.error ?? null;
  });
}

export async function listNotificationLogsForUser(email: string) {
  const db = await getDb();
  return db.notificationLogs.filter((l) => l.to === email);
}

/* ---------------------------------------------------------------- content */

export async function listResources(publishedOnly = true): Promise<Resource[]> {
  const db = await getDb();
  return db.resources
    .filter((r) => (publishedOnly ? r.published : true))
    .sort((a, b) => a.order - b.order);
}

export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  const db = await getDb();
  return db.resources.find((r) => r.slug === slug) ?? null;
}

export async function updateResource(id: ID, patch: Partial<Resource>) {
  return transact((db) => {
    const resource = db.resources.find((r) => r.id === id);
    if (!resource) return null;
    Object.assign(resource, patch);
    return resource;
  });
}

export async function listWorkshops(): Promise<Workshop[]> {
  const db = await getDb();
  return [...db.workshops].sort((a, b) => a.order - b.order);
}

/* ------------------------------------------------------- notes and consent */

export async function listClientNotes(clientUserId: ID): Promise<ClientNote[]> {
  const db = await getDb();
  return db.clientNotes
    .filter((n) => n.clientUserId === clientUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createClientNote(note: Omit<ClientNote, 'id' | 'createdAt'>) {
  return transact((db) => {
    const record: ClientNote = { ...note, id: newId('nte'), createdAt: nowISO() };
    db.clientNotes.push(record);
    return record;
  });
}

export async function recordConsent(consent: Omit<Consent, 'id'>) {
  return transact((db) => {
    const record: Consent = { ...consent, id: newId('cns') };
    db.consents.push(record);
    return record;
  });
}

export async function listConsents(userId: ID) {
  const db = await getDb();
  return db.consents.filter((c) => c.userId === userId);
}

/* -------------------------------------------------------------- audit log */

export async function audit(entry: Omit<AuditLog, 'id' | 'createdAt'>) {
  return transact((db) => {
    db.auditLogs.unshift({ ...entry, id: newId('aud'), createdAt: nowISO() });
    // Bounded in the dev store; postgres keeps the full history.
    if (db.auditLogs.length > 2000) db.auditLogs.length = 2000;
  });
}

export async function listAuditLogs(filter?: { entityId?: ID; limit?: number }) {
  const db = await getDb();
  return db.auditLogs
    .filter((l) => (filter?.entityId ? l.entityId === filter.entityId : true))
    .slice(0, filter?.limit ?? 200);
}

/* --------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  return db.settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  return transact((db) => {
    db.settings = {
      ...db.settings,
      ...patch,
      business: { ...db.settings.business, ...(patch.business ?? {}) },
      scheduling: { ...db.settings.scheduling, ...(patch.scheduling ?? {}) },
      reminders: { ...db.settings.reminders, ...(patch.reminders ?? {}) },
      payments: { ...db.settings.payments, ...(patch.payments ?? {}) },
      calendar: { ...db.settings.calendar, ...(patch.calendar ?? {}) },
      policy: { ...db.settings.policy, ...(patch.policy ?? {}) },
      updatedAt: nowISO(),
    };
    return db.settings;
  });
}

/* ------------------------------------------------------------ view models */

/** Hydrate appointments with their service, location, payment and client. */
export async function hydrateAppointments(appointments: Appointment[]): Promise<AppointmentView[]> {
  const db = await getDb();
  return appointments.map((a) => {
    const service = db.services.find((s) => s.id === a.serviceId)!;
    const category = db.serviceCategories.find((c) => c.id === service?.categoryId)!;
    const profile = db.profiles.find((p) => p.userId === a.clientUserId);
    const user = db.users.find((u) => u.id === a.clientUserId);
    return {
      ...a,
      service,
      category,
      location: db.locations.find((l) => l.id === a.locationId) ?? null,
      practitioner: db.practitioners.find((p) => p.id === a.practitionerId) ?? null,
      payment:
        [...db.payments]
          .filter((p) => p.appointmentId === a.id)
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0] ?? null,
      client: profile
        ? {
            id: a.clientUserId,
            name: `${profile.firstName} ${profile.lastName}`.trim(),
            email: user?.email ?? '',
            phone: profile.phone,
          }
        : undefined,
    };
  });
}

export async function hydrateFollowUps(followUps: FollowUp[]): Promise<FollowUpView[]> {
  const db = await getDb();
  return followUps.map((f) => {
    const profile = db.profiles.find((p) => p.userId === f.clientUserId);
    const user = db.users.find((u) => u.id === f.clientUserId);
    return {
      ...f,
      service: db.services.find((s) => s.id === f.serviceId)!,
      location: db.locations.find((l) => l.id === f.locationId) ?? null,
      payment:
        [...db.payments]
          .filter((p) => p.followUpId === f.id)
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0] ?? null,
      client: profile
        ? {
            id: f.clientUserId,
            name: `${profile.firstName} ${profile.lastName}`.trim(),
            email: user?.email ?? '',
            phone: profile.phone,
          }
        : undefined,
    };
  });
}
