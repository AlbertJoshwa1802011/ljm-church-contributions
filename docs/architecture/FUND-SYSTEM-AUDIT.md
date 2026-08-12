# Fund System Architecture Audit

**Date:** 2026-08-12
**Type:** Investigation only — no application/schema/payment changes made.
**Scope:** Full trace of the existing fund system (DB → backend → frontend →
admin → Razorpay → webhook → public display), in preparation for a future
dynamic, plug-and-play Fund system.

> This document does not redesign or implement anything. Section G proposes a
> target architecture for future review; it is explicitly marked
> **DECISION REQUIRED** and must not be treated as an approved plan.

---

## 0. Reading-list discrepancy (report first, per task instructions)

The task briefing asked me to read `docs/README.md`, `docs/development/AGENT_RULES.md`,
`docs/development/AGENT_HANDOFFS.md`, `docs/product/`, and `docs/architecture/`
before starting. **None of these exist in this repository.** The actual docs
tree is:

```
docs/
├── milestone-v2/   (01-PRD.md … 11-v2-flow-implementation.md, README.md, SAFETY-AND-TESTS.md)
├── runbooks/        (razorpay-webhook.md)
└── testing/         (COVERAGE-TRACKER.md)
```

The repo's real "read first" chain is `CLAUDE.md` → `CONTRIBUTING.md` →
`docs/milestone-v2/README.md` → `docs/testing/COVERAGE-TRACKER.md`, which is
what I followed instead. This audit creates `docs/architecture/` (this file)
and `docs/development/AGENT_HANDOFFS.md` (the handoff log) as new, since the
task requires writing to those paths — I did not find or move anything to get
there, they simply didn't exist yet.

## 0.1 Baseline test run

```
npm test
# tests 328
# pass 328
# fail 0
# duration_ms ~2423
```

Matches the expected baseline exactly (328/328). Re-run at the end of this
session (no code changed) — same result, see §Testing in the handoff below.

---

## A. Current fund architecture — end-to-end flow

There are **two parallel systems** live today, not one:

1. A **legacy hardcoded two-fund system** (Tech Fund, Christmas Fund) — this
   is what actually carries money and is what §CONTRIBUTING.md calls "the
   giving/money path", frozen.
2. A **partially-built dynamic fund registry** (`funds` table +
   `functions/api/funds.js` + admin CRUD UI), added in commit `231f267`
   ("dynamic funds registry, audit logs, and hardened admin APIs"). It can
   register new funds, show them publicly, and take **manually-entered**
   contributions — but it is **not wired into the Razorpay online-payment
   path**.

### Flow 1 — Online payment (Razorpay), legacy funds only

```
index.html?fund=tech-contributions | ?fund=christmas-fund
        │
        ▼
razorpay-checkout.js (browser)
   - getFundContext() reads ?fund= from the URL
   - builds Razorpay Checkout options CLIENT-SIDE (no server "create order" call)
   - key = hardcoded RAZORPAY_TEST_KEY_ID ("rzp_live_…", single account)
   - notes.fundName = raw ?fund= value (unnormalized, e.g. "Tech Fund")
        │
        ▼  user pays inside Razorpay's hosted Checkout widget
Razorpay (hosted, off our infra)
        │
        ├──► Apps Script webhook  ──► Google Sheet   (legacy, still live)
        │
        └──► /api/webhook  (functions/api/webhook.js)
                 - verifies HMAC signature (env.RAZORPAY_WEBHOOK_SECRET)
                 - reads payload.payload.payment.entity.notes.fundName
                 - normalizes it against a HARDCODED allowlist of exactly
                   two strings → "tech-contributions" | "christmas-fund"
                   (anything else silently becomes "tech-contributions")
                 - INSERT INTO contributions (…, fund) — fund is a free TEXT column
                 - upserts the member into `members`
                 - optionally forwards the raw payload to Apps Script (opt-in,
                   env.GOOGLE_SHEETS_WEBAPP_URL, currently unset in prod)
        │
        ▼
D1 `contributions` table (fund = 'tech-contributions' | 'christmas-fund')
        │
        ▼
/api/contributions?fund=… (functions/api/contributions.js)
   - normalizes the query fund param through the SAME two-value allowlist
   - reads goal from `funds` table (fallback: `config` key)
   - reads contributions, member profiles, purchases spend
        │
        ▼
script.js: initDashboard() (Tech) / initChristmasFundDashboard() (Christmas)
   - two SEPARATE, near-duplicate rendering pipelines
        │
        ▼
index.html — public dashboard (goal bar, contributor list, "what we bought")
```

### Flow 2 — Dynamic fund (admin-created via `/api/funds`), no online payment path

