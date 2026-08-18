import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { newId, nowISO, newReference } from './ids';

import type {
  Appointment,
  AuditLog,
  AvailabilityBlock,
  AvailabilityRule,
  CalendarEvent,
  ClientNote,
  Consent,
  FollowUp,
  Location,
  NotificationLog,
  NotificationRecord,
  Payment,
  PaymentEvent,
  Practitioner,
  Profile,
  Resource,
  Service,
  ServiceCategory,
  Settings,
  User,
  Workshop,
} from '@/types';

/**
 * Development / demo datastore.
 *
 * The whole application talks to the repository functions in lib/db/index.ts,
 * never to this file directly. That indirection is the point: swapping this
 * JSON-file store for Supabase means reimplementing lib/db/index.ts against
 * postgres and leaving every caller untouched. The production schema and RLS
 * policies live in db/schema.sql.
 */

export interface Database {
  version: number;
  users: User[];
  profiles: Profile[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  locations: Location[];
  practitioners: Practitioner[];
  availabilityRules: AvailabilityRule[];
  availabilityBlocks: AvailabilityBlock[];
  appointments: Appointment[];
  payments: Payment[];
  paymentEvents: PaymentEvent[];
  followUps: FollowUp[];
  calendarEvents: CalendarEvent[];
  notifications: NotificationRecord[];
  notificationLogs: NotificationLog[];
  resources: Resource[];
  workshops: Workshop[];
  clientNotes: ClientNote[];
  consents: Consent[];
  auditLogs: AuditLog[];
  sessions: { token: string; userId: string; expiresAt: string; createdAt: string }[];
  settings: Settings;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

/**
 * Cached across hot reloads. Without the globalThis pin, every dev-server
 * module reload would produce a second in-memory copy and writes would be lost.
 */
const globalRef = globalThis as unknown as {
  __bwc_db?: Database;
  __bwc_write_queue?: Promise<void>;
};

let loading: Promise<Database> | null = null;

async function loadFromDisk(): Promise<Database> {
  const { buildSeedDatabase } = await import('./seed');
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Database;
    if (parsed?.version === 1) return parsed;
  } catch {
    // No file yet, or an unreadable/old file — fall through and reseed.
  }
  const seeded = await buildSeedDatabase();
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(seeded, null, 2), 'utf8');
  } catch (error) {
    /**
     * A serverless filesystem is read-only outside /tmp, so this throws EROFS
     * on Vercel whenever DATABASE_URL is missing.
     *
     * Failing loudly here is deliberate. The alternative — keeping the seed in
     * memory and carrying on — "works": pages render and a booking appears to
     * succeed. But each instance holds its own copy, so the client's booking is
     * gone the moment a different instance answers, and the practice would see
     * an app that randomly loses appointments rather than one that is
     * misconfigured. This message names the actual fix instead.
     */
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
      throw new Error(
        'No DATABASE_URL is set and this filesystem is read-only, so there is ' +
          'nowhere to keep data. The JSON store is for local development only. ' +
          'Set DATABASE_URL to a Postgres/Supabase connection string — see DEPLOY.md.',
      );
    }
    throw error;
  }
  return seeded;
}

export { newId, nowISO, newReference };

export async function getDb(): Promise<Database> {
  if (globalRef.__bwc_db) return globalRef.__bwc_db;
  if (!loading) {
    loading = loadFromDisk().then((db) => {
      globalRef.__bwc_db = db;
      return db;
    });
  }
  return loading;
}

/**
 * Serialised persistence. Writes are chained through a single promise so two
 * concurrent requests can never interleave a read-modify-write on the file.
 */
export async function persist(): Promise<void> {
  const db = await getDb();
  const run = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
  };
  globalRef.__bwc_write_queue = (globalRef.__bwc_write_queue ?? Promise.resolve())
    .then(run)
    .catch((err) => {
      console.error('[bwc:db] persist failed', err);
    });
  return globalRef.__bwc_write_queue;
}

/**
 * Read-modify-write under a process-wide lock.
 *
 * Booking uses this to make "check the slot, then claim it" atomic within a
 * node process. In postgres the same guarantee comes from the unique index on
 * (practitioner_id, start_at) — see db/schema.sql.
 */
let mutation: Promise<unknown> = Promise.resolve();

export function transact<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const next = mutation.then(async () => {
    const db = await getDb();
    const result = await fn(db);
    await persist();
    return result;
  });
  // Keep the chain alive even if this transaction rejects.
  mutation = next.catch(() => undefined);
  return next;
}

/** Force a reseed. Used by scripts/seed.ts and the admin "reset demo data". */
export async function resetDatabase(): Promise<void> {
  const { buildSeedDatabase } = await import('./seed');
  const fresh = await buildSeedDatabase();
  globalRef.__bwc_db = fresh;
  await persist();
}
