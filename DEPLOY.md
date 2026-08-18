# Deploying Be Whole Care

Everything below assumes Vercel + Supabase. Nothing here needs to be done in
order except steps 1–4, which must come before the first deploy.

Roughly 45 minutes if you have the accounts already. The parts that need
someone else (gateway onboarding, the practice's Google sign-in, a verified
email domain) are called out so you can request them up front.

---

## What you need from the client before you start

| Thing | Where it comes from | Blocks |
|---|---|---|
| Peach Payments account (or Payfast) | peachpayments.com — FICA verification | Taking card / Apple Pay payments |
| Access to `bewholecare@gmail.com` | The practice | Calendar sync |
| A domain (e.g. `bewholecare.co.za`) | Their registrar | Custom URL, email sending |
| Resend account | You can create it | Sending email |

The app runs without any of them — payments fall back to a simulator, calendar
and email to a log. **Nothing is silently broken; it just doesn't leave the
building.** So you can deploy first and add credentials as they arrive.

---

## 1. Create the database

In Supabase: **New project**. Pick a region close to South Africa
(`eu-west-1` is usually the best available). Save the database password.

Then **SQL Editor → New query**, paste the whole of [`db/schema.sql`](db/schema.sql),
and run it. It is idempotent — safe to run again after a schema change.

You should see 22 tables under **Table Editor**.

### Get the connection string

**Project Settings → Database → Connection string → Transaction pooler**
(port `6543`). It looks like:

```
postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

Use the **transaction pooler**, not the direct connection. Serverless functions
open and abandon connections constantly; the direct connection will run out.
The app already sets `prepare: false`, which the transaction pooler requires.

---

## 2. Seed the catalogue and create the first admin

From your machine, with the project checked out:

```bash
npm install
DATABASE_URL='postgresql://...:6543/postgres' \
  node scripts/seed-postgres.mjs \
  --admin owner@bewholecare.co.za \
  --password 'pick-something-long'
```

That writes the six service categories, nine services, both practices, the
practitioner record, business hours, the settings row, and the wellness
resources — all of it the practice's real published information. It creates no
demo clients or fake bookings.

It is safe to re-run. Prices already changed in the admin dashboard are
**kept**, unless you pass `--reset-prices`.

> Give the client their password directly, not over email, and ask them to
> change it under **Settings → Password** on first sign-in.

---

## 3. Generate the secrets

```bash
# Session signing key — required in production, the app refuses to boot without it
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Cron secret — protects /api/cron/reminders
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## 4. Deploy to Vercel

Push the repo to GitHub, then **Add New → Project** in Vercel and import it.
Framework preset is detected automatically.

Set these under **Settings → Environment Variables** (Production + Preview):

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Transaction pooler string from step 1 | **Yes** |
| `SESSION_SECRET` | From step 3 | **Yes** |
| `NEXT_PUBLIC_APP_URL` | `https://bewholecare.co.za` | **Yes** |
| `CRON_SECRET` | From step 3 | **Yes** |
| `PAYMENT_PROVIDER` | `peach` (or `payfast`) | For payments |
| `PEACH_ENTITY_ID` / `PEACH_SECRET_TOKEN` | Peach dashboard → Checkout → API keys | For payments |
| `PEACH_WEBHOOK_SECRET` | Peach dashboard → webhooks | For payments |
| `PEACH_MODE` | `live` once tested | For payments |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | From step 7 | For calendar |
| `GOOGLE_CALENDAR_ID` | `bewholecare@gmail.com` | For calendar |
| `RESEND_API_KEY` | From step 8 | For email |
| `EMAIL_FROM` | `Be Whole Care <bookings@bewholecare.co.za>` | For email |
| `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` | Meta Cloud API | Optional |

Deploy. `vercel.json` registers the reminder cron once a day, at 05:00 UTC.

### Why the functions run in Dublin, not Cape Town

`vercel.json` pins `"regions": ["dub1"]`. That looks wrong for a South African
practice, and it is deliberate: **functions belong next to the database, not
next to the user.**