```
admin.html "Funds" tab
   - POST /api/funds {name, slug, goal_amount, description, visibility}
   - requires `manage_funds` permission (role-based, functions/api/roles.js)
        │
        ▼
D1 `funds` table (is_system = 0)
        │
        ├──► funds.html — public listing auto-appends non-system active funds
        │       fetch("/api/funds") → generic icon rotation, name, description
        │
        ▼
index.html?fund=<slug>
   - script.js's DOMContentLoaded handler: slug not in the two legacy lists
     → calls initDashboard({ slug }) — REUSES the Tech Fund rendering pipeline
        │
        ▼
/api/funds?slug=<slug> (functions/api/funds.js onRequestGet, detail branch)
   - returns a payload SHAPED like /api/contributions (legacy-compatible
     contract: goalAmount, contributions, memberEmails, …) plus fund metadata
        │
        ▼
Same dashboard rendering as Tech Fund (goal bar, contributors, purchases)
```

**The gap between the two flows is exact and single: there is no way for a
Razorpay payment to land against a dynamically-created fund.** The "Proceed to
Pay" button on a dynamic fund's page sends `notes.fundName = "<slug>"`, and
`webhook.js`'s hardcoded normalizer silently reassigns that payment to
`tech-contributions`. Contributions can only be attached to a dynamic fund
through the **manual entry** admin form (`POST /api/contributions`, which
does accept arbitrary fund slugs — see §C).

---

## B. Hardcoded areas — exact inventory

Every place Christmas Fund / Tech Fund identity is hardcoded, and why it
blocks dynamic funds:

