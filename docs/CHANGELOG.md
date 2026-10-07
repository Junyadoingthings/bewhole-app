# Changelog

What changed, newest first. Each entry links to the pull request on GitHub.

## October 2026

### 7 October — wording removed at the practice's request
- **Contact:** the heading and "Someone replies during business hours…" removed (now "Call,
  WhatsApp, email or send a message below."), as well as the photo caption, the "What is this
  about?" label, the message hint and placeholder, and the consent line's small print.
- **About:** the "Counselling you can actually get to." heading removed; "Confidential" now reads
  "Handled ethically."
- **Services:** the "How an appointment works" introduction and the description under each of the
  four steps removed — the step titles remain.

### 6 October — practice addresses kept private
- The website no longer shows the practices' street addresses or the map: they appear as
  **Centurion Practice** and **Tembisa Practice**, with a note that the address is shared once a
  booking is confirmed. The booking confirmation page and the client portal show the address only
  for a confirmed booking (as the emails already did).
- **"What brings you here?"** is now required on the booking form.
- **ID number on the details step**, with a **Passport** option for clients without an SA ID. SA
  ID numbers are checked (13 digits, real date of birth, check digit). Saved on the client record;
  shown in **Clients** and on the consent form; never emailed.
- Follow-up payment requests and reminders no longer contain the street address — it is sent
  only after payment.

### 6 October — launch fixes
- **Bookable hours match the website:** Monday–Friday 09:00–17:00 and Saturday 09:00–13:00.
  The deploy now takes the hours from `config/business.ts`, so they cannot drift apart again.
- **Add to my calendar:** a private subscription link puts sessions and blocked time in
  Outlook, Apple or Google Calendar, with a reset button. It replaces the broken
  "Sync Outlook" buttons.
- **Signed-out password reset** for the console administrator from the sign-in page, using the
  emailed 6-digit code.
- Domain move checklist in [DEPLOY.md](../DEPLOY.md#9-domain).
- **Live on www.bewholecare.co.za**; `bewholecare.co.za` redirects to it. The old website on the
  Register Domain cPanel server is no longer shown.

### 5 October — pre-launch diagnostic
- **Medical aid holds block their time** ([#18](https://github.com/Junyadoingthings/bewhole-app/pull/18))
  — a booking awaiting medical aid verification could previously be double-booked.
- Reminders can no longer be left queued, or sent, for a cancelled or past session.
- `robots.txt` and `sitemap.xml`.

### 5 October — documentation and security clean-up
- Rewrote the README; added this changelog, a [practice guide](PRACTICE-GUIDE.md), an
  [emails reference](EMAILS.md), [SECURITY.md](../SECURITY.md) and `.env.example` (names only).
- **Security:** removed the public `/api/fixdb` route (ran schema changes on the live database on
  every visit) and the temporary `/api/health/admin` diagnostic; removed `fix-db.js`; enabled
  row-level security on the `counters` and `password_reset_codes` tables.

### 2 October
- **Payments ledger** ([#16](https://github.com/Junyadoingthings/bewhole-app/pull/16)) — every
  amount owed or received has a line on Payments: medical aid claims (ticked off with the amount
  the scheme paid), declined medical aid paid through Yoco, card sessions without an online
  checkout and money taken directly (**Record a payment**). Mark received / Not paid / Undo.
  Clients see claims as their scheme's, never as money they owe.
- **Formal reminders and required fields**
  ([#15](https://github.com/Junyadoingthings/bewhole-app/pull/15)) — reminders now read
  "Reminder: Counselling Session" in the practice's wording; each extra attendee's email and
  mobile and the main member's ID number are required; "What happens next" removed from the
  confirmation page; Resources and workshops removed from the client portal.
- **Printable consent record**
  ([#14](https://github.com/Junyadoingthings/bewhole-app/pull/14)) — an A4 consent form for any
  booking, from Appointments or the client's page, with every point agreed, when it was agreed,
  everyone attending and signature lines.
- **Group sessions and required details**
  ([#13](https://github.com/Junyadoingthings/bewhole-app/pull/13)) — couples, family and
  pre-marital sessions take 2–6 people, each consenting; address and medical aid date of birth are
  required; date fields fixed on iPhone; "Provisional Confirmation" on the confirmation page; the
  Paid badge removed; Resources and Workshops removed from the site menu.

### 1 October
- **Remove "Need help?"** ([#12](https://github.com/Junyadoingthings/bewhole-app/pull/12)) from
  the booking page header.
- **Console password** ([#11](https://github.com/Junyadoingthings/bewhole-app/pull/11)) —
  "Forgot your current password?" with an emailed 6-digit code; stronger password rules; other
  devices signed out on change; Settings administrator-only.
- **No post-session emails** ([#10](https://github.com/Junyadoingthings/bewhole-app/pull/10)).
- **Invoice numbers, unstuck buttons, popup typing**
  ([#9](https://github.com/Junyadoingthings/bewhole-app/pull/9)) — references are now gapless
  `BWC0001`, `BWC0002`, …; Accept/Decline and other console actions no longer hang (emails and
  calendar sync run after the response); typing in popups no longer loses focus.
- **Launch reset** — all test clients, bookings and payments were cleared from the live database
  before launch (blocked days kept).

## September 2026

### 30 September
- **Console clean-up** ([#8](https://github.com/Junyadoingthings/bewhole-app/pull/8)) — removed
  Services, Resources, Staff and Notifications; Settings holds only the password.
- **Provisional Confirmation** ([#7](https://github.com/Junyadoingthings/bewhole-app/pull/7))
  wording for medical aid bookings.
- **Content removed at the practice's request**
  ([#6](https://github.com/Junyadoingthings/bewhole-app/pull/6)) — card descriptions on Services,
  some Additional Services items, Resources in the bottom menu, booking-step extras.
- **Ntombi's email templates** ([#5](https://github.com/Junyadoingthings/bewhole-app/pull/5)) —
  confirmation, medical aid verified and declined emails in the practice's words; session link
  and practice addresses sent only once confirmed; each booking step opens at the top on phones.

### 29 September
- **Formal client emails and fixes** ([#4](https://github.com/Junyadoingthings/bewhole-app/pull/4))
  — formal wording, emails no longer shrink on phones, reminder fixes, practice phone number
  restored.

### 25 September
- **Booking reliability** ([#1](https://github.com/Junyadoingthings/bewhole-app/pull/1)) — fixed
  the endless "Please wait" on booking, details validated before payment with fields highlighted
  as soon as they're left, emails redesigned with the logo and kept light on dark-mode phones,
  the R100 medical aid co-payment removed, delivery improved so emails stop landing in spam.

### Earlier in September
- Medical aid verification with accept/decline, re-pricing and client emails; Yoco payment
  provider; follow-up sessions; Pre-Marital Counselling; calendar blocks shown in the console;
  consent form; admin password change.
