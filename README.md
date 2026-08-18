# Be Whole Care — client booking & wellness platform

> A renewed mind, a prospering soul.

A booking, payment and practice-management platform for [Be Whole Care](https://imaginative-brown-jellyfish.bewholecare.co.za/en/), a counselling and wellness practice in Centurion and Tembisa.

Everything the client sees about the business — services, sub-areas, session length, rates, locations, hours, cancellation and medical-aid policy — is transcribed from the live site. Nothing about the practice is invented. Anything the practice might reasonably want to change is configurable from the admin dashboard rather than hardcoded.

```bash
npm install
npm run dev          # http://localhost:5600
```

It runs with **no environment variables at all**: payments, calendar, and email fall back to mock providers so the entire booking journey works end to end out of the box.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Super admin | `admin@bewholecare.co.za` | `Wholeness2026!` |
| Staff | `staff@bewholecare.co.za` | `Wholeness2026!` |
| Client | `thandiwe.demo@example.com` | `Wholeness2026!` |

Demo clients, appointments, payments and follow-ups are all flagged `isDemo` and labelled as such in the interface. There are no fabricated testimonials and no invented practitioners.

---

## Architecture

```
app/
  (marketing)/        public site — home, services, about, resources, workshops, contact, legal
  (auth)/             sign-in, login redirect, register, forgot-password
  book/               full-screen booking wizard + confirmation
  portal/             client portal (session-gated)
  admin/              practice console (staff-gated)
  pay/[checkoutId]/   mock hosted checkout, stands in for the gateway in development
  pay/redirect/       Payfast hand-off (signed form, posted server-side)
  api/                availability, payment webhook, assistant, cron
  actions/            server actions — the only write paths in the app
components/           ui primitives, motion primitives, feature components
services/             business logic — booking, availability, payments, calendar,
                      notifications, follow-ups, analytics, event bus
lib/                  db repository, auth, validation, rate limiting, date/money helpers
config/business.ts    practice facts transcribed from the live site (defaults only)
db/schema.sql         production PostgreSQL schema + RLS policies
```

**The rule that shapes everything:** UI never talks to a provider or a table directly. It calls a service; the service calls the repository (`lib/db`) or a provider interface. Swapping the datastore or the payment provider is a one-module change.

### Data layer

Development runs against a JSON-file store (`.data/db.json`) behind the repository interface in `lib/db/index.ts`. `db/schema.sql` is the production target: full PostgreSQL schema with foreign keys, indexes, enums, an audit log, and row-level security on every table holding client data.

Double booking is impossible in both:

- **Dev** — the slot check and insert happen inside one process-wide transaction.
- **Postgres** — a `btree_gist` exclusion constraint on `(practitioner_id, tstzrange(start_at, end_at))` for live statuses.

### Booking flow

```
choose support → service → online/in person → practice → date → time → details → payment → confirmed
```

Availability is derived server-side from business hours, per-practitioner rules, blocked dates, existing bookings, session length, buffer, minimum notice and booking horizon. The wizard renders what the API returns, and the booking action **re-derives it again at write time** — a stale tab can never take a slot that has gone.

### Payments

`PaymentProvider` has three implementations: Peach Payments (Apple Pay, Google Pay, cards, PayShap), Payfast (cards, Instant EFT, SnapScan) and a development mock. `PAYMENT_PROVIDER` selects one, or whichever has credentials wins. See PAYMENTS.md — the settlement bank account lives in the gateway dashboard, never in this repo.

- Card details never enter this application. The client is redirected to the provider's hosted checkout.
- A booking is marked paid **only** by `verifyCheckout()` — a server-to-server read. A browser redirect is treated as a hint to re-verify, never as proof.
- Webhooks are signature-verified over the raw body with a replay window, and still trigger a fresh status read rather than trusting the payload.
- The mock provider is a real redirect to a real page with a real outcome, so development exercises the identical code path.

### Google Calendar

`CalendarProvider` → `GoogleCalendarProvider` (OAuth refresh token, server-side only) or `MockCalendarProvider`. Confirmed bookings sync to `bewholecare@gmail.com`.

Event ids are a deterministic hash of the appointment id and written with `PUT`, so a retry or reschedule **updates** the same event instead of creating a duplicate. Cancelling removes it. A calendar outage never fails a confirmed booking — it is recorded and retryable from the appointment's action menu.

### Automation

`services/events.ts` is a small event bus. Business flows emit domain events; handlers turn them into calendar syncs, client messages, staff notifications and scheduled reminders:

```
appointment.created · appointment.confirmed · appointment.rescheduled · appointment.cancelled
appointment.completed · payment.success · payment.failed
followup.created · followup.payment_required · followup.payment_received · followup.confirmed
```

Adding a side effect means adding a handler, not editing the booking code.

### Follow-ups

The workflow the practice asked for, end to end:

```
staff records a follow-up → reminder scheduled → payment request sent on the reminder date
→ client pays → payment verified server-side → follow-up confirmed
→ appointment created → calendar updated → confirmation sent
```

The board buckets them into overdue / due today / awaiting payment / upcoming / closed.

### Notifications

One `notify()` call describes a message and its channels; adapters decide delivery (Resend, WhatsApp Cloud API, SMS, push, in-app). Without credentials every message is written to `notification_logs` and surfaced in **Admin → Notifications**, so the automation is fully observable in development.

---

## Security & POPIA

- Identity is always resolved server-side from a signed, http-only session cookie. A user id from the client is never trusted anywhere.
- Roles `CLIENT · STAFF · ADMIN · SUPER_ADMIN`, checked on the server for every action — not merely hidden in the UI. A client can only ever read rows whose `clientUserId` is their own.
- Passwords hashed with scrypt. Changing one invalidates every other session.
- Rate limiting on login, registration, booking, contact and the assistant.
- Every write validated with zod, server-side, before it reaches a service.
- Append-only audit log for administrative actions on client records.
- Data minimisation: medical aid details are only collected if the client chooses that method; consent IP addresses are stored as a salted hash.
- `/portal` and `/admin` are `no-store` and `noindex`. The service worker never caches them.
- Secrets are server-only. Nothing sensitive is prefixed `NEXT_PUBLIC_`.

## Wellness safety

The app is explicit that it is not an emergency service. Crisis routing (112, SADAG 0800 456 789) appears in the footer of every page, on the contact page, and in the offline screen. The AI assistant identifies itself as AI on every open, refuses diagnosis and medication questions outright, and short-circuits anything resembling distress to real crisis services before answering anything else.

## Deployment

Vercel + Supabase.

1. Apply `db/schema.sql` to a Supabase project.
2. Reimplement `lib/db/index.ts` against `@supabase/supabase-js` (server client with the service role for webhooks, anon client under RLS elsewhere). No caller above that module changes.
3. Set the variables in `.env.example`.
4. Point a scheduler at `/api/cron/reminders` with the `x-cron-secret` header.

## Commands

```bash
npm run dev        # dev server on :5600
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint
npm run reseed     # clear the local datastore; it reseeds on the next request
```