| # | File | Location | What's hardcoded | Blocks dynamic funds because… |
|---|------|----------|-------------------|-------------------------------|
| 1 | `functions/api/webhook.js` | lines 70–78, `fundName` normalization | `if/else` chain maps ANY input to exactly `"tech-contributions"` or `"christmas-fund"`; unrecognized values fall back to `"tech-contributions"` | **This is the critical blocker.** Every online payment for a new fund is silently misattributed to Tech Fund. No code path exists to accept a third fund slug from a webhook payload. |
| 2 | `razorpay-checkout.js` | `RAZORPAY_TEST_KEY_ID` (line 8) | A single hardcoded Razorpay **public key** (`rzp_live_…`, despite the "TEST" in the variable name — misleading name, not a test key) | Assumes exactly one Razorpay account for the entire site. No mechanism to look up a different key per fund. |
| 3 | `razorpay-checkout.js` | `fundDisplayName()` (lines 22–26) | Returns only `"Christmas Fund"` or `"Tech Fund"` — any other input (including a real dynamic-fund slug) displays as `"Tech Fund"` | The payment-screen label for a new fund would lie to the payer, saying "Contribution towards Tech Fund". Explicitly tested/asserted as current behavior in `tests/frontend/razorpay-fund-label.test.mjs` ("unknown fund falls back to Tech Fund, matching webhook.js") — i.e. this is intentional, documented legacy behavior, not an oversight. |
| 4 | `functions/api/contributions.js` | `normalizeFund()` (lines 12–17) + inline normalization in `onRequestGet` (lines 76–82) | Two independent copies of the same tech/christmas alias table (`"tech"`/`"techfund"` → `tech-contributions`, etc.), default fallback `"tech-contributions"` | Duplicated logic (not DRY with `webhook.js`'s copy); GET path silently coerces any unrecognized fund query param to Tech Fund's data, i.e. `/api/contributions?fund=building-fund` returns **Tech Fund's** contributions, not an error and not empty. |
| 5 | `functions/api/contributions.js` | lines 56–60, purchases listing | `if (p.fund === "tech-contributions") p.fund = "Tech Fund"; else if (…christmas-fund…) …` | Purchases for a dynamic fund keep their raw slug instead of a display name; cosmetic but confirms the legacy/dynamic split runs all the way through the purchases view too. |
| 6 | `script.js` | `initDashboard()` vs `initChristmasFundDashboard()` (~lines 1445 and ~1802) | Two near-duplicate, hand-copied rendering functions — one genuinely fund-agnostic (`initDashboard`, extended in commit `231f267` to also serve `/api/funds?slug=`), one fully Christmas-specific with the API URL, heading text, and cache key all hardcoded inline | A third fund cannot reuse `initChristmasFundDashboard()`'s styling/copy at all; only `initDashboard()`'s (Tech Fund-branded) pipeline is reachable for new funds, so every dynamic fund currently inherits Tech Fund's generic wording ("⛪ Loading fund…" then swapped, no seasonal/thematic styling hook). |
| 7 | `script.js` | DOMContentLoaded routing (~lines 1370–1380) | `LEGACY_TECH` / `LEGACY_XMAS` string-literal arrays gate which of the two legacy pipelines runs; everything else falls through to the dynamic `initDashboard({slug})` branch | Correct today, but every future special-case fund behavior would have to be added as a third hardcoded literal array here — the pattern itself doesn't scale past "one bespoke branch per fund". |
| 8 | `script.js` | localStorage cache keys, e.g. `"techFundData"`, `"christmasFundData"` (~lines 1293–1294, 1306, 1423) | Fixed cache-key strings for exactly two funds; dynamic funds get `"fundData_" + slug` (a different, newer pattern introduced in the same commit) | Two different caching conventions coexist; not a functional blocker but a maintenance hazard if someone "cleans up" the legacy keys without realizing dynamic funds use a different one. |
| 9 | `funds.html` | lines 42–58 | Two `<div class="fund-card">` blocks hand-written in HTML for Tech Fund and Christmas Fund (icon, description, "Active"/"Archived" status text) | Any admin edit to these two funds' name/description/status via `/api/funds` PUT does **not** update this static markup — the cards are frozen text, while dynamic funds appended below them (lines 104–126) do reflect live `/api/funds` data. Inconsistent single source of truth. |
| 10 | `admin.html` | `loadOverview()` (~lines 1560–1612) | Overview KPIs are computed by fetching `/api/contributions?fund=tech-contributions` and `/api/contributions?fund=christmas-fund` **explicitly by name**, then merging; dynamic funds' contributions are invisible to this view (only their `totalCollected` shows up separately via the `renderDist` funds-registry pass) | The admin "at a glance" totals (Total collected, This month, Growth, Available balance) do not include dynamic-fund contributions at all — a real reporting gap for any fund created through the new registry. |
| 11 | `functions/api/funds.js` | `RESERVED_SLUGS` (line 8) | `["purchases", "api", "admin", "all"]` — a small hardcoded blocklist so a new fund's slug can't collide with existing routes | Not a blocker (this is exactly the kind of guard a dynamic system needs) but worth flagging: doesn't include `"tech-contributions"` / `"christmas-fund"` explicitly — collision with those is instead prevented by the `UNIQUE` constraint on `funds.slug`, since they're already seeded rows. |
| 12 | `schema.sql` | `contributions.fund` comment (line 31) | `-- 'tech-contributions' or 'christmas-fund'` | Documentation-only staleness — the column is in fact free TEXT and already holds dynamic-fund slugs when entered manually; the comment underclaims what the column supports. |
| 13 | `functions/api/settings.js` | `WRITABLE_KEYS` (line 19), goal-sync block (lines 96–101) | `tech_goal_amount` / `christmas_goal_amount` are the only two config keys wired to auto-sync into `funds.goal_amount` | A dynamic fund's goal is edited directly through `/api/funds` PUT (which does update `funds.goal_amount` — see `functions/api/funds.js` lines 236–238) so this isn't a functional gap for dynamic funds specifically, but it does mean **two different code paths** update the same column depending on which fund it is. |

**Legacy Apps Script artifacts** (not part of the live payment path, but
present in the repo root and worth flagging as documentation/dead-code
clutter that could mislead a future agent): `payment-webhook.gs`,
`webhook-diagnostics.gs`, `test-webhook.gs`, `unified-fund-appscript.gs`,
`tech-fund-appscript.js`, `tech-fund-dynamic-appscript.js`,
`tech-fund-report-generator.gs`, `enhanced-christmasfund.gs`,
`appscript-doGet-church-contributions.gs`, `clean-up-sheet.gs`,
`migrate-dates.gs`, `set-razorpay-keys.gs`, and a long tail of
`TECH_FUND_*.md` / `*_SETUP*.md` files from the pre-D1 Google-Sheets era.
These still describe the **Google Sheets side** of the dual-webhook setup
(`docs/runbooks/razorpay-webhook.md` confirms Razorpay's real webhook still
points partly at Apps Script), so they are not dead — but they are 100%
two-fund-hardcoded and were out of scope to touch here per the "do not modify
payment behavior" rule.

---

## C. Existing reusable components

These are genuinely reusable and should **not** be rebuilt:

- **`funds` table + `functions/api/funds.js`** — already a real dynamic
  registry: slug, name, description, goal_amount, status (active/archived/
  deleted soft-delete), visibility (public/members), `is_system` flag that
  protects the two legacy funds from rename/delete. Full CRUD, member
  assignment (`fund_members`), audit-logged. This is the correct foundation
  for "admin creates a fund from the console" — it already does most of that
  for everything except payment routing and rich media/config.
- **`functions/api/_lib.js`** — `requireAuth(context, permission)`,
  `getPermissions()`, `resolveViewer()`, `audit()`, `json()`. Role/permission
  model (`roles` + `member_roles` tables, `VALID_PERMISSIONS` list in
  `roles.js`) already has `manage_funds` and `delete_funds` as distinct
  scopes — exactly the admin/high-privilege split the future system needs
  (church admin vs. fund maintainer vs. super admin maps cleanly onto more
  granular permission strings added to this same list).
- **`activity_logs` table + `audit()` helper** — generic audit log already
  used for every fund/contribution/config mutation. Directly satisfies the
  "audit logs" item in the broader product vision.
- **`contributions.fund` (free TEXT column)** — already fund-agnostic at the
  storage layer. `POST /api/contributions` (manual entry) already accepts and
  preserves an arbitrary fund slug via `normalizeFund()`'s fallthrough
  (`return fund || "tech-contributions"`) — the manual-entry path is closer
  to "dynamic funds work today" than the online path is.
- **`script.js`'s `initDashboard(dynamicFund)`** — already generalized (see
  commit `231f267`) to drive the whole public dashboard (goal bar,
  contributor list, purchases) from `/api/funds?slug=` instead of
  `/api/contributions?fund=`. This is the piece to build on for a unified
  dashboard, in preference to `initChristmasFundDashboard()`.
