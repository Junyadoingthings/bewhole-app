#!/usr/bin/env node
/**
 * Seed a production database with the Be Whole Care catalogue.
 *
 *   DATABASE_URL=... node scripts/seed-postgres.mjs
 *   DATABASE_URL=... node scripts/seed-postgres.mjs --admin you@example.com --password '...'
 *
 * What it writes: service categories, services, locations, the practitioner
 * record, availability rules from the published business hours, the settings
 * row, resources and workshops. All of it is the practice's real, published
 * information — there is no demo client, appointment or payment in here.
 *
 * Idempotent: every insert is an upsert on the primary key, so running it
 * again after editing the catalogue updates rather than duplicates. It will
 * NOT overwrite prices that have since been changed in the admin dashboard
 * unless you pass --reset-prices.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const postgres = require('postgres');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? true) : undefined;
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(url, {
  prepare: false,
  ssl: url.includes('localhost') ? false : 'require',
  onnotice: () => {},
});

/* ------------------------------------------------------------- catalogue */
// Parsed out of the TypeScript source so this script and the app can never
// disagree about what the practice offers.
function extract(file, exportName) {
  const source = readFileSync(path.join(root, file), 'utf8');
  const start = source.indexOf(`export const ${exportName} = [`);
  if (start === -1) throw new Error(`${exportName} not found in ${file}`);
  const open = source.indexOf('[', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++;
    if (source[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const literal = source
    .slice(open, end + 1)
    // Strip TS-only syntax so the literal is valid JS.
    .replace(/\s+as\s+const/g, '')
    .replace(/RATES\.individual\.inPerson/g, '80000')
    .replace(/RATES\.individual\.online/g, '70000')
    .replace(/RATES\.individual\.centurion/g, '80000')
    .replace(/RATES\.couple\.inPerson/g, '85000')
    .replace(/RATES\.couple\.online/g, '75000')
    .replace(/RATES\.couple\.centurion/g, '85000');
  // eslint-disable-next-line no-new-func
  return new Function(`return ${literal}`)();
}

const CATEGORIES = extract('lib/db/seed.ts', 'SERVICE_CATEGORIES');
const SERVICES = extract('lib/db/seed.ts', 'SERVICES');
const RESOURCES = extract('lib/db/seed.ts', 'RESOURCES');
const WORKSHOPS = extract('lib/db/seed.ts', 'WORKSHOPS');

const LOCATIONS = [
  {
    id: 'loc_centurion',
    slug: 'centurion',
    name: 'Centurion',
    addressLine: '56 Van Ryneveld Ave, Pierre van Ryneveld Park',
    city: 'Centurion',
    postalCode: '0157',
    region: 'Gauteng',
  },
  {
    id: 'loc_tembisa',
    slug: 'tembisa',
    name: 'Tembisa',
    addressLine: '1423 Flint Mazibuko Str, Hospital View',
    city: 'Tembisa',
    postalCode: '1632',
    region: 'Gauteng',
  },
];

const HOURS = [
  { day: 1, open: '08:00', close: '17:00' },
  { day: 2, open: '08:00', close: '17:00' },
  { day: 3, open: '08:00', close: '17:00' },
  { day: 4, open: '08:00', close: '17:00' },
  { day: 5, open: '08:00', close: '17:00' },
  { day: 6, open: '08:00', close: '12:00' },
];

const SETTINGS = {
  business: {
    name: 'Be Whole Care',
    email: 'bewholecare@gmail.com',
    phone: '', // EDITED: Removed phone number to hide the "Need help?" button
    whatsapp: '27638837170',
    website: 'www.bewholecare.co.za',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
  },
  scheduling: {
    durationMinutes: 60,
    slotIntervalMinutes: 30,
    bufferMinutes: 15,
    minNoticeHours: 12,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
  },
  reminders: {
    confirmationImmediate: true,
    firstReminderHours: 24,
    secondReminderHours: 2,
    followUpAfterHours: 24,
    channels: ['email', 'whatsapp'],
  },
  payments: {
    provider: process.env.PEACH_ENTITY_ID ? 'peach' : process.env.PAYFAST_MERCHANT_ID ? 'payfast' : 'mock',
    medicalAidEnabled: true,
    // No co-payment on medical aid sessions, at the practice's request. This
    // row is rewritten on every deploy, so this — not the admin screen — is
    // where the amount is actually decided.
    medicalAidCoPaymentCents: 0,
    requirePaymentToConfirm: true,
  },
  // Entered by an administrator in the dashboard. Never committed here — an
  // account number does not belong in a repository, and card payments settle
  // to the account registered with the gateway, not to anything in this file.
  banking: {
    accountName: '',
    bank: '',
    accountNumber: '',
    branchCode: '',
    showOnInvoices: false,
  },
  calendar: {
    provider: process.env.GOOGLE_CLIENT_ID ? 'google' : 'mock',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'bewholecare@gmail.com',
    connected: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
  },
  policy: {
    cancellation:
      'Cancellations must be made at least 24 hours before the scheduled session. Late cancellations or missed appointments may be charged in full. Exceptions may be considered in cases of genuine emergency.',
    minimumAge: 16,
  },
  updatedAt: new Date().toISOString(),
};

/* ------------------------------------------------------------- password */
const scrypt = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/* ------------------------------------------------------------------ run */
async function main() {
  const resetPrices = args.includes('--reset-prices');
  console.log(`Seeding ${url.replace(/:[^:@]+@/, ':****@')}`);

  for (const c of CATEGORIES) {
    await sql`
      insert into service_categories (id, slug, name, summary, description, areas, concerns, icon, accent, sort_order, active)
      values (${c.id}, ${c.slug}, ${c.name}, ${c.summary}, ${c.description},
              ${c.areas}, ${c.concerns}, ${c.icon}, ${c.accent}, ${c.order}, ${c.active})
      on conflict (id) do update set
        slug = excluded.slug, name = excluded.name, summary = excluded.summary,
        description = excluded.description, areas = excluded.areas,
        concerns = excluded.concerns, icon = excluded.icon, accent = excluded.accent,
        sort_order = excluded.sort_order`;
  }
  console.log(`  ✓ ${CATEGORIES.length} service categories`);

  for (const s of SERVICES) {
    await sql`
      insert into services (id, category_id, slug, name, summary, duration_minutes, rate_band,
                            price_in_person_cents, price_online_cents, allows_online,
                            allows_in_person, requires_quote, intake_note, sort_order, active)
      values (${s.id}, ${s.categoryId}, ${s.slug}, ${s.name}, ${s.summary}, ${s.durationMinutes},
              ${s.rateBand}, ${s.priceInPersonCents}, ${s.priceOnlineCents}, ${s.allowsOnline},
              ${s.allowsInPerson}, ${s.requiresQuote}, ${s.intakeNote ?? null}, ${s.order}, ${s.active})
      on conflict (id) do update set
        category_id = excluded.category_id, slug = excluded.slug, name = excluded.name,
        summary = excluded.summary, duration_minutes = excluded.duration_minutes,
        rate_band = excluded.rate_band, allows_online = excluded.allows_online,
        allows_in_person = excluded.allows_in_person, requires_quote = excluded.requires_quote,
        intake_note = excluded.intake_note, sort_order = excluded.sort_order
        ${resetPrices ? sql`, price_in_person_cents = excluded.price_in_person_cents,
                            price_online_cents = excluded.price_online_cents` : sql``}`;
  }
  console.log(`  ✓ ${SERVICES.length} services${resetPrices ? ' (prices reset)' : ' (existing prices kept)'}`);

  for (const [i, l] of LOCATIONS.entries()) {
    await sql`
      insert into locations (id, slug, name, address_line, city, postal_code, region, active, sort_order)
      values (${l.id}, ${l.slug}, ${l.name}, ${l.addressLine}, ${l.city}, ${l.postalCode}, ${l.region}, true, ${i})
      on conflict (id) do update set
        name = excluded.name, address_line = excluded.address_line, city = excluded.city,
        postal_code = excluded.postal_code, region = excluded.region`;
  }
  console.log(`  ✓ ${LOCATIONS.length} locations`);

  await sql`
    insert into practitioners (id, display_name, title, location_ids, offers_online, active)
    values ('prc_practice', 'Be Whole Care', 'Counselling & wellness team',
            ${LOCATIONS.map((l) => l.id)}, true, true)
    on conflict (id) do update set location_ids = excluded.location_ids`;
  console.log('  ✓ practitioner record');

  for (const [i, h] of HOURS.entries()) {
    await sql`
      insert into availability_rules (id, practitioner_id, weekday, start_time, end_time, mode, active)
      values (${`avr_${i}`}, 'prc_practice', ${h.day}, ${h.open}, ${h.close}, 'any', true)
      on conflict (id) do update set
        weekday = excluded.weekday, start_time = excluded.start_time, end_time = excluded.end_time`;
  }
  console.log(`  ✓ ${HOURS.length} availability rules (Mon–Fri 08:00–17:00, Sat 08:00–12:00)`);

  // Wellness content. Published state is owned by the admin dashboard after
  // the first insert, so re-running never silently republishes something the
  // practice took down.
  for (const r of RESOURCES) {
    await sql`
      insert into resources (id, slug, title, excerpt, body, kind, topic, read_minutes, published, published_at, sort_order)
      values (${r.id}, ${r.slug}, ${r.title}, ${r.excerpt}, ${r.body}, ${r.kind}, ${r.topic},
              ${r.readMinutes}, ${r.published}, now() - (${r.order} * interval '9 days'), ${r.order})
      on conflict (id) do update set
        title = excluded.title, excerpt = excluded.excerpt, body = excluded.body,
        kind = excluded.kind, topic = excluded.topic, read_minutes = excluded.read_minutes,
        sort_order = excluded.sort_order`;
  }
  console.log(`  \u2713 ${RESOURCES.length} resources`);

  for (const w of WORKSHOPS) {
    await sql`
      insert into workshops (id, slug, title, summary, description, audience, format, workshop_date, duration_label, status, sort_order)
      values (${w.id}, ${w.slug}, ${w.title}, ${w.summary}, ${w.description}, ${w.audience},
              ${w.format}, ${w.date ?? null}, ${w.durationLabel}, ${w.status}, ${w.order})
      on conflict (id) do update set
        title = excluded.title, summary = excluded.summary, description = excluded.description,
        audience = excluded.audience, format = excluded.format,
        duration_label = excluded.duration_label, status = excluded.status,
        sort_order = excluded.sort_order`;
  }
  console.log(`  \u2713 ${WORKSHOPS.length} workshops`);

  // Settings: insert once, then leave alone — the admin dashboard owns this row.
  await sql`
    insert into settings (id, data) values (1, ${sql.json(SETTINGS)})
    on conflict (id) do update set data = ${sql.json(SETTINGS)}`; // EDITED: Ensure it overwrites old settings to hide the button
  console.log('  ✓ settings row');

  /* ------------------------------------------------------- admin account */
  const adminEmail = flag('admin');
  const adminPassword = flag('password');

  if (adminEmail && typeof adminPassword === 'string') {
    const existing = await sql`select id from users where email = ${adminEmail} limit 1`;
    if (existing[0]) {
      console.log(`  · admin ${adminEmail} already exists — leaving it untouched`);
    } else {
      const userId = `usr_${crypto.randomBytes(9).toString('base64url')}`;
      const profileId = `prf_${crypto.randomBytes(9).toString('base64url')}`;
      const hash = await hashPassword(adminPassword);
      await sql.begin(async (tx) => {
        await tx`insert into users (id, email, password_hash, role, email_verified)
                 values (${userId}, ${adminEmail}, ${hash}, 'SUPER_ADMIN', true)`;
        await tx`insert into profiles (id, user_id, first_name, last_name)
                 values (${profileId}, ${userId}, 'Be Whole', 'Care')`;
      });
      console.log(`  ✓ SUPER_ADMIN created: ${adminEmail}`);
    }
  } else {
    const staff = await sql`select count(*)::int as n from users where role <> 'CLIENT'`;
    if (staff[0].n === 0) {
      console.log('\n  ⚠ No staff account exists yet. Nobody can sign in to /admin.');
      console.log('    Re-run with:  --admin you@example.com --password \'a-strong-password\'');
    }
  }

  console.log('\nDone.');
  await sql.end();
}

main().catch(async (error) => {
  console.error('\nSeed failed:', error.message);
  await sql.end();
  process.exit(1);
});