# Payments

## Where the money actually goes

**The bank account is not configured in this application, and must never be.**

Card, Apple Pay and Google Pay payments are collected by the payment gateway,
which holds the funds briefly and then pays them out to a single bank account —
the one registered in the gateway's own dashboard during FICA verification.

So the FNB account is entered **once, in the Peach Payments dashboard**, under
the merchant/settlement settings. Not in the code, not in an environment
variable, not in the database. Three reasons:

1. Nothing in the application needs it. The app never moves money; it asks the
   gateway to, and the gateway already knows where to settle.
2. An account number committed to a repository is in the history permanently,
   visible to anyone who ever gets read access.
3. Changing it in code would do nothing anyway — the gateway would keep paying
   out to whatever it has on file.

There is one legitimate place for the practice's banking details: printed on a
receipt, for a client who wants to pay by direct EFT. Those are entered by an
administrator under **Admin → Settings → Banking details**, stored in the
settings row, and only shown if "Print these details on receipts" is ticked.

---

## Why Peach Payments

The practice banks with **FNB**, and that decides it:

- **Apple Pay** on Peach requires an FNB, Nedbank or Standard Bank merchant
  account.
- **Google Pay** requires Absa, FNB, Nedbank or Standard Bank.

FNB qualifies for both. One integration then covers Apple Pay, Google Pay,
Visa, Mastercard, Amex, Diners, PayShap, Pay by Bank and Scan to Pay — which is
what "and all the necessary ones" means in a South African context.

Cost is roughly 2.95% + R1.50 per transaction with a R300/month account fee.

**Payfast** is implemented as an alternative and is switched on with one
environment variable. It has no monthly fee and still carries Apple Pay,
Samsung Pay, cards, Instant EFT, SnapScan and Zapper — better economics at low
volume, at the cost of a slightly clumsier integration (no status API, refunds
only from their dashboard). If the practice does a handful of sessions a week,
Payfast is likely the cheaper choice; the code supports either.

Switch with:

```
PAYMENT_PROVIDER=peach     # or payfast, or mock
```

---

## Before you take a real payment

Both gateway integrations are written to the documented contracts but **have
not been run against a sandbox** — no credentials existed while building. The
mock provider is fully exercised and the surrounding logic (confirmation,
calendar sync, reminders, refunds, receipts) is verified end to end, but the
gateway request/response shapes need one pass against a real sandbox.

Work through this before going live:

### Peach

- [ ] Sandbox credentials in `PEACH_ENTITY_ID` / `PEACH_SECRET_TOKEN`, `PEACH_MODE=sandbox`
- [ ] Book a session → confirm the card fields render **inside** the booking
      page (not a redirect), with Apple Pay / Google Pay above them
- [ ] Confirm `POST /v1/checkouts` returns an id (this is the embedded flow;
      the hosted-redirect flow uses `/v2/checkout` and is the fallback)
- [ ] Confirm the **signature** is accepted (a rejected signature returns an
      error from `/v2/checkout` — check `services/payments/peach.ts:sign`)
- [ ] Pay with a sandbox card → confirm the booking flips to **Confirmed**
- [ ] Check `payment_events` for `verify.paid`
- [ ] Trigger a webhook → confirm signature verification passes
      (`PEACH_WEBHOOK_SECRET`) and the status is re-read from Peach
- [ ] Test a declined card → booking stays unconfirmed, client can retry
- [ ] Test a refund from **Admin → Payments**
- [ ] Confirm the result-code mapping in `mapResultCode()` matches what your
      account actually returns — this is the most likely thing to need a tweak

### Payfast

- [ ] Sandbox merchant id/key, `PAYFAST_MODE=sandbox`
- [ ] Book a session → the redirect page auto-posts you to Payfast
- [ ] Complete payment → confirm the ITN reaches `/api/payments/webhook`
- [ ] Confirm the ITN signature check passes (passphrase must match exactly)
- [ ] Confirm the server-side validate call returns `VALID`
- [ ] Deliberately post a forged ITN → must be rejected

Then switch the relevant `*_MODE` to `live`, put live credentials in, and take
one real payment for a small amount and refund it.

---

## How a payment is confirmed

A booking is **never** marked paid because the browser came back from a
checkout. Every confirmation is server-to-server:

```
client completes checkout on the gateway's page
   │
   ├─ returns to /book/confirmation?payment=...
   │     └─ server calls verifyCheckout() → asks the gateway what happened
   │
   └─ gateway posts to /api/payments/webhook
         ├─ Peach:   signature verified, then status RE-READ from Peach
         └─ Payfast: signature verified, then posted back to Payfast,
                     which must answer "VALID", then the amount is checked
                     against what we asked for
```

Both paths converge on `applyPaymentSuccess()`, which is idempotent — the
redirect, the webhook and a manual retry can all race without double-confirming
or double-emailing.

An amount mismatch is treated as a failure, not a success. Someone who
manipulates a checkout to pay R1 for an R800 session gets a failed payment and
an entry in `payment_events`.

---

## What the client sees — in-page card fields

The client never leaves the booking flow. The final step renders **Apple Pay and
Google Pay buttons, then card number / expiry / CVV fields**, inside our own
layout.

Those fields are not ours. They are iframes served by the gateway
(Peach's COPYandPAY widget). The card number goes from the client's browser
straight to Peach — it never enters our JavaScript, never reaches our server,
and is never logged.

**This is deliberate and must not be "simplified".** The moment this application
receives a raw card number, the practice moves from PCI DSS SAQ A (about twenty
questions) to SAQ D — quarterly ASV scans, annual attestation, penetration
testing, and full breach liability. A small counselling practice should not be
carrying that. If someone later wants to restyle the form, style the widget via
`wpwlOptions` in `components/booking/embedded-checkout.tsx`; do not replace it
with your own inputs.

Payfast cannot do in-page fields, so selecting it falls back to a full-page
hand-off. Same outcome, less seamless — the flow detects this automatically via
`provider.supportsEmbedded`.

In development, with no gateway configured, a simulated card form stands in. Its
inputs are disabled and it says plainly on screen that nothing is read, so it
can't be mistaken for the real thing.

The accepted-method marks shown earlier in the flow also come from the **active
provider** rather than being hardcoded, so the UI can never promise Apple Pay on
a gateway that doesn't offer it.

## Apple Pay setup

Apple will not show the button on an unverified domain. Two extra steps beyond
the normal Peach onboarding:

1. Enable Apple Pay on your Peach account (needs the FNB merchant account with
   card enabled).
2. Peach issues a **domain association file**. Paste its contents into
   `APPLE_PAY_DOMAIN_ASSOCIATION` — the app serves it at
   `/.well-known/apple-developer-merchantid-domain-association`.

Until that variable is set the route returns 404, which is honest: the domain
genuinely isn't verified and Apple Pay won't appear.

Apple Pay also requires HTTPS, so it will never show on `localhost`. Test it on
the deployed preview URL, on a real iPhone or a Mac with a card in Wallet.

## Receipts

Every paid session gets a receipt at `/portal/receipts/[paymentId]`, linked from
the client's Payments page. It prints to a clean A4 page — "Save as PDF" in the
browser's print dialog — and is built for South African clients claiming back
from a medical aid: who was seen, what service, when, how long, what it cost,
that it was paid, and the scheme membership details if they're on file.

It deliberately carries **no diagnosis or clinical detail**. A scheme that wants
a diagnostic code gets it from the practitioner, not from an automated receipt.