- **`event_photos` table + storage pattern** (`migrations/0011_events.sql`)
  — `storage TEXT DEFAULT 'r2'` with `'r2' | 'base64' | 'external'` values
  and an R2 bucket binding (`EVENT_PHOTOS` in `wrangler.jsonc`, with a
  documented base64 fallback when unbound). This is the exact pattern to
  reuse for "fund images" — no new storage design needed, just a
  `fund_photos`-shaped table or a `photo_url`/`storage` column pair on
  `funds`.
- **`config` table (key/value)** — already used for freeform pastor-editable
  content blobs (`about_content` is a whole JSON page stored as one config
  row, per `functions/api/settings.js`). The same pattern (a JSON blob
  column) is a reasonable low-migration-risk way to store a fund's
  prayer/message text or ranking configuration without a schema change per
  field.
- **`purchases` and `expenses` tables** — both already have a free-text
  `fund` column with the same "join by slug, not by foreign key" convention
  as `contributions`. Any new fund automatically gets expense/purchase
  tracking for free once contributions work.
- **CORS/OPTIONS handling, `json()` response helper, error-shape
  conventions** — consistent across every `functions/api/*.js` file; a new
  fund-scoped endpoint (e.g. per-fund Razorpay config) should follow the
  same shape.

---

## D. Current data model

```
funds                          contributions                    purchases
──────────────────────         ──────────────────────           ──────────────────
id (PK)                        id (PK)                          id (PK, TEXT e.g. "P004")
slug (UNIQUE) ◄─────────┐      member_name                      name
name                     │      amount                            amount
description              │      date                               date
goal_amount              │      category                          fund ─────────┐ (free TEXT,
status                   │      notes                              photo         │  joined by
visibility                │      proof_id (UNIQUE, nullable)       vendor        │  slug string,
is_system                 │      email / phone                     description   │  no FK)
created_by/at              │      fund ───────────────────────────┘ status       │
updated_by/at                │      created_by / updated_by         fund_contribution
                              │      is_deleted / deleted_at         external_contribution
                              │      created_at                     external_sources
                              │                                     created_by
fund_members                  │
──────────────                │      expenses (same "fund TEXT,
fund_id ──► funds.id ─────────┘        no FK" pattern)
member_id ──► members.id
added_by / added_at

members                        activity_logs                    config
──────────────                 ──────────────                   ──────────────
id (PK)                        id (PK)                          key (PK)
name (UNIQUE)                  actor_email / actor_type          value
email / phone                  action                            (tech_goal_amount,
is_verified                    entity_type / entity_id            christmas_goal_amount,
first_join_date                details (JSON)                     force_login,
recurring_reminders            ip / user_agent / verified          about_content, …)
family_id ──► families.id      created_at
relation / date_of_birth

roles                           member_roles
──────────────                  ──────────────
role_name (PK)                  email (PK)
permissions (JSON array)        role_name ──► roles.role_name
```

