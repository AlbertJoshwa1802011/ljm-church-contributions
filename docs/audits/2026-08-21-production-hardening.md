# 2026-08-21 — Overnight production-hardening audit

**Branch:** `claude/ljm-v2-ui-ux-testing-2o71vs`
**Scope:** Full-repo security/integrity audit following the completed LJM V2
UI/UX testing pass (8 UI bugs fixed, 397/397 tests passing at the start of
this session). This document records what was audited, what was found, what
was fixed, and what was deliberately left alone.

**Method:** Live testing against `wrangler pages dev` + local D1 (direct
`curl` calls with missing/malformed/legacy tokens), full source review of
every `functions/api/*.js` endpoint's auth/authz, and `node --test` against
the real handler code via `tests/helpers/mock-d1.mjs`. Every fix below was
verified with a **mutation test**: the fix was temporarily reverted, the new
regression test was confirmed to fail, then the fix was restored and the
suite re-confirmed green — per `CONTRIBUTING.md` §5's requirement for any
change touching money-adjacent code.

---

## 1. What was audited

- **Authentication** (`functions/api/_lib.js`, `auth.js`): Google ID token
  verification (audience/issuer/expiration), the legacy plain-email token
  fallback, session lifecycle in `admin.html` (sessionStorage, logout,
  401-triggered re-auth).
- **Authorization**: every `requireAuth()` call across all 30
  `functions/api/*.js` files, checked against what permission the operation
  actually requires; direct `curl` calls bypassing the UI entirely.
- **Data isolation**: fund `visibility='members'` assignment checks; no
  church/branch multi-tenancy exists in this codebase (see §5 below — this
  is documented, not invented).
- **Database integrity**: `schema.sql` constraints/indexes/FKs; the
  `contributions.proof_id UNIQUE` idempotency guarantee; a concurrency probe
  against the webhook's contribution + member-upsert path.
- **Payment/webhook integrity**: `functions/api/webhook.js` signature
  verification, idempotency, and the client-side Razorpay success handler
  (`razorpay-checkout.js`) for authoritative-confirmation assumptions.
- **API hardening / XSS**: spot-checked `innerHTML` call sites in
  `admin.html` that render database content (funds, members, families,
  purchases, contributions, testimonies — all already `esc()`-wrapped).
- **Admin/environment safety**: re-swept for hardcoded production URLs or
  `localhost`-special-casing beyond the `theme.js` redirect fixed in the
  prior UI/UX session.
- **Deployment config**: `wrangler.jsonc`'s committed `vars` block (the
  actual deployed Cloudflare Pages config — no environment-scoped override
  exists in this repo).

## 2. Findings — fixed

### 2.1 CRITICAL — `ALLOW_LEGACY_EMAIL_TOKEN=true` was live in the deployed config
**File:** `wrangler.jsonc`. **Not a frozen file itself, but the vulnerability
it re-enabled lives in the frozen `functions/api/_lib.js`.**

