# Payment Architecture Audit — LJM Church Contributions Portal

**Scope:** Read-only, code-and-repo-based audit of the Razorpay → D1 → Google
Sheets giving pipeline. No production system was touched, no payment was
made, and no donor PII was pulled from any live endpoint — every finding
below is derived from source in this repository (webhook handlers, Apps
Script files, migrations, tests, runbooks) plus `git log`. Two items (§31,
part of §30) require access this session does not have (Razorpay Dashboard,
Google Apps Script project) and are flagged as **not verifiable from the
repo alone** rather than guessed.

**Files reviewed:** `razorpay-checkout.js`, `v2/give-flow.html`,
`functions/api/webhook.js`, `functions/api/verify.js`,
`functions/api/migrate.js`, `functions/api/contributions.js`, `schema.sql`,
`migrations/0014_backfill_missed_webhook_payments.sql`,
`docs/runbooks/razorpay-webhook.md`, `POST_MIGRATION_SAFETY_REPORT.md`,
`CONTRIBUTING.md`, `payment-webhook.gs`, `webhook-diagnostics.gs`,
`test-webhook.gs`, `UNIFIED_FUND_APPSCRIPT_COMPLETE.gs`,
`unified-fund-appscript.gs`, `appscript-doGet-church-contributions.gs`,
`enhanced-christmasfund.gs`, `tests/api/webhook.test.mjs`,
`tests/api/verify.test.mjs`.

---

## A. Exact payment sequence diagram

```mermaid
sequenceDiagram
    participant Browser
    participant RZP as Razorpay Checkout.js
    participant Gateway as Razorpay (server-side)
    participant D1Hook as /api/webhook (Cloudflare)
    participant D1 as D1 contributions/members
    participant GAS as Apps Script doPost
    participant Sheet as Google Sheet

    Browser->>Browser: fill modal (name, amount, email, phone, fund, month)
    Browser->>RZP: new Razorpay(options) ; rzp1.open()
    Note over Browser,RZP: options = {key, amount×100, currency:"INR",<br/>notes:{memberName,memberEmail,memberPhone,fundName,month}}<br/>NO order_id — Standard Checkout, no server order creation
    Browser->>Gateway: card/UPI/etc. payment flow (hosted by Razorpay)
    Gateway-->>Browser: handler(response) — response.razorpay_payment_id ONLY
    Note over Browser: client callback is UI-only (alert + 8s countdown + reload).<br/>It writes nothing. If the tab closes here, no data is lost —<br/>persistence never depended on the browser.

    par Independent, unchained webhook fan-out (both registered directly in Razorpay Dashboard)
        Gateway->>D1Hook: POST payment.captured (+ x-razorpay-signature)
        D1Hook->>D1Hook: verify HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
        alt signature invalid or secret unset
            D1Hook-->>Gateway: 400 (fails closed)
        else valid
            D1Hook->>D1: SELECT id WHERE proof_id=? (idempotency check)
            alt already exists
                D1Hook-->>Gateway: 200 "Duplicate payment ignored"
            else new
                D1Hook->>D1: INSERT contributions (paise→INR, IST timestamp)
                D1Hook->>D1: INSERT/UPDATE members
                D1Hook-->>Gateway: 200 {status:"success"}
                opt GOOGLE_SHEETS_WEBAPP_URL is set (currently unset in prod)
                    D1Hook--)GAS: context.waitUntil(POST raw body) [off by default]
                end
            end
        end
    and
        Gateway->>GAS: POST payment.captured (+ x-razorpay-signature) — separately registered
        GAS->>GAS: signature check — OPTIONAL, fails OPEN if secret unset/placeholder
        GAS->>Gateway: GET /v1/payments/{id} (server-to-server re-verify) — fails OPEN if keys unset
        GAS->>Sheet: append row (idempotency: last-50-rows scan only)
        GAS->>Sheet: upsert members profile sheet
        GAS-->>Gateway: 200 JSON
    end

    Note over D1,Sheet: No code path links the two branches today.<br/>A failure in one never blocks or retries the other.
```