Key observations:
- **No foreign key constraints anywhere** in `schema.sql` except the two
  `event_photos`/`families`-adjacent ones. `contributions.fund`,
  `purchases.fund`, `expenses.fund` are all *joined by string equality*
  against `funds.slug`, not a real FK. This is actually convenient for a
  dynamic system (no migration needed to add a fund — a fresh slug just
  starts appearing), but it means nothing in the schema prevents a
  contribution row from pointing at a fund slug that was never registered
  (the `/api/verify` integrity check in §E below is the only thing that
  would catch this, and it's advisory/manual, not enforced).
- **No Razorpay-account concept anywhere in the schema.** No table or column
  stores a Razorpay key ID, key secret reference, or account identifier.
  Today's single Razorpay account is entirely implicit: one hardcoded client
  key (`razorpay-checkout.js`) and one webhook secret
  (`env.RAZORPAY_WEBHOOK_SECRET`, one value, one Cloudflare Pages
  environment).
- **No church/branch concept anywhere.** No table, column, or even a
  hardcoded string references "Church of Light", "City Worship Center",
  "Tirunelveli Church", or a generic "branch"/"church_id" foreign key. Funds
  are flat and ministry-wide today.
- **No image/media, prayer/message, or ranking-configuration columns** on
  `funds`. The public "Christmas Fund" hero image (if any) lives in static
  HTML/CSS, not in the fund's data.

---

## E. Razorpay architecture — exactly as it works today

**Where credentials live:**
- Client-side public key: hardcoded string literal in `razorpay-checkout.js`
  (`RAZORPAY_TEST_KEY_ID`, actually a live key — `rzp_live_STrG9mXFNPWfMM`).
  Public keys are safe to expose client-side by design (Razorpay's own
  model), so this isn't a secrecy problem, but it is a *single point*: one
  key for the whole site, committed to source control, not configuration.
- Server-side webhook secret: `env.RAZORPAY_WEBHOOK_SECRET`, a Cloudflare
  Pages environment variable (not in the repo), read in
  `functions/api/webhook.js`. One value, one environment.
- No key SECRET (as opposed to key ID) is present anywhere in this repo —
  correctly never was, per the comment in `razorpay-checkout.js`.

**How payment requests are created:**
There is **no server-side "create order" step**. `razorpay-checkout.js`
builds the Razorpay Checkout `options` object entirely in the browser
(amount, currency, name, description, notes) and opens the hosted Checkout
widget directly against the public key. Razorpay's own SDK collects the
payment; there is no `/api/create-order` endpoint in
`functions/api/` and no `razorpay_order_id` anywhere in this codebase. The
amount the payer is charged is therefore determined client-side, not
validated server-side before charging — this is a pre-existing
characteristic of the live system, unrelated to fund dynamism, and explicitly
out of scope to change here (§Non-negotiable safety rule).

**How the fund is identified:**
Purely by convention, via `notes.fundName` in the Checkout options
(`razorpay-checkout.js` line ~403-408), which Razorpay round-trips back
unmodified in the `payment.captured` webhook payload
(`payment.notes.fundName`). There is no cryptographic or server-verified
binding between "the page the payer was on" and "the fund the payment gets
recorded against" — it's whatever string the browser sent, echoed back.

**How webhook contributions are associated:**
`functions/api/webhook.js` reads `payment.notes.fundName`, runs it through
the hardcoded two-value normalizer (§B item 1), and inserts a `contributions`
row with that `fund` string. Idempotency is via `proof_id UNIQUE`
(`payment.id`) — a re-delivered webhook for the same payment is recognized
and ignored (both via a pre-check `SELECT` and, for the race condition, via
catching the `UNIQUE` constraint violation on `INSERT`).

**Whether webhook contributions are audited:**
Not via the `activity_logs` audit table — `webhook.js` does **not** call
`audit()`. The only audit trail for an online payment is the `contributions`
row itself (which carries no `created_by`/`updated_by`, those are
admin-manual-entry-only columns per migration 0012) plus whatever Razorpay's
own dashboard retains. Manual admin corrections to a contribution row **do**
go through `audit()` (`contribution.update` / `contribution.delete`
actions), and separately, `/api/verify` (`functions/api/verify.js`) provides
a read-only, on-demand reconciliation report (D1 vs. the Google Sheet, by
`proof_id` and fuzzy member/amount/date matching) — but that's a manual
diagnostic tool, not an automatic audit-on-every-payment.

**What prevents multiple Razorpay accounts today:**
Three independent single-points, all of which would need to become
per-fund-lookups instead of hardcoded/global values:
1. The client-side public key (`RAZORPAY_TEST_KEY_ID` constant) — would need
   to become "the key for *this* fund", fetched or embedded per fund.
2. The webhook secret (`env.RAZORPAY_WEBHOOK_SECRET`, one Cloudflare env
   var) — Razorpay signs each webhook with the secret configured *for that
   specific webhook URL/account* in the Razorpay dashboard. A second
   Razorpay account would need either a second webhook endpoint (e.g.
   `/api/webhook?account=B` or a distinct path) with its own secret, or a
   single endpoint that tries multiple known secrets until one verifies.
3. The fund-identification convention itself (`notes.fundName`) — works
   fine per-account, but nothing currently maps "this incoming webhook
   delivery" to "which Razorpay account (and therefore which secret) should
   verify it" before verification happens. `verifyRazorpaySignature()` is
   called with a single hardcoded secret before the payload is even parsed.

---

## F. Dynamic fund gap — summary

What's missing to make funds truly plug-and-play, distilled from A–E:

1. **Payment routing.** Online payments cannot target any fund except the
   two hardcoded ones. This is the one hard blocker; everything else is
   either already solved (`funds.js`) or a UI/reporting nicety.
2. **Per-fund Razorpay configuration.** No schema, no storage, no lookup
   path for "which key/secret/account does this fund use."
3. **Rich fund content.** No images/media, no prayer/message field, no
   ranking configuration on the `funds` table — admin can set name,
   description, goal, visibility, and that's the complete set today.
4. **Unified rendering.** Two hardcoded, duplicated dashboard pipelines
   (Tech, Christmas) vs. one generic pipeline for everything else; no
   per-fund visual identity (icon, theme color, hero image) beyond a fixed
   icon-rotation array in `funds.html`.
5. **Unified reporting.** Admin overview KPIs only aggregate the two legacy
   funds; dynamic funds are invisible to the top-level dashboard numbers.
6. **Church/branch context.** Entirely absent — funds have no
   church/branch association of any kind. Out of scope for this milestone
   per the task brief, but worth having in mind since goal_amount, ranking,
   and visibility may eventually need to be scoped per branch, not just
   per fund.
7. **Webhook audit trail.** Online payments never write to `activity_logs`;
   only manual admin edits do. Not fund-dynamism-specific, but relevant to
   the "transparent contribution tracking" and "audit logs" product goals.

---

## G. Proposed target architecture — **DECISION REQUIRED**

> Everything in this section is a **proposal for the owner/team to review and
> approve**, not a decision already made. Nothing here has been implemented.
> Marking clearly per task instructions: **DECISION REQUIRED** before any of
> this is built.

### CURRENT vs TARGET, condensed

| Aspect | CURRENT | TARGET (proposed) |
|---|---|---|
| Fund registration | `funds` table + `funds.js` CRUD — already dynamic | Keep as-is; extend columns (see below) |
| Fund content | name, description, goal, visibility | + `hero_image_url`/`storage`, `message` (JSON or TEXT), `ranking_config` (JSON) |
| Online payment routing | 2 hardcoded fund slugs in `webhook.js` and `razorpay-checkout.js` | Fund slug flows through unmodified; normalizer becomes "does this slug exist in `funds`?" instead of a 2-value allowlist |
| Razorpay account | 1 hardcoded client key + 1 env-var webhook secret | New `fund_razorpay_accounts` (or `razorpay_accounts` + FK from `funds`) table: `key_id`, a *reference* to a securely-stored secret (Cloudflare secret binding, not a DB column), `webhook_path` or `account_label` |
| Webhook verification | Single global secret tried once | Look up the right secret by whichever the payload/route identifies (see options below), *then* verify |
| Dashboard rendering | `initDashboard()` (generic) + `initChristmasFundDashboard()` (hardcoded duplicate) | Retire the duplicate function in favor of the generic pipeline for ALL funds, including the two legacy ones, once behind a flag and proven equivalent |
| Admin overview KPIs | Hardcoded fetch of 2 funds | Aggregate from `/api/funds` listing endpoint (already returns `totalCollected` per fund) |
| Fund images | None | Reuse the `event_photos` r2/base64/external pattern |

### Multi-Razorpay-account design options (needs an explicit decision)

Two realistic shapes, not mutually exclusive:

- **Option 1 — one webhook endpoint, secret lookup by fund.** Razorpay
  webhook payloads for `payment.captured` already carry `notes.fundName`
  (or would carry `notes.fundSlug`) *inside* the signed body. Problem: you
  must verify the signature *before* you can trust the body, but you need to
  know the body to know which secret to verify with. Workaround: either (a)
  maintain a small set of known secrets (one per Razorpay account) and try
  each until one verifies — fine while the number of Razorpay accounts stays
  small (as described in the task's example: 2 accounts, 3 funds) — or (b)
  give each Razorpay account its own webhook URL path (e.g.
  `/api/webhook/{accountSlug}`) so the secret is known from the route before
  parsing the body. **(b) is cleaner and scales better; recommend it.**
- **Option 2 — store the Razorpay key ID (not secret) on the `funds` row**
  so the checkout page looks up "which public key to construct Checkout
  with" per fund via the existing `/api/funds?slug=` detail payload. This is
  low-risk (public keys are not secret) and can ship independently of the
  webhook-secret-routing decision.

Recommendation: implement Option 2 first (low risk, immediately gets "Fund A
→ Account A, Fund B → Account B" working end-to-end for the *checkout* half)
and Option 1(b) for the webhook half, once there are ≥2 real Razorpay
accounts to route between — no need to build multi-secret webhook routing
speculatively before it's needed.

### Fund-content schema addition (additive-only, per CONTRIBUTING.md §4)

Proposed new nullable columns on `funds` (illustrative — needs sign-off, not
a committed migration):

```sql
ALTER TABLE funds ADD COLUMN hero_image_url TEXT;
ALTER TABLE funds ADD COLUMN hero_image_storage TEXT DEFAULT 'external'; -- 'r2' | 'base64' | 'external'
ALTER TABLE funds ADD COLUMN message TEXT;            -- prayer/message, plain text or Markdown
ALTER TABLE funds ADD COLUMN ranking_config TEXT;      -- JSON blob, e.g. {"enabled":true,"anonymize":false}
ALTER TABLE funds ADD COLUMN razorpay_key_id TEXT;     -- public key ID only; secrets never stored in D1
```

---

## H. Migration strategy — Christmas/Tech Fund → dynamic, without breaking live payments

Both legacy funds are **already rows in the `funds` table** with `is_system=1`
(seeded by `migrations/0002_dynamic_funds_audit.sql`, confirmed live and
tested — `tests/regression/schema-contract.test.mjs`: "the two legacy system
funds are seeded and marked is_system"). The data-model migration is
essentially **done**. What remains is entirely in the *code paths*, not the
data:

1. **Do not change `contributions.fund` values.** Every existing row's
   `fund = 'tech-contributions'` or `'christmas-fund'` stays exactly as-is.
   The slugs themselves become "just another fund slug" rather than special
   strings — no renaming, no backfill needed.
2. **Widen the webhook normalizer incrementally, behind verification.**
   Replace the hardcoded 2-value allowlist in `webhook.js` with "look up the
   incoming (normalized) slug against `funds` where `status='active'`; if
   found, use it; else keep today's fallback to `tech-contributions`." This
   is additive — the two existing slugs still resolve exactly as before
   (they're rows in `funds`), and only *new, real, active* fund slugs gain
   new behavior. No existing payment path changes behavior for existing
   funds.
3. **Same widening for `razorpay-checkout.js`'s `fundDisplayName()`** — swap
   the two-string ternary for a fund-name lookup (e.g. from a small
   client-fetched `/api/funds` cache, already loaded elsewhere on these
   pages) with the current two-fund behavior as the fallback when the lookup
   fails or hasn't loaded yet. `tests/frontend/razorpay-fund-label.test.mjs`
   would need its "unknown fund falls back to Tech Fund" assertion updated
   to match the new intended behavior — the mutation-testing step in
   CONTRIBUTING.md §5 applies here since this touches the frozen giving path.
4. **Retire `initChristmasFundDashboard()` last, and only after** the
   generic `initDashboard()` pipeline is proven to render Christmas Fund
   identically (same heading, same seasonal styling hook if any) — ideally
   behind the same feature-flag mechanism already used for the v2 flow
   (`docs/milestone-v2/README.md` mentions a feature-flag pattern in use).
5. **`funds.html`'s two static cards** can be replaced by fully data-driven
   cards (reading name/description/status from `/api/funds`) in the same
   change that adds `hero_image_url` etc., since at that point there's a
   reason for the static cards to diverge from live data (an admin edit
   wouldn't show up otherwise) — but this is cosmetic and low-risk, doable
   any time.
6. **Nothing about `proof_id` uniqueness, idempotency, or the D1-first
   Sheets-forwarding order (documented in `docs/runbooks/razorpay-webhook.md`)
   changes.** Multi-Razorpay-account work only touches *which secret verifies
   a delivery* and *which fund a contribution is filed under* — not the
   insert/idempotency/audit shape of `contributions`.

Each step above should ship independently, behind tests, with the
mutation-testing sanity check from CONTRIBUTING.md §5 (temporarily break the
new lookup, confirm the relevant test fails, revert, confirm green) since
every one of them touches `webhook.js`, `contributions.js`, or
`razorpay-checkout.js` — all named explicitly in CONTRIBUTING.md §3 as the
frozen giving/money path.

---

## I. Risks

- **Payment regression.** `webhook.js` and `razorpay-checkout.js` are the
  highest-blast-radius files in the repo — a bug in the widened fund-lookup
  could misfile *every* future payment, not just new-fund ones, if the
  fallback logic is inverted or the lookup query is wrong. Mandates the
  mutation-testing step, not just new happy-path tests.
- **Existing contribution data.** ~None at risk from this specific change —
  no plan here touches existing rows or the `fund` values already stored.
  Risk is purely in *new* inserts being misrouted.
- **Webhook compatibility.** If multi-account routing moves to per-account
  webhook URLs (Option 1b in §G), the *existing* webhook URL
  (`/api/webhook`) and its currently-configured secret must keep working
  unchanged for the current (only) Razorpay account — a new URL is additive,
  not a replacement.
- **Existing URLs / frontend links.** `index.html?fund=tech-contributions`
  and `?fund=christmas-fund` (and bare `?fund=tech` / `?fund=christmas`
  aliases) are almost certainly bookmarked/shared externally (WhatsApp
  messages, etc. — see `WEBSITE_SHARING_MESSAGE.md` in the repo root). Any
  change must keep every existing alias resolving exactly as today.
- **Existing donor records.** `members` table has no fund association at
  all (member existence is global, not per-fund) — no risk here from fund
  changes specifically.
- **Production migration execution.** Per CONTRIBUTING.md §4, any schema
  change is applied manually via `.github/workflows/apply-d1-migration.yml`
  with no automated review — a human must re-read the SQL slowly before
  dispatch. The proposed `ALTER TABLE funds ADD COLUMN …` statements in §G
  are individually low-risk (nullable, additive) but should still go through
  that manual dispatch discipline, one at a time.
- **Authentication/authorization.** `manage_funds` currently gates both
  "create a fund" and "edit a fund's goal", while `delete_funds` gates
  deletion — a genuinely separate scope already. Adding Razorpay
  configuration to a fund is a *more* sensitive operation than editing a
  description (it can redirect real money) — recommend gating
  Razorpay-config writes behind a new, narrower permission scope (e.g.
  `manage_fund_payments`) rather than reusing `manage_funds`, so a "fund
  maintainer" role (mentioned in the product vision) can manage content
  without being able to redirect payment routing.
- **Secret storage.** Razorpay key *secrets* (as opposed to key IDs) must
  never be stored in the `funds` table or any D1 column readable via
  `/api/funds` — D1 rows are returned in API responses read by
  authenticated (and in the public-listing case, anonymous) callers. Secrets
  belong in Cloudflare Pages environment variables / secrets, referenced by
  name/label from the DB, never stored as values in the DB.

---

## J. Recommended implementation phases (future work — not started)

Each phase is sized to be independently assignable, testable, and mergeable
without the others, per CONTRIBUTING.md's "every endpoint change ships tests
in the same change" rule.

1. **Phase 1 — Fund content schema.** Additive columns on `funds`
   (`hero_image_url`, `hero_image_storage`, `message`, `ranking_config`,
   `razorpay_key_id`), plus `funds.js` GET/PUT support for the new fields.
   No payment-path changes. Lowest risk, ships independently.
2. **Phase 2 — Admin UI for fund content.** Extend the `admin.html` Funds
   tab form to edit the new fields (reusing the `event_photos` upload
   pattern for images). No payment-path changes.
3. **Phase 3 — Public rendering unification.** Retire
   `initChristmasFundDashboard()` in favor of `initDashboard()` for all
   funds, behind a flag, with a regression test proving byte-identical (or
   deliberately, visibly reviewed) output for the two legacy funds first.
   `funds.html`'s static cards become fully data-driven in the same phase.
4. **Phase 4 — Checkout-side per-fund Razorpay key.** `razorpay-checkout.js`
   reads `razorpay_key_id` from the fund's `/api/funds?slug=` payload
   instead of the hardcoded constant, falling back to the current constant
   when the field is empty (so the two legacy funds are unaffected until
   explicitly configured otherwise). Mutation-tested per CONTRIBUTING.md §5.
5. **Phase 5 — Webhook-side dynamic fund lookup.** Replace the two-value
   allowlist in `webhook.js` with an active-funds lookup, fallback preserved.
   This is the phase that actually unblocks "a payment can land against a
   new fund." Highest scrutiny, mutation-tested, extra review per
   CONTRIBUTING.md §4's migration-review guidance applied to the code review
   itself given the blast radius.
6. **Phase 6 — Multi-Razorpay-account webhook routing.** Only once ≥2 real
   Razorpay accounts exist to route between (per the task's own framing:
   "Currently we have only ONE Razorpay account" — this phase has no
   concrete requirement to satisfy yet). Implements Option 1(b) from §G.
7. **Phase 7 — Admin overview KPI aggregation fix.** Make `admin.html`'s
   `loadOverview()` sum all active funds (via `/api/funds`) instead of the
   two hardcoded fetches. Independent of all payment-path phases; can ship
   any time, including before Phase 1.
8. **Phase 8 (explicitly out of scope per task brief, listed for context
   only) — church/branch association.** Not designed here at all; flagged
   only because `ranking_config` and `visibility` may eventually need a
   branch dimension. Needs its own PRD/TRD before any schema work.

Each phase should independently follow the 6-document milestone ritual in
`CLAUDE.md` if it's judged "major" — Phases 4–6 (anything touching
`webhook.js`/`razorpay-checkout.js`) almost certainly qualify given
CONTRIBUTING.md's framing of that code as the frozen giving/money path.