`wrangler.jsonc`'s top-level `vars` block (the actual config Cloudflare Pages
deploys — there is no `env.production`/`env.preview` split in this repo) set
`ALLOW_LEGACY_EMAIL_TOKEN: "true"`. Per `functions/api/_lib.js`'s
`requireAuth()`, that flag makes **any plain email string** sent as
`Authorization: Bearer <email>` a fully-authenticated identity, with zero
proof of ownership. `POST_MIGRATION_SAFETY_REPORT.md` §4 already documents
this exact flag as "disabled by default" for precisely this reason ("full
admin API access to anyone who knew an email address") — and the three
super-admin emails it unlocks are hardcoded in this same public repo
(`_lib.js`, `admin-session.js`). `task.md` even has an unchecked reminder
about this ("Production admins sign in with Google — no env flag needed"),
never actioned.

**Impact if left as-is:** anyone who can read this repository (public or
leaked) could `curl -H "Authorization: Bearer albertjoshrock101@gmail.com"`
the live production API and get full super-admin access — read/write every
member, contribution, fund; delete data — with zero authentication.

**Fix:** removed the flag from the committed `vars` block; added
`.dev.vars.example` + a `.gitignore` entry for `.dev.vars` so local
development still works via `npx wrangler pages dev . --binding
ALLOW_LEGACY_EMAIL_TOKEN=true` or a git-ignored `.dev.vars` file, without it
ever reaching the deployed config again.

**Verified live:** confirmed the local dev server rejects a legacy email
token by default with this config, and works normally when the flag is
passed explicitly on the CLI.

**Test:** `tests/regression/wrangler-config-safety.test.mjs` (parses the real
`wrangler.jsonc`, fails if the flag — or any similarly-named bypass flag —
is ever "true" again).

### 2.2 HIGH — Google ID token audience validation was optional
**Files:** `functions/api/_lib.js`, `functions/api/auth.js` (both frozen).

`verifyGoogleToken()` only checked `payload.aud !== clientID` **when**
`env.GOOGLE_CLIENT_ID` was configured — with it unset (no trace of it in the
repo's committed config), the check was skipped entirely. Google's own OAuth
guidance requires validating `aud` specifically to prevent "token confusion"
attacks: a Google ID token minted for a **different** OAuth client (any
other "Sign in with Google" integration) would still pass verification here
as long as it was genuinely Google-signed and unexpired.

**Fix:** added `DEFAULT_GOOGLE_CLIENT_ID` (the app's real, already
client-side-public client ID — confirmed as the *only* client ID used
anywhere in this codebase, in `admin.html` and `v2/auth.js`) as the fallback
audience whenever `env.GOOGLE_CLIENT_ID` isn't set, so the check is never
skippable.

**Test fixture fallout:** 8 existing tests stubbed a Google response with no
`aud` claim at all, relying on the old "skip the check" behavior. Fixed each
fixture to include `aud: DEFAULT_GOOGLE_CLIENT_ID`, matching what a real
production token actually carries — not a weakened assertion.

**Tests:** `tests/api/_lib.test.mjs` (2 new tests: mismatched-audience
rejected even with no `GOOGLE_CLIENT_ID` configured; matching-audience still
accepted).

### 2.3 HIGH — `/api/contributions` leaked the full congregation's email/phone directory
**File:** `functions/api/contributions.js` (frozen — CONTRIBUTING.md §3
explicitly names this file's "read model").

The public, **unauthenticated** GET (the giving-transparency dashboard's
data source — Member/Amount/Date/Category being public is the product's
intentional design) also unconditionally returned:
- Each contribution's raw `Email`/`Phone`.
- A `memberEmails`/`memberPhones` directory mapping **every member's name**
  (not just contributors to the requested fund) to their real email/phone.

Neither is ever rendered by any public page — `script.js` only reads
`memberEmails`/`memberPhones` as a **truthy presence check** for a
"✅ Verified Profile" badge, never the value; nothing reads a contribution's
`Email`/`Phone` client-side at all. So this was pure, unnecessary exposure:
anyone could scrape a full name→email→phone directory of the entire
congregation, plus every individual's giving history, from one
unauthenticated request.

**Fix:** gated real values behind the same best-effort `requireAuth(context)`
(no specific permission — "any recognized admin") already used for the
`includeDeleted` flag. Public callers now get `memberEmails[name] === true`
(presence only) and no `Email`/`Phone` on contribution rows.
`admin.html`'s contribution-edit-form prefill (which needs the real values)
is unaffected — it authenticates as admin.

**Tests:** 2 new tests in `tests/api/contributions.test.mjs` (public caller
gets booleans/omitted fields; admin caller still gets real values). Mutation
test confirmed and reverted correctly.

### 2.4 HIGH — Same leak in `/api/funds`'s public fund-detail endpoint
**File:** `functions/api/funds.js` (not frozen).

Identical pattern to §2.3, in the "legacy contract" fund-detail payload
(`?slug=`), plus `assignedMembers` additionally carried each assigned
member's real email with **no auth check of any kind** — not even the
partial protection contributions.js had.

**Fix:** same approach — an `isAdminViewer` best-effort auth check gates
`Email`/`Phone` on contributions, `memberEmails`/`memberPhones` (booleans for
non-admins), and `assignedMembers`' `email` field (omitted for non-admins).

**Tests:** 2 new tests in `tests/api/funds.test.mjs`. Mutation-tested.

### 2.5 MEDIUM — `/api/purchases` leaked the logging admin's email publicly
**File:** `functions/api/purchases.js` (frozen).

The public purchases listing (read by `/impact.html`) included `createdBy`
(the staff email who logged the purchase) — never rendered on any public
page, only in `admin.html`'s purchases table. A minor but real staff-PII
exposure (these could be non-super-admin staff whose emails aren't
otherwise public).

**Fix:** same best-effort-auth-gate pattern; `createdBy` omitted for
anonymous callers, present for admin.html's authenticated calls.

**Test:** 1 new test in `tests/api/purchases.test.mjs`. Mutation-tested.

### 2.6 MEDIUM — `/api/members` write endpoints used the wrong permission scope
**File:** `functions/api/members.js` (not frozen).

`POST`/`PUT` (create/edit a member) required only `view_members` — a
**read**-scoped permission — instead of `manage_members`, the distinct
write-scoped permission that already exists (in `roles.js`'s
`VALID_PERMISSIONS`, the admin Roles editor, and correctly used by
`families.js`'s own write endpoints). A role deliberately granted
read-only member lookup could also create/edit member records.

**Fix:** changed both to require `manage_members`, matching the established
correct convention. `super_admin` already holds both scopes, so the default
admin identity is unaffected; only a narrowly-scoped read-only role loses
the write access it should never have had.

**Tests:** 3 new tests in `tests/api/members.test.mjs` (view_members-only
role rejected from POST/PUT; manage_members-only role succeeds at both).
Mutation-tested.

## 3. Findings — documented, not fixed

### 3.1 Theoretical webhook race: concurrent first-time givers sharing a member name
**File:** `functions/api/webhook.js` (frozen, otherwise verified correct —
see §4).

`onRequestPost`'s member-upsert (`SELECT` then conditionally `INSERT`) sits
inside the **same** `try/catch` block as the contribution insert, and that
catch classifies *any* `UNIQUE|constraint`-matching error as "Duplicate
payment ignored" (200). `members.name` has a `UNIQUE NOT NULL` constraint.
If two different, genuinely new payments (different `proof_id`s) arrive
concurrently for members sharing the same name — most plausibly two
different anonymous givers, since `memberName` defaults to `"Anonymous"` —
the second request's member-`INSERT` could hit the `UNIQUE` constraint
*after* its own contribution row was already correctly saved, and the
response would misleadingly say "Duplicate payment ignored" even though the
gift **was** recorded.

**Financial-integrity impact: none observed.** The contribution row is
inserted before the member-upsert step, so no money/gift is lost or
double-counted in this scenario — only the response message could be
misleading in a genuinely rare race.

**Why not fixed:** I attempted to reproduce this with a concurrent-request
test (`Promise.all` of two "Anonymous" first-time givers with different
`proof_id`s) against the real handler and the test-harness's synchronous
`node:sqlite` mock. The race did not manifest — the mock DB's execution
model doesn't interleave the two requests at the vulnerable point, so I
could not produce a **failing** test to prove the fix, which
`CONTRIBUTING.md` §5 requires before touching this frozen, money-critical
file ("prove your test actually catches a regression, not just that it
passes today"). Per this session's explicit instruction to not guess on
ambiguous/unproven changes to frozen files, this is documented here as a
known, low-severity, unproven risk rather than patched speculatively.
**Recommended follow-up:** if this is worth closing, the safe fix is to move
the member-upsert into its own `try/catch` that doesn't affect the
contribution-insert's success/duplicate classification — but do it with a
concurrency-testing harness (e.g. a real Miniflare/Workers runtime, not the
synchronous SQLite mock) that can actually reproduce the race first.

### 3.2 No church/branch data-isolation model exists
This codebase has no multi-tenant/branch concept — "Church of Light" and
"City Worship Center" are two rows in a `churches` table used for
categorization (programs, events), not security boundaries. There is
nothing to horizontally- or vertically-escalate across, because no
per-church access restriction was ever implemented. Documenting this
explicitly per the audit brief's instruction not to invent isolation
requirements that don't exist in the repo.

### 3.3 `fund_members` has no FK to `funds`/`members`
`fund_members(fund_id, member_id)` has a composite `PRIMARY KEY` (correctly
preventing duplicate assignments) but no `FOREIGN KEY` constraint. In
practice `funds.js`'s `add_member` action only ever receives IDs the admin
UI itself supplied from a real list, so this is low-risk, but a `FOREIGN KEY
... ON DELETE CASCADE` (matching the pattern already used for
`member_roles → roles`) would be a reasonable, low-risk additive migration
if this becomes a priority.

## 4. Payment/webhook integrity — verified, not rewritten

Per the audit brief's explicit instruction ("if the current implementation
is already correct, do not rewrite it — add tests and document the
evidence"):

- **Signature verification**: real HMAC-SHA256 via Web Crypto
  (`crypto.subtle.verify`), correctly rejects missing, garbled, and
  tampered-payload signatures. Confirmed with a new test that signs one
  payload and replays the signature against a **different** (tampered)
  amount — correctly rejected.
- **Idempotency**: `proof_id UNIQUE` + a `SELECT`-then-`INSERT` check +
  a `catch` for the concurrent-delivery race (the `UNIQUE` constraint
  violation is caught and acknowledged 200, not 500 — verified this
  actually triggers under `Promise.all([...])` in the new concurrent-webhook
  test, recording exactly one row for two simultaneous deliveries of the
  same payment).
- **Client never asserts financial truth**: `razorpay-checkout.js`'s
  success `handler` shows a "Thank you… will reflect shortly" message and
  reloads the page after a delay — it never writes to D1 directly. The only
  authoritative write path is the signature-verified webhook. This already
  matches "never trust browser payment success as authoritative
  confirmation."
- **Fail-closed on missing secret**: `verifyRazorpaySignature` returns
  `false` (→ 400) when `RAZORPAY_WEBHOOK_SECRET` is unset, consistent with
  `migrate.js`'s `MIGRATION_SECRET` fail-closed pattern.

New tests added (no source change): missing-signature rejection,
tampered-payload rejection, concurrent-duplicate-delivery idempotency.

## 5. Test suite

- Before this session: 397/397.
- After: **412/412**, run twice, clean.
- 15 new/modified test files; 1 new regression test file
  (`tests/regression/wrangler-config-safety.test.mjs`).
- Every fix in §2 was mutation-tested: revert the fix → confirm the new test
  fails → restore the fix → confirm green.

## 6. Frozen-file compliance

Files this session actually modified: `functions/api/_lib.js`,
`functions/api/auth.js`, `functions/api/contributions.js`,
`functions/api/purchases.js` — all four are on the repo's established
frozen list. Each change above is documented with its reasoning, kept
minimal (no unrelated refactoring), and mutation-tested per CONTRIBUTING.md
§5. `functions/api/webhook.js`, `functions/api/verify.js`,
`razorpay-checkout.js`, and `functions/api/roles.js` are **byte-for-byte
unchanged** (verified via `git diff --stat`).

## 7. Remaining risks / known limitations

- §3.1 (webhook member-upsert race) — documented, not fixed; see above.
- §3.3 (`fund_members` missing FK) — low-risk, not fixed.
- No formal `npm run test:e2e` exists; the UI/UX session's Playwright work
  was ad hoc and not committed as a reusable harness. Given this session's
  time budget was spent on the security audit (the higher-priority mandate
  for this session), formalizing E2E automation was not attempted here —
  see the final report's recommended follow-up.
- `GOOGLE_CLIENT_ID` is still not present in the repo's committed config;
  the fallback in §2.2 closes the practical gap, but if the real Cloudflare
  Pages dashboard has never had it configured either, this repo can't
  verify that from here — worth a manual dashboard check.
- This audit did not attempt a live penetration test against the real
  production deployment (out of scope — "do not touch production").
  Findings are based on source review and local `wrangler pages dev`
  testing only.
