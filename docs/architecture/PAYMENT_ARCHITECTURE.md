# Payment Architecture

## Status: LIVE, FROZEN

This is real money moving through a live system. Nothing in this document
authorizes a behavior change — see `CONTRIBUTING.md` §3 and
`docs/milestone-v2/SAFETY-AND-TESTS.md` for the freeze rule. This document
exists to record exactly how the current path works, so no future agent has
to reverse-engineer it before touching anything adjacent.

## End-to-end flow

```
Browser (razorpay-checkout.js)
   → Razorpay-hosted checkout UI (client-side, public key only)
   → Razorpay's servers process the payment
   → Razorpay POSTs a webhook to /api/webhook (out-of-band, server-to-server)
   → functions/api/webhook.js verifies signature, writes to D1
   → Browser optimistically shows "thank you" and reloads after ~8s
```

The browser **never** confirms or verifies the payment itself, and never
writes to the database directly. The `handler` callback in
`razorpay-checkout.js` only shows a success message using the returned
`razorpay_payment_id` — actual persistence is entirely server-side and
asynchronous, driven by Razorpay's webhook delivery.

### 1. Checkout (client-side, `razorpay-checkout.js`)

- Loads Razorpay's `Checkout.js` SDK directly in-browser.
- Uses a **publishable** key (`RAZORPAY_TEST_KEY_ID`, currently a live-mode
  key despite the variable name — this is intentional and safe; it's the
  public key, the secret lives only server-side as `RAZORPAY_WEBHOOK_SECRET`).
- There is no backend "create order" call in this repo — all identifying
  data (`memberName`, `memberEmail`, `memberPhone`, `fundName`, `month`) is
  passed through Razorpay's `notes` object on the client-side options.
- Fund context comes from the `?fund=` query param, normalized via
  `fundDisplayName()`/`getFundContext()` — see
  [`FUND_ARCHITECTURE.md`](./FUND_ARCHITECTURE.md) for why this is
  hard-coded to two funds today.

### 2. Webhook delivery (`functions/api/webhook.js`, `POST /api/webhook`)

- **Signature verification**: reads the raw request body as text (so the
  signature is computed over the exact received bytes), HMAC-SHA256's it
  using `env.RAZORPAY_WEBHOOK_SECRET` via Web Crypto, compares against the
  `x-razorpay-signature` header. Any failure → 400, no write.
- Only `payment.captured` events are processed; everything else returns 200
  "unsupported event ignored" (so Razorpay doesn't retry it forever).
- **Idempotency, two layers**: an explicit `SELECT ... WHERE proof_id = ?`
  pre-check, backed by the `contributions.proof_id UNIQUE` SQL constraint as
  a race-condition backstop. A UNIQUE-constraint violation on insert is
  caught and converted to a 200 "duplicate ignored" — never a 500 — so
  Razorpay's retry behavior can't cause duplicate contributions or an
  incident-triggering error loop.
- **Timestamp handling**: `payment.created_at` (Unix seconds, UTC) is
  explicitly shifted +5.5h before storage, because every other row in
  `contributions` is stored in IST and Cloudflare Workers run in UTC with no
  timezone database available. A code comment documents a historical bug
  where this conversion was missing — see
  [`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md) for
  the full incident writeup.
- On success: inserts with `category = "Online (Verified)"`, upserts the
  `members` row (only fills missing `email`/`phone`, never overwrites), and
  optionally fire-and-forgets a copy to a Google Sheets Apps Script mirror
  **only if** `GOOGLE_SHEETS_WEBAPP_URL` is set (currently unset in
  production, to avoid double-writing the sheet since Razorpay already
  delivers to the Apps Script webhook directly for that purpose).
- **Not audited**: webhook-originated contributions do not write an
  `activity_logs` row. Only manually-entered contributions (via
  `functions/api/contributions.js`) are audited. See
  [`AUDIT_ARCHITECTURE.md`](./AUDIT_ARCHITECTURE.md) — this is a real gap
  against the constitution's audit requirements, flagged there, not fixed
  here.

### 3. Reconciliation (`functions/api/verify.js`) — separate tool, not part of the live path

A read-only, admin-only (`view_members`), on-demand integrity/reconciliation
check — never writes to `contributions`. Compares D1 against the legacy
Google Sheets source of truth, matching by `proof_id` first and a fuzzy
`(member, amount, day)` key second. Useful for auditing, irrelevant to how a
payment actually lands.

## Historical incident: the webhook registration gap

Between 8 Jul 2026 and 2 Aug 2026, no online payment reached D1, because
Razorpay's dashboard had only the old Google Apps Script URL registered as
the webhook target — not `/api/webhook`. The Sheet kept updating and looked
healthy; Razorpay's own delivery log showed "success" for the *wrong*
webhook. Backfilled via `migrations/0014_backfill_missed_webhook_payments.sql`.
This is documented in full, including the reconciliation method and the
"Razorpay dashboard is the single point of failure not enforced by this
repo" observation, in
[`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md) —
**required reading before touching anything payment-adjacent.**

## Future: multi-account support

The constitution requires the architecture to eventually support multiple
Razorpay accounts/configurations, resolved per-fund server-side (e.g.
Building Fund → Account B, Tech Fund → Account A), with the frontend
containing no fund-specific payment-account logic and credentials never
stored in source. **None of this exists today** — there is exactly one
global Razorpay key pair, hard-coded as a constant in
`razorpay-checkout.js` (public key; the secret is a Cloudflare environment
variable, `RAZORPAY_WEBHOOK_SECRET`).

`DECISION REQUIRED` before this is built:
1. Where do additional accounts' credentials live — Cloudflare secrets
   per-account (`RAZORPAY_KEY_<FUND>`) or a `payment_accounts` table with
   encrypted-at-rest secrets? Secrets-as-env-vars is simpler and matches the
   existing pattern; a table is more scalable as accounts grow but needs a
   real secrets story (D1 is not an appropriate place for plaintext payment
   secrets).
2. Does the webhook handler need to identify *which* account a payment
   belongs to before it can even verify the signature (each account likely
   has its own webhook secret) — this changes `webhook.js`'s signature
   verification from "one secret" to "look up the right secret first,"
   which is exactly the kind of change to the frozen path that needs a
   deliberate, reviewed migration, not an incidental addition.
3. Is this scoped for INR-only still, or does multi-account also imply
   multi-currency? The constitution says INR-only for now; `01-PRD.md`
   explicitly marks multi-currency/international gateways out of scope for
   the current milestone. Treat multi-account (same currency, different
   Razorpay account) and multi-currency (different gateway) as separate,
   independently-decidable pieces of work.

This should not be attempted opportunistically alongside the
[`FUND_ARCHITECTURE.md`](./FUND_ARCHITECTURE.md) hardcoding cleanup — do that
first, since a clean per-fund abstraction is the foundation multi-account
routing needs.