**Read path (how a recorded gift becomes visible):**
`index.html`/`v2/*.html` → `GET /api/contributions?fund=…` →
`functions/api/contributions.js` reads D1 `contributions` + `members` +
`purchases` directly. The legacy `member.html` → `member-dashboard.js` is
the one page that still reads the Apps Script `doGet` URL directly instead
of D1 (noted as open issue #2 in `POST_MIGRATION_SAFETY_REPORT.md`).

---

## Investigation findings (numbered per the audit brief)

**1–4. Checkout configuration / Orders API / server-side order creation / data sent to Razorpay**
`razorpay-checkout.js:360-413` builds the Razorpay options object entirely
client-side and calls `new Razorpay(options); rzp1.open()` directly —
**Razorpay Standard Checkout, no Orders API, no server-side order
creation anywhere in the repo** (`grep`-verified: zero references to
`orders`, `order_id`, or a `/v1/orders` call in any `.js`/`.gs`/`.html`
file). `v2/give-flow.html` explicitly reuses the same unmodified
`razorpay-checkout.js` ("same live Razorpay key, same... checkout
script") — the newer beta flow did not change this.

Data sent to Razorpay: `key` (`rzp_live_STrG9mXFNPWfMM`, public — safe to
expose per the code comment), `amount` (rupees × 100), `currency: "INR"`
(hardcoded, never derived from anything server-verified), `name`,
`description`, `prefill: {name, email, contact}`, `notes: {memberName,
memberEmail, memberPhone, fundName, month}`, `theme.color`. **Every one of
these fields is client-supplied and unauthenticated** — there is no
server round-trip before `rzp1.open()`.

**5. Data returned to browser**
Only `response.razorpay_payment_id` (the `handler` callback signature).
Because no `order_id` was created, Razorpay does not return
`razorpay_order_id` or `razorpay_signature` — so the browser has no way to
client-side-verify the payment even in principle. All verification is
server-side, webhook-only.

**6. Webhook payload fields consumed**
`functions/api/webhook.js:63-83`: `payload.event`,
`payload.payload.payment.entity.{id, amount, email, contact, method, vpa,
created_at, notes.{memberEmail, memberPhone, memberName, fundName,
month}}`. `payment.currency` and `payment.status` are **never read** (see
§11, §12).

**7. HMAC verification algorithm**
`verifyRazorpaySignature()` (`webhook.js:11-36`): Web Crypto
`HMAC-SHA-256` keyed with `RAZORPAY_WEBHOOK_SECRET`, computed over the
**raw request body** (read via `request.text()` before any JSON parsing —
correct; parsing first and re-stringifying would break signature
verification on key-order/whitespace differences), compared against the
hex-decoded `x-razorpay-signature` header via `crypto.subtle.verify`. This
matches Razorpay's documented webhook signature scheme exactly. Fails
closed: `if (!signature || !secret) return false`.

**8. What fields are trusted from the webhook**
Once the signature passes, `webhook.js` trusts `payment.amount` (the one
field Razorpay itself is the source of truth for — this can't be spoofed
by the payer, since it's what was actually captured) but also blindly
trusts **`notes.*`, which originated in the browser's checkout options and
passes through Razorpay unvalidated**: `memberName`, `memberEmail`,
`memberPhone`, `fundName`, `month`. Razorpay does not validate or sanitize
`notes` content — it is opaque metadata the merchant chose to attach. A
payer who edits the checkout options in devtools before calling
`rzp1.open()` can make a real, correctly-priced payment post under any
name/email/fund label they want; they cannot change the amount actually
charged (Razorpay enforces that), but they can mislabel it.

**9–10. Razorpay API verification / independent amount verification**
`functions/api/webhook.js` performs **no server-to-server call to
Razorpay's Payments API** — signature validity is the only proof of
authenticity, and amount is taken as-is from the signed payload (which is
sound, since a valid signature means Razorpay itself sent that amount).
The **Apps Script** webhook (`payment-webhook.gs:456-492`,
`verifyRazorpayPayment()`) *does* attempt this extra check — but only when
`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are configured in
PropertiesService; otherwise it logs "Trusting webhook payload" and
returns `true` unconditionally (fail-open).

**11. Currency verification**
Not verified anywhere. `webhook.js` divides `payment.amount` by 100 and
stores it as if it were always INR; `payment.currency` is never inspected.
Low practical risk (the Razorpay account and checkout are INR-only by
configuration) but there is no code-level guarantee.

**12. Payment status verification**
Only indirectly, via the event filter (`payload.event !== "payment.captured"`
→ ignored). `payment.entity.status` itself is never separately checked;
redundant with the event name in practice but not defensively verified.

**13–14. Fund / member identity independent verification**
Neither is independently verified (see §8). Fund name is normalized to one
of exactly two known slugs, with any unrecognized value **silently
defaulting to `tech-contributions`** (`webhook.js:70-78`,
`razorpay-checkout.js:22-26`, `payment-webhook.gs:633-638` — the same
normalization logic is hand-duplicated across three files that must be
kept in sync manually). Member identity is the raw name string with no
`member_id` foreign key — see §34.

**15. proof_id generation**
`payment.id` from Razorpay (e.g. `pay_TKUwMs3w4mHmNs`) — a value Razorpay
itself generates and which is unique per payment. Stored in
`contributions.proof_id`, a `UNIQUE` SQLite column
(`schema.sql:21-31`). This is the system's one true idempotency key.

**16–17. Idempotency / duplicate behavior**
`webhook.js:100-108`: `SELECT id FROM contributions WHERE proof_id=?`
before insert → `200 "Duplicate payment ignored"` if found. Race between
two concurrent deliveries (both pass the SELECT before either INSERTs) is
caught at the `UNIQUE` constraint and also returns `200` instead of `500`
(`webhook.js:133-141`, added as fix #3 in `POST_MIGRATION_SAFETY_REPORT.md`
— verified in `tests/api/webhook.test.mjs`). Apps Script's duplicate check
(`isDuplicatePayment`) only scans the **last 50 rows** of the sheet and
fails open on any error (§34).

**18. Refund behavior**
**Not implemented anywhere.** Neither `webhook.js` nor `payment-webhook.gs`
subscribes to or handles `refund.processed`/`payment.refunded`. A refunded
payment stays recorded as a live contribution in both D1 and the Sheet
indefinitely — the public "total collected" figure never decreases for a
refund.

**19. Partial-payment behavior**
Not applicable / not implemented. Standard Checkout without an Order has
no concept of partial capture against a fixed order amount; the amount is
fixed by the client at checkout-open time and is captured in full or not
at all.

**20–21. Failed-payment / retry behavior**
`rzp1.on('payment.failed', ...)` (`razorpay-checkout.js:417-422`) is
purely a client-side UI alert; nothing is sent to any backend. The
production Razorpay webhook subscription is documented as
`payment.captured` **only** (`docs/runbooks/razorpay-webhook.md:51`), so
failed attempts are invisible server-side — there is no admin-facing
record of failed/abandoned payments. A retry after failure is simply a new
`Razorpay` checkout attempt; if it succeeds it arrives as an unrelated new
`payment.captured` event with a new `payment.id`.

**22. Webhook retry behavior**
Governed by Razorpay's own retry policy (outside this repo), triggered by
non-`200` responses. `webhook.js` returns `400` on bad signature (Razorpay
will keep retrying an undeliverable payload — this cannot self-heal
without an operator fixing the secret) and `500` on a genuine D1 failure
(retryable). `200` is returned for success, duplicate, and
"unsupported event ignored" — none of which Razorpay will retry.

**23–26. Cross-system success/failure combinations & re-delivery**
The two webhooks are **structurally independent** — both are registered
directly against Razorpay's dashboard, not chained in code
(`docs/runbooks/razorpay-webhook.md:26-39`, confirmed in
`functions/api/webhook.js:144-156`: the D1→Sheets forward is opt-in via
`GOOGLE_SHEETS_WEBAPP_URL` and is currently **unset** in production
specifically to avoid double-writing, since Razorpay already delivers to
Apps Script directly). Consequences:
- **D1 succeeds, Apps Script fails:** D1 has the row, Sheet doesn't. No
  code notices; only `/api/verify`'s reconciliation surfaces it (as a
  `missingInD1`-style gap in reverse — actually surfaces as a D1-only row
  with no sheet counterpart, flagged `warn` not `fail`).
- **Apps Script succeeds, D1 fails:** exactly what happened in the
  historical incident (§29) — Sheet has it, D1 doesn't, dashboard shows
  nothing.
- **Both succeed:** two independently-written rows, no automatic
  cross-check; `/api/verify` is the only thing that ever compares them,
  and it runs on-demand, not on a schedule.
- **Same webhook delivered multiple times:** D1 is idempotent by
  `proof_id` (§16). Apps Script is idempotent only within its 50-row
  lookback window (§34).

**27. Browser closes after payment**
No impact on data integrity. The `handler` callback is UI-only (alert,
countdown, page reload); the contribution is persisted entirely by the
server-side webhook, which fires from Razorpay's infrastructure regardless
of browser state. This is a deliberate and correct design choice.

**28. Webhook delivery delayed**
Handled gracefully as long as it eventually arrives within Razorpay's
retry window — the gift is simply late to appear on the dashboard. If
delivery is delayed indefinitely (wrong URL registered, as in the actual
incident) it never arrives and requires manual reconciliation
(`/api/verify`) and a hand-built backfill migration (§29).

**29. Root cause of the migration-0014 incident**
Documented first-hand in `docs/runbooks/razorpay-webhook.md:1-24` and the
migration's own header comment. Between the D1 backend going live
(2026-07-08) and 2026-08-02, **the only webhook registered in Razorpay's
dashboard pointed at the Google Apps Script URL** — `/api/webhook` was
never called even once, despite being deployed and functioning correctly.
Four real `payment.captured` events were captured, written to the Sheet,
and never reached D1. What masked it: the Sheet kept updating (looked
healthy), and Razorpay's delivery log showed "success" — because it was
reporting on the Apps Script delivery, not on `/api/webhook`, which had no
log entries at all because it received zero traffic. Fixed by (a)
registering `/api/webhook` as an additional webhook subscription in
Razorpay and (b) backfilling the four missing payments via
`migrations/0014_backfill_missed_webhook_payments.sql`, generated by
replaying each real payload through `functions/api/webhook.js` in the test
harness rather than hand-writing SQL (so the backfilled rows are
byte-for-byte what the webhook would have produced).

**30. Currently deployed Apps Script source among the candidate `.gs` files**
**Cannot be fully confirmed from the repository alone** — Apps Script
deployments live in a Google-hosted project this session has no access to.
What the repo evidence supports:
- **Webhook (`doPost`) handler:** `payment-webhook.gs` is almost certainly
  current — it's the most recently modified of the payment-related `.gs`
  files (2026-07-07, same day as the D1 launch and the incident window),
  and `razorpay-checkout.js`'s own header comment names it directly
  ("kept securely on the backend (`payment-webhook.gs`)"). `test-webhook.gs`
  (also 2026-07-07) is its accompanying unit-test suite, confirming active
  development on this exact file at that time.
- **Public-read (`doGet`) handler:** ambiguous. At least five distinct
  Apps Script Web App URLs appear across the repo (`STEP_BY_STEP_SETUP.md`,
  `UPDATES_COMPLETE.md`, `` fundData.js`` — leading-space filename,
  `member-dashboard.js`/`preloader.html`, and the fallback baked into
  `functions/api/verify.js`/`functions/api/migrate.js`:
  `AKfycbwEnjzm9FHSSONNXWLecmmz_Gipfe0070bSRYxOE1YjljMJOeC9lLuaGAzJN7cF_I3I`).
  The `verify.js`/`migrate.js` URL is the best inference for "currently
  live," since it's the one actively exercised by production code
  (`/api/verify`'s Sheets reconciliation, `/api/migrate`'s import) — but
  this is inference from usage, not confirmation of which `.gs` file backs
  it. `UNIFIED_FUND_APPSCRIPT_COMPLETE.gs` is the most fully-featured and
  most recently touched of the `doGet` candidates (adds `memberEmails`
  auto-fill, matching what `razorpay-checkout.js` reads via
  `window._memberEmails`), making it the most plausible currently-active
  `doGet`, but **an admin with Apps Script editor access should confirm
  this directly** (Extensions → Apps Script on the Sheet → Deployments)
  rather than relying on this inference.

**31. Which webhook endpoint is actually registered in Razorpay**
**Not verifiable from this session** — there is no Razorpay Dashboard
access or API credential available here, and per the audit brief's
constraints this session did not attempt any live payment or webhook
probe against production. Per the runbook, the expected/target state
after the migration-0014 fix is **both** `/api/webhook` and the Apps
Script URL registered as separate `payment.captured` subscriptions. This
should be confirmed directly by a human with Razorpay Dashboard access
(Settings → Webhooks) — screenshot or export the webhook list rather than
trusting the docs, since dashboard config is exactly the kind of
out-of-repo state that caused the original incident.

**32. D1 vs Apps Script webhook security comparison** — see §C below.

**33–34. Ways money could be displayed incorrectly / duplicated / lost** — see
§D below.

---

## B. Failure-mode matrix

| Scenario | D1 (`/api/webhook`) | Apps Script (`payment-webhook.gs`) | Net effect on public ledger |
|---|---|---|---|
| Valid signature, new payment | Row inserted, member upserted | Row appended, member profile updated, emails sent | Both ledgers gain one matching row |
| Same payment delivered twice (sequential) | 2nd call: `200` "Duplicate ignored" via SELECT check | 2nd call: skipped if within last 50 rows scanned; **not skipped if >50 rows old** | D1 safe; Sheet can double-count old redeliveries |
| Same payment delivered twice (concurrent race) | 2nd call: `200` via UNIQUE-constraint catch (no 500) | Race not specifically handled; two near-simultaneous `doPost` executions can both pass the last-50-row scan before either appends | D1 safe; Sheet can double-count |
| Invalid/missing signature | `400`, nothing written (fails closed) | **Written anyway** if `RAZORPAY_WEBHOOK_SECRET` unset/placeholder (fails open), or if `?secret=`/`?isLocalTest=true` bypass used | D1 protected; Sheet potentially forgeable |
| Webhook URL misregistered (the historical incident) | Never called — zero rows, silently | Unaffected, keeps working | D1 permanently missing rows until manual reconciliation |
| D1 down (`500`) | Razorpay retries per its own policy; if retries are exhausted before D1 recovers, payment is captured but never lands in D1 | Unaffected (independent registration) | Sheet has it, D1 doesn't, until manual backfill |
| Apps Script quota/outage | Unaffected | Silent failure (no retry mechanism visible in `.gs` source; Razorpay will retry the HTTP call per its policy, but Apps Script errors inside `doPost` are swallowed into the `catch` and still return `200`-equivalent `ContentService` output in some paths) | D1 has it, Sheet doesn't |
| Refund issued | Not handled — row stays | Not handled — row stays | Public total **overstated** indefinitely |
| Currency ≠ INR (hypothetical) | Not detected, amount stored as INR face value | Not detected | Total silently wrong by the FX difference |
| `fundName` note tampered/omitted | Silently defaults to `tech-contributions` | Silently defaults to `tech-contributions` | Gift attributed to the wrong fund's balance and goal |
| `GOOGLE_SHEETS_WEBAPP_URL` accidentally set while Razorpay still delivers to Apps Script directly | D1 forwards the same event a second time to the Sheet | Sheet receives the event twice (once direct from Razorpay, once forwarded by D1) | Sheet double-counts every payment |
| `/api/migrate` re-run on rows with `NULL proof_id` | `INSERT OR IGNORE` does not dedupe (SQLite treats `NULL` as distinct under `UNIQUE`) | n/a (migrate reads from Sheet, doesn't write to it) | D1 gains duplicate legacy rows on every re-run |
| Browser tab closed mid-payment | No effect — persistence is webhook-only | No effect | None — correct by design |

---

## C. Security analysis

**D1 webhook (`functions/api/webhook.js`)**
- Signature check is **mandatory and fails closed**: no signature, no
  secret, or a mismatched signature all return `400` before any DB access.
- No legacy bypass parameters (`?secret=`, `?isLocalTest=`) exist in this
  handler at all — the only way in is a valid HMAC.
- No independent Razorpay API re-verification of amount/status — accepted
  as reasonable, since HMAC validity already proves Razorpay authored the
  payload, but it means D1 has **no second check** if the webhook secret
  itself were ever leaked (an attacker holding the secret could forge
  arbitrary `payment.captured` events with fabricated amounts and names —
  the secret is the entire trust boundary).
- Endpoint requires no additional authentication (`requireAuth` is not
  called in `webhook.js` — by design, since Razorpay is an external,
  unauthenticated-by-cookie caller; the HMAC *is* the authentication).
- Idempotency is race-safe (SELECT + UNIQUE-constraint catch).

**Apps Script webhook (`payment-webhook.gs`)**
- Signature check is **optional and fails open**: skipped entirely with
  only a `console.warn` if `RAZORPAY_WEBHOOK_SECRET` is unset or still the
  placeholder string.
- Two additional bypass surfaces even when a secret *is* configured:
  a `?secret=<value>` query-string alternative (weaker than a header
  signature — leaks via server logs/proxies/browser history) and an
  `isLocalTest=true` parameter that skips **both** the signature check
  *and* the server-to-server Razorpay re-verification.
- The server-to-server re-verification (`verifyRazorpayPayment`, calling
  `GET /v1/payments/{id}` with Basic Auth) is a genuine extra layer D1
  lacks — but it too **fails open** ("Trusting webhook payload") if
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` aren't populated in
  PropertiesService. Whether they actually are populated in the live
  project cannot be confirmed from source (PropertiesService values are,
  correctly, not checked into source control) — an admin should verify
  this directly in the Apps Script project.
- Idempotency check only scans the last 50 rows and fails open on error
  (`return false` inside a `catch`, meaning "assume not a duplicate").
- Has one protection D1 lacks: an explicit request-size cap (20,000 bytes)
  as a lightweight anti-DoS measure.
- Sends real donor PII (name, email, phone) via `MailApp` to a hardcoded,
  in-source admin email list on every successful payment, with no rate
  limiting — a forged-and-accepted payload (via any of the fail-open paths
  above) could be used to spam those inboxes or send a fabricated
  "thank you" email to an arbitrary address entered as `memberEmail`.

**Overall: D1's webhook is strictly more secure on the axis that matters
most (forgery prevention) — its trust boundary has exactly one gate (a
correct HMAC) and no way around it. Apps Script's webhook has the same
intended gate plus a genuinely useful extra check, but ships with three
independent ways to bypass authentication that are only closed if an
operator has fully populated PropertiesService** — a state this repo
cannot confirm.

---

## D. Data-integrity analysis

Root causes of divergence between what's collected, what's recorded, and
what's displayed (expanding §33/§34):

1. **Two independently-written ledgers, no real-time reconciliation.**
   D1 and the Sheet are each written by their own Razorpay webhook
   registration; nothing in the running system compares them except
   `GET /api/verify`, which is on-demand (admin-triggered), not scheduled.
   Between checks, the two can silently diverge — this is exactly what
   happened during the incident window (Razorpay 31 rows/₹9,204 vs Sheet
   34 rows/₹9,605 vs D1 28 rows/₹9,002, per the runbook's own reconciliation
   table).
2. **`proof_id` is the only real idempotency key, and it's optional.** 71
   of the pre-webhook-era D1 rows have `NULL proof_id` (manually
   migrated/cash entries) — SQLite's `UNIQUE` treats `NULL` as distinct
   from every other `NULL`, so those rows are **not** protected from
   duplication by the schema; only Razorpay-webhook-written rows are.
3. **Float storage for money.** `contributions.amount` is `REAL`
   (`schema.sql:24`) — aggregate `SUM()`s used throughout
   `functions/api/contributions.js` and `verify.js` accumulate IEEE-754
   rounding error over hundreds of rows. Currently masked by INR amounts
   being whole rupees in practice, but not schema-guaranteed.
4. **No FK constraints** — `contributions.member_name` and
   `contributions.fund` are free-text, matched against `members.name` and
   `funds.slug` only by application-level queries (`verify.js`'s
   "integrity" checks exist specifically because the schema itself
   doesn't enforce this).
5. **Refunds are invisible to both systems** — once captured, a
   contribution is permanent regardless of what happens to the money
   afterward.
6. **Manual admin entry has no independent proof.** `POST
   /api/contributions` (allowlisted to one admin email today) accepts any
   `amount`/`date`/`fund` with `proof_id = NULL` and only basic
   type/range validation — a typo becomes a permanent, unverified public
   number with only an audit-log trail for correction.
7. **Hand-duplicated normalization logic.** Fund-name normalization
   (`tech-contributions`/`christmas-fund` mapping) is implemented
   separately in `razorpay-checkout.js` (display label),
   `functions/api/webhook.js` (D1 write), and `payment-webhook.gs` (Sheet
   write) — three independent copies that must be edited in lockstep any
   time a fund is added or an alias changes, with nothing enforcing that.

---

## E. Legacy (Apps Script/Sheets) vs D1 comparison

| Dimension | Google Apps Script + Sheet | Cloudflare D1 |
|---|---|---|
| Signature enforcement | Optional, fails open | Mandatory, fails closed |
| Bypass surfaces | `?secret=`, `?isLocalTest=true`, unset-secret warn-and-continue | None found |
| Server-to-server re-verification | Yes, but fails open if keys unconfigured | No |
| Idempotency | Last-50-rows text scan, fails open on error | `UNIQUE(proof_id)` + race-safe catch, fails closed |
| Query surface for reads | `doGet` — multiple divergent deployments/URLs exist across the repo, hard to know which is canonical (§30) | Single source (`/api/contributions`), versioned in this repo |
| Payload size limit | 20 KB explicit cap | Relies on platform default |
| Notifications | Sends admin + donor email directly from the handler | None (notification is out of scope for this endpoint) |
| Data model | Flat sheet rows, headers matched by fuzzy string search, columns created on the fly if missing | Typed SQL schema, migrations, `is_deleted` soft-delete, audit log |
| Reconciliation tooling | None native | `GET /api/verify` (admin-only, read-only, ~20 checks incl. cross-checking against the Sheet) |
| Current role per docs | Still the parallel live write target (dual-write, not yet retired) | The system of record for the public dashboard reads |

---

## F. Root cause of the historical outage

See §29 above for the full narrative. One-line version: **a webhook
registered against the wrong URL in Razorpay's dashboard — a
configuration that lives entirely outside this repository and isn't
tested or asserted by any code — silently starved `/api/webhook` of all
traffic for 25 days**, and the failure was invisible because every
observable signal (Sheet updating, Razorpay's own delivery log) looked
healthy; only the *absence* of a signal (`MAX(date) WHERE proof_id IS NOT
NULL` going stale) would have caught it, and nothing was watching that
signal at the time.

---

## G. Current risks (ranked)

1. **Refunds are unhandled.** A refunded payment permanently overstates
   the public total on both ledgers — no code path removes or flags it.
2. **Apps Script webhook's fail-open defaults.** If `RAZORPAY_WEBHOOK_SECRET`
   or the `RAZORPAY_KEY_ID`/`SECRET` PropertiesService values are ever
   unset (e.g. after a project transfer or a properties reset), the Sheet
   silently becomes forgeable with zero error surfaced anywhere.
3. **No scheduled reconciliation.** `/api/verify` exists and works but is
   manual — divergence between D1, the Sheet, and Razorpay's own records
   can persist for arbitrarily long before anyone notices, as it did for
   25 days previously.
4. **`GOOGLE_SHEETS_WEBAPP_URL` is a single-env-var footgun.** Setting it
   in Cloudflare Pages while Razorpay still separately delivers to the
   Apps Script URL directly (the current live topology) immediately
   double-writes every future payment to the Sheet. Nothing prevents this
   misconfiguration except operator discipline and the runbook.
5. **Ambiguity about which `.gs` file is actually deployed** (§30) means
   a future code change to any of the candidate files in this repo may
   not affect production at all, or may affect the wrong deployment —
   until an admin confirms the live Apps Script project's source against
   what's checked in here.
6. **Member identity by name string, not ID** (also flagged in
   `POST_MIGRATION_SAFETY_REPORT.md`) — a misspelling forks a donor's
   giving history; a name collision merges two different donors' history.
7. **Money as `REAL`** — no immediate symptom, but a compounding-error
   risk as volume grows; migrating to integer paise is a schema change
   this repo's own rules require to be additive/backward-compatible.
8. **Manual contribution entry has no second-approval step** — currently
   allowlisted to a single admin, but the endpoint itself has no built-in
   control beyond that allowlist and basic validation.
9. **No automated alert on the exact signal that would have caught the
   original incident** (`MAX(date) WHERE proof_id IS NOT NULL` going
   stale) — the runbook documents the query but nothing runs it on a
   schedule.

---

## H. Recommended target architecture

1. **Retire the dual-write, deliberately.** Make D1 the sole write target:
   stop registering the Apps Script URL as a Razorpay webhook, and have
   `/api/webhook` do the Sheet forward itself (the `waitUntil` forward
   path already exists and is tested) if the Sheet must be kept alive for
   any transitional reason — or drop the Sheet entirely once
   `member.html`/`member-dashboard.js` are migrated to read `/api/contributions`
   (already flagged as open issue #2 in `POST_MIGRATION_SAFETY_REPORT.md`).
2. **Handle `refund.processed`/`payment.refunded`** in `/api/webhook`:
   either mark the original row `is_deleted`/refunded with an audit trail,
   or add a `refunded_amount`/`status` column via an additive migration.
3. **Schedule `/api/verify`** (e.g. a Cloudflare Cron Trigger calling it
   daily) and alert on any `fail` — turning the manual runbook check into
   an automated one closes the exact detection gap that let the original
   incident run for 25 days.
4. **Add a direct Razorpay Payments API cross-check** to `/api/webhook`
   itself (fetch `GET /v1/payments/{id}` with the account's live keys and
   assert `status === "captured"` and `amount` matches) — gives D1 the
   same defense-in-depth the Apps Script script has, without inheriting
   its fail-open default (make it fail *closed*: if the keys aren't
   configured, reject rather than skip).
5. **Move fund normalization to one shared, tested module** instead of
   three hand-duplicated copies (`razorpay-checkout.js`,
   `functions/api/webhook.js`, `payment-webhook.gs`) — at minimum, keep
   the two backend copies (D1 and Apps Script) byte-identical and covered
   by a shared test fixture so a new fund can't be added to one and
   forgotten in the other.
6. **Introduce `member_id` as the real join key**, with `contributions`
   carrying both the historical name string and a foreign key, and a
   controlled claim/merge flow for renames — already scoped as open issue
   #4 in `POST_MIGRATION_SAFETY_REPORT.md`.
7. **Confirm and document the single canonical Apps Script deployment**
   (§30/§31) — an admin should open the Apps Script project, record which
   deployment URL and which source file is actually live for both `doPost`
   and `doGet`, delete/archive the stale deployments, and update this
   repo's fallback URLs (`verify.js`, `migrate.js`) to match. This is a
   config/documentation action, not a code change, and should happen
   before any of the above code changes land so "the currently deployed
   source" stops being an open question.
8. **Money as integer paise**, migrated additively (`amount_paise INTEGER`
   alongside the existing `amount REAL`, backfilled, then cut over reads)
   per `CONTRIBUTING.md`'s additive-only rule.

---

*This audit performed no writes to any production system, made no test or
real payment, and did not fetch or display any individual donor's payment
data — all findings are derived from source code, migrations, tests, and
documentation already committed to this repository, plus local `git log`
history.*
