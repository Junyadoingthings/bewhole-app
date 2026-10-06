# Security

Be Whole Care handles counselling clients' personal information, so security and privacy (POPIA)
are part of every change, not an afterthought. This page explains how the platform protects data
and the rules for keeping it that way.

## Reporting a problem

If you find a security issue, **do not open a public GitHub issue**. Contact the practice
privately at bewholecare@gmail.com, or the repository owner directly, with what you found and how
to reproduce it.

## Rules for anyone working on this repository

1. **Never commit a secret.** No passwords, API keys, tokens, database URLs or bank details — not
   in code, not in docs, not in commit messages. Real values live only in Vercel's environment
   settings and your own git-ignored `.env.local`. [`.env.example`](.env.example) lists names
   only.
2. **Never commit client data.** No exports, screenshots of client records or local databases
   (`.data/` is git-ignored). Use the local demo data for screenshots.
3. **No temporary or unauthenticated "fix" endpoints.** Database changes go in
   [`db/schema.sql`](db/schema.sql) and, for production, in
   [`scripts/seed-postgres.mjs`](scripts/seed-postgres.mjs) (idempotent, runs on every deploy).
   Diagnostic routes must not return client information and must be removed once they have done
   their job.
4. **Every new table gets row-level security** — add it to the list in `db/schema.sql` and enable
   it in the deploy seed.
5. **Every new server action checks the role** on the server (`requireStaff` / `requireAdmin` /
   the signed-in user) and validates its input with zod.
6. **Secrets never go to the browser.** Nothing sensitive is prefixed `NEXT_PUBLIC_`.

## How the platform is protected

### Accounts and sessions

- Sessions are random tokens in a signed, http-only, secure cookie; identity is always resolved on
  the server. A user id sent by the browser is never trusted.
- Roles: `CLIENT · STAFF · ADMIN · SUPER_ADMIN`, enforced on the server for every page and action.
  A client can only read their own records. Console **Settings** is administrator-only.
- Passwords are hashed with scrypt and must be at least 10 characters with upper and lower case
  and a number. Changing a password signs out every other device; a change to the console
  password also emails the administrator a notice.
- **Console password reset** sends a 6-digit code to the administrator's own email. Only a hash of
  the code is stored; it expires after 10 minutes, works once, allows 5 wrong attempts, and at most
  3 codes can be sent per 15 minutes (counted in the database). The code is never written to the
  email log or the subject line.
- The same code also resets the console password from the public sign-in page. That page gives the
  same answer for every address, and the same error for a wrong code, an expired code or an
  account that is not the console's (checked in the same time), so it cannot be used to find the
  console's email address or to test codes.
- Login, registration, booking, contact and password actions are rate-limited.

### Data

- The browser never talks to the database. The Next.js server is the only database client.
- Every table has row-level security **enabled and forced with no policies**, so Supabase's public
  API can read and write nothing, even with the anon key.
- The production database is in the EU (Ireland), next to the app's server functions.
- Data minimisation: medical aid details are collected only when the client chooses medical aid;
  consent IP addresses are stored as a salted hash.
- Clients' SA ID or passport numbers (required at booking) are kept on the client record behind
  row-level security, shown only in the console and on the staff-only consent form, and never
  sent by email.
- The practices' street addresses are not published on the website; a client receives the
  address only once their booking is confirmed.
- An append-only audit log records administrative actions on client records — including
  medical aid decisions, payments ticked off and every view of a printable consent record.

### Payments

- Card details never reach this application; clients pay on the gateway's hosted checkout.
- A card payment is marked paid only by a server-to-server check with the gateway. Webhooks are
  signature-verified and still trigger a fresh status check.
- The practice's settlement bank account is configured in the gateway's dashboard, never in this
  repository.

### Pages and caching

- `/portal`, `/admin` and the sign-in pages are sent `no-store` and `noindex`; the service worker
  never caches them.
- The printable consent page (`/print/consent/…`) is staff-only and not indexed.
- `robots.txt` keeps search engines out of `/admin`, `/portal`, `/print`, `/api` and `/pay`
  (a courtesy — access control is on the server).

### Calendar subscription

- `/api/calendar/feed/<token>.ics` serves the practice's sessions to Outlook, Apple or Google
  Calendar, which cannot sign in, so the link itself is the key: a 256-bit HMAC (with
  `SESSION_SECRET`) of a version number kept in the database. Any other token gets a plain 404.
- Only an administrator sees the link (console Calendar) or can reset it; resetting raises the
  version and every old copy stops working. Resets are audited.
- Events carry only what a diary needs — service, client name, reference and where. Never email,
  phone, medical aid or notes. Responses are `no-store` and `noindex`.

## Security changes in October 2026

- Removed `/api/fixdb`: a public, unauthenticated route that ran schema changes against the
  production database on every visit, leaked database errors and opened a connection each time.
- Removed `/api/health/admin`: a temporary, unauthenticated diagnostic that ran the dashboard's
  queries and returned counts and error traces. (`/api/health/db` remains: it reports only whether
  the database answered and how quickly.)
- Removed the leftover `fix-db.js` script.
- Enabled row-level security on the `counters` and `password_reset_codes` tables.
- Added `.env.example` (names only) and allowed it past `.gitignore`.
- Replaced the unauthenticated demo `/api/calendar/feed` with the private subscription above, and
  removed a stray `services/events.ts.save` file.