The Supabase project is in `eu-west-1` (Ireland). Every dynamic page makes
several queries, so a function in `cpt1` pays an intercontinental round trip
*per query*. That was tried first, and the admin dashboard — which runs three
queries in parallel and then hydrates them — exceeded the 10-second function
limit and returned `504: GATEWAY_TIMEOUT`.

The user-facing cost of Dublin is one round trip on the initial request. Static
assets and cached pages are still served from the CDN edge nearest the visitor,
so the marketing site is unaffected.

If the database ever moves region, move this with it. Keep the two together.

Note that `vercel.json` is schema-validated and rejects unknown keys — you
cannot leave a comment in it, which is why this explanation lives here.

### The reminder schedule is a plan limit, not a design choice

**Vercel's Hobby plan allows a cron job to run at most once per day**, and a
deploy carrying a more frequent schedule is rejected outright at build time —
"Hobby accounts are limited to daily cron jobs."

Once a day is fine for follow-up payment requests. It is **not** enough for the
2-hour appointment reminder, which needs a worker running every few minutes to
be meaningful — on a daily schedule a client booked for 15:00 gets their
"starting in 2 hours" message at 05:00, which is worse than not sending it.

Two ways to get the real cadence back:

1. **Upgrade to Vercel Pro**, then restore `*/10 * * * *` in `vercel.json`.
2. **Point an external scheduler at the same endpoint** — free, and the route
   was written for this. On [cron-job.org](https://cron-job.org) (or GitHub
   Actions, or Supabase's `pg_cron`), create a job every 10 minutes:

   ```
   GET https://<your-domain>/api/cron/reminders
   Header:  x-cron-secret: <your CRON_SECRET>
   ```

   The endpoint is idempotent and authorises on that header in constant time,
   so it is safe to call often and useless to anyone without the secret.

Until one of those is in place, tell the client that same-day reminders are not
yet live. Do not let them discover it from a client who missed a session.

**Important:** `NEXT_PUBLIC_APP_URL` must be the real public URL. Payment
redirects and the links inside reminder emails are built from it — if it is
wrong, clients get sent to the wrong place after paying.

---

## 5. First smoke test

1. Open the site. The homepage should show six services and six resources — if
   they're missing, the seed in step 2 didn't run against this database.
2. Sign in at `/sign-in` with the admin account. `/admin` should load.
3. Book a session as a client (use a private window). With no gateway keys
   yet, you'll get the payment simulator — approve it and check the booking
   turns **Confirmed** in `/admin/appointments`.
4. Check **Admin → Notifications**: channels without credentials show
   *"Logged only"*, and the message log shows exactly what would have been sent.

---

## 6. Payments

Full detail — including the sandbox checklist you must work through before
taking real money — is in [PAYMENTS.md](PAYMENTS.md). The short version:

1. Open a **Peach Payments** account and complete FICA verification. During
   that process you register the FNB account that Peach will pay out to.
   **That is the only place the bank account is configured** — it is not in this
   codebase and must never be.
2. From the Peach dashboard → **Checkout → API keys**, copy the entity ID and
   secret token into Vercel.
3. Add a webhook pointing at:
   ```
   https://bewholecare.co.za/api/payments/webhook
   ```
   Copy its signing secret into `PEACH_WEBHOOK_SECRET`.
4. Set `PAYMENT_PROVIDER=peach` and `PEACH_MODE=sandbox`, redeploy, and run the
   sandbox checklist in PAYMENTS.md.
5. Switch `PEACH_MODE=live`, take one real payment for a small amount, and
   refund it.

Peach was chosen because Apple Pay and Google Pay both require an FNB, Nedbank
or Standard Bank merchant account — and the practice banks with FNB. One
integration then covers Apple Pay, Google Pay, Visa, Mastercard, Amex, PayShap
and Scan to Pay.

Payfast is implemented as a cheaper alternative (no monthly fee) — set
`PAYMENT_PROVIDER=payfast` with `PAYFAST_MERCHANT_ID` / `PAYFAST_MERCHANT_KEY` /
`PAYFAST_PASSPHRASE` instead.

Neither gateway integration has been run against a sandbox yet, because no
credentials existed while building. **Do not skip the checklist.**

## 7. Google Calendar

Bookings need to land on `bewholecare@gmail.com`, so the OAuth consent has to be
granted **while signed in as that account**.

1. Google Cloud Console → new project → **APIs & Services**.
2. Enable **Google Calendar API**.
3. **OAuth consent screen** → External → add `bewholecare@gmail.com` as a test
   user (or publish the app).
4. **Credentials → Create OAuth client ID → Web application**. Add
   `https://developers.google.com/oauthplayground` as a redirect URI.
5. Copy the client ID and secret into Vercel.
6. Go to [OAuth Playground](https://developers.google.com/oauthplayground):
   - Settings (gear) → tick **Use your own OAuth credentials**, paste ID/secret.
   - Select scope `https://www.googleapis.com/auth/calendar.events`.
   - Authorise **as bewholecare@gmail.com**.
   - Exchange the code and copy the **refresh token** into
     `GOOGLE_REFRESH_TOKEN`.

Redeploy, then confirm a test booking and check the practice calendar.

Events use an id derived from the appointment, so a retried sync updates the
existing event instead of creating a duplicate. If Google is down, the booking
still succeeds and the appointment shows a **Retry calendar sync** action in the
admin menu.

---

## 8. Email

1. Create a Resend account, add the domain, and set the DNS records it gives you.
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on the verified domain.

Until the domain is verified, mail will not send — it will be recorded in
**Admin → Notifications** as failed, with the reason.

---

## 9. Domain

Vercel → **Settings → Domains** → add `bewholecare.co.za`, follow the DNS
instructions. Then update `NEXT_PUBLIC_APP_URL` and redeploy.

---

## How the moving parts fit together

```
Client books
   └─ availability re-checked server-side
   └─ slot claimed  ← Postgres exclusion constraint decides, not app code
   └─ payment created → gateway hosted checkout (we never see a card)
        └─ webhook → signature verified → status re-read from the gateway
             └─ appointment CONFIRMED
                  ├─ Google Calendar event created on bewholecare@gmail.com
                  ├─ confirmation sent to client
                  └─ reminders queued: 24h before, 2h before, follow-up after
                       └─ /api/cron/reminders (every 10 min) sends them
```

---

## Things worth knowing

**Double booking is impossible.** Not "unlikely" — the database has an
exclusion constraint, so two people paying for the same slot at the same
instant ends with one of them getting "that time has just been taken". This was
tested directly against Postgres.

**Card details never reach this application.** Payment happens on the gateway's
hosted page. We store an amount, a status and a reference.

**The bank account is not in this repository.** Settlement is configured in the
gateway dashboard. The practice's banking details for receipts are entered in
Admin → Settings.

**The browser never talks to the database.** The Next.js server is the only
client. Every table has row-level security enabled with no permissive policies,
so even a leaked Supabase anon key returns nothing.

**Payment status is never taken from the browser.** Returning from checkout
triggers a server-to-server verification; the redirect itself proves nothing.

**Prices are not hardcoded.** They ship as the published rates and are edited in
**Admin → Services**. Same for hours, cancellation window, reminder timing and
the medical aid co-payment.

**The build needs internet access to Google Fonts.** Vercel has it. If you build
somewhere air-gapped, the fonts fall back silently — the layout still works.

---

## Local development

No database needed:

```bash
npm install
npm run dev            # http://localhost:5600
```

With no `DATABASE_URL`, the app uses a JSON file store in `.data/` seeded with
demo clients and appointments so the dashboards have something to show. Demo
sign-in: `admin@bewholecare.co.za` / `Wholeness2026!`.

To develop against Postgres instead, put `DATABASE_URL` in `.env.local` — the
app switches automatically, and `lib/db/index.ts` type-checks the two
implementations against each other so they cannot drift.

```bash
npm run typecheck
npm run build
```

> Do not run `npm run build` while `npm run dev` is running. They share
> `.next/` and the build will corrupt the dev server's module graph.
