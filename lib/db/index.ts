import 'server-only';

import * as jsonRepo from './json-repo';
import * as pgRepo from './pg-repo';
import { hasDatabase } from './sql';

/**
 * Data layer selection.
 *
 * `DATABASE_URL` present  → PostgreSQL (production; see db/schema.sql)
 * `DATABASE_URL` absent   → JSON file store (local development, zero setup)
 *
 * Everything above this file imports from `@/lib/db` and is unaware of which
 * one is live.
 *
 * The `Repository` type below is derived from the JSON module, and the
 * Postgres module is asserted against it. If the two ever drift — a renamed
 * function, a changed signature, a missed addition — that is a compile error
 * here rather than a 500 in production.
 */

type Repository = typeof jsonRepo;

const postgres: Repository = pgRepo;

const repo: Repository = hasDatabase() ? postgres : jsonRepo;

/** Which implementation is serving requests. Surfaced in admin settings. */
export function activeDataLayer(): 'postgres' | 'json' {
  return hasDatabase() ? 'postgres' : 'json';
}

/* ------------------------------------------------------------------ users */
export const findUserByEmail = repo.findUserByEmail;
export const findUserById = repo.findUserById;
export const getProfile = repo.getProfile;
export const createUserWithProfile = repo.createUserWithProfile;
export const updateProfile = repo.updateProfile;
export const updateUser = repo.updateUser;
export const listStaff = repo.listStaff;
export const listClients = repo.listClients;

/* --------------------------------------------------------------- sessions */
export const createSession = repo.createSession;
export const findSession = repo.findSession;
export const deleteSession = repo.deleteSession;
export const deleteSessionsForUser = repo.deleteSessionsForUser;
export const pruneExpiredSessions = repo.pruneExpiredSessions;
export const findSessionUser = repo.findSessionUser;

/* -------------------------------------------------------------- catalogue */
export const listCategories = repo.listCategories;
export const getCategoryBySlug = repo.getCategoryBySlug;
export const listServices = repo.listServices;
export const listAllServices = repo.listAllServices;
export const getService = repo.getService;
export const getServiceBySlug = repo.getServiceBySlug;
export const updateService = repo.updateService;
export const listLocations = repo.listLocations;
export const getLocation = repo.getLocation;
export const listPractitioners = repo.listPractitioners;

/* ----------------------------------------------------------- availability */
export const listAvailabilityRules = repo.listAvailabilityRules;
export const listAvailabilityBlocks = repo.listAvailabilityBlocks;
export const createAvailabilityBlock = repo.createAvailabilityBlock;
export const deleteAvailabilityBlock = repo.deleteAvailabilityBlock;

/* ------------------------------------------------------------ appointments */
export const listAppointments = repo.listAppointments;
export const getAppointment = repo.getAppointment;
export const getAppointmentByReference = repo.getAppointmentByReference;
export const listBookedIntervals = repo.listBookedIntervals;
export const createAppointmentIfFree = repo.createAppointmentIfFree;
export const updateAppointment = repo.updateAppointment;
export const rescheduleAppointment = repo.rescheduleAppointment;

/* ---------------------------------------------------------------- payments */
export const createPayment = repo.createPayment;
export const getPayment = repo.getPayment;
export const getPaymentByCheckoutId = repo.getPaymentByCheckoutId;
export const getPaymentForAppointment = repo.getPaymentForAppointment;
export const getPaymentForFollowUp = repo.getPaymentForFollowUp;
export const updatePayment = repo.updatePayment;
export const listPayments = repo.listPayments;
export const recordPaymentEvent = repo.recordPaymentEvent;
export const listPaymentEvents = repo.listPaymentEvents;

/* -------------------------------------------------------------- follow-ups */
export const listFollowUps = repo.listFollowUps;
export const getFollowUp = repo.getFollowUp;
export const createFollowUp = repo.createFollowUp;
export const updateFollowUp = repo.updateFollowUp;

/* ---------------------------------------------------------------- calendar */
export const getCalendarEventForAppointment = repo.getCalendarEventForAppointment;
export const upsertCalendarEvent = repo.upsertCalendarEvent;
export const listCalendarEvents = repo.listCalendarEvents;

/* ----------------------------------------------------------- notifications */
export const createNotification = repo.createNotification;
export const listNotifications = repo.listNotifications;
export const markNotificationsRead = repo.markNotificationsRead;
export const createNotificationLog = repo.createNotificationLog;
export const listNotificationLogs = repo.listNotificationLogs;
export const listNotificationLogsForUser = repo.listNotificationLogsForUser;
export const listDueNotificationLogs = repo.listDueNotificationLogs;
export const markNotificationLogResult = repo.markNotificationLogResult;

/* ---------------------------------------------------------------- content */
export const listResources = repo.listResources;
export const getResourceBySlug = repo.getResourceBySlug;
export const updateResource = repo.updateResource;
export const listWorkshops = repo.listWorkshops;

/* ------------------------------------------------------- notes and consent */
export const listClientNotes = repo.listClientNotes;
export const createClientNote = repo.createClientNote;
export const recordConsent = repo.recordConsent;
export const listConsents = repo.listConsents;

/* -------------------------------------------------------------- audit log */
export const audit = repo.audit;
export const listAuditLogs = repo.listAuditLogs;

/* --------------------------------------------------------------- settings */
export const getSettings = repo.getSettings;
export const updateSettings = repo.updateSettings;

/* ------------------------------------------------------------ view models */
export const hydrateAppointments = repo.hydrateAppointments;
export const hydrateFollowUps = repo.hydrateFollowUps;

/* ------------------------------------------------------- shared utilities */
export { newId, nowISO, newReference } from './ids';
