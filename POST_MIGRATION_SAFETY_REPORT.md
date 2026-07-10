# Post-Migration Safety Report

Date: 2026-07-08 · Branch: `claude/post-migration-safety-check-kf6gb4`

Last night's migration moved real contributor data from Google Sheets (Apps Script)
into Cloudflare D1 (`ljm-contributions-db`). This report documents the full system
flow, the safety tooling added on this branch, the fixes applied, how to verify
production, and the issues that remain open.

---

## 1. End-to-end flow (as verified in code)

**Public read path** — `index.html`/`script.js`, `funds.html`, `members.html`,
`impact.js` all read from D1 via `GET /api/contributions?fund=…`, `/api/funds`,
`/api/wishlist`. Exception: `member.html` → `member-dashboard.js` still reads the
legacy Apps Script directly (not yet migrated — see §5).

**Payment path** — `razorpay-checkout.js` opens Razorpay Checkout entirely
client-side (no server order creation). Persistence happens only via the Razorpay
webhook: `POST /api/webhook` verifies the HMAC-SHA256 signature, inserts into D1
`contributions` (idempotent on `proof_id`), upserts `members`, then asynchronously
mirrors the raw event to the Apps Script so the Google Sheet stays in sync.
**The system is dual-write: the Sheet is still live and receiving every payment.**

**Auth** — Members sign in with Google (GSI); `POST /api/auth` verifies the token
server-side. Admin APIs use `requireAuth()` in `functions/api/_lib.js`: Google ID
token (verified), `ADMIN_API_TOKEN` machine token, or (now disabled by default) a
legacy plain-email token. Permissions come from `roles`/`member_roles` in D1,
with three hardcoded super-admin emails as bootstrap.

**Migration** — `GET /api/migrate` pulled JSON from the live Apps Script and did
`INSERT OR IGNORE` into D1. Self-reported result: 196 contributions, 33 members,
5 purchases. That count came from the importer itself; independent reconciliation
did not exist until this branch (see §2). Live sheet counts observed on 2026-07-08:
tech = 93 rows / ₹31,217, christmas = 104 rows / ₹23,400 (197 total — run
`/api/verify` in production to reconcile row-by-row against D1).

---

## 2. New: `GET /api/verify` — read-only data-integrity audit

`functions/api/verify.js`. Admin-only (`view_members` scope). **Never writes to
any data table** (only one audit-log row). ~20 checks, each `pass`/`warn`/`fail`:

- **Schema**: all 10 required tables exist (catches migration `0002` not applied
  on remote D1); `members.first_join_date`/`recurring_reminders` columns; system
  funds seeded.
- **Integrity**: duplicate suspects among no-`proof_id` rows (same fund + member +
  amount + day); contributors missing from `members`; contribution rows pointing
  at unregistered fund slugs; orphaned `fund_members`.
- **Sanity**: amounts outside ₹1–₹5,00,000; malformed or future dates; duplicate
  member emails (account-linking keys on email).
- **Reconciliation vs the live Google Sheet** (the migration source): row-by-row
  matching by Razorpay `proof_id`, falling back to (member, amount, day); per-fund
  amount totals; purchases count; every sheet member present in D1.
  Pass `?skipRemote=1` for D1-only checks.

**Usage** (after deploy, as an admin):
```
GET https://<site>/api/verify            → full audit incl. sheet reconciliation
GET https://<site>/api/verify?skipRemote=1 → D1-internal checks only
```
`success: true` means zero `fail` checks. `warn` items need human review (e.g.
the known NULL-proof_id duplicates from the pre-migration sheet era).

Verified locally against a seeded D1 with planted anomalies — it caught the
duplicate cash rows, the orphan contributor, and the future-dated row, and the
live-sheet reconciliation correctly failed against a non-matching database.

## 3. Self-test expanded: 17 → 27 cases

`functions/api/selftest.js` (`GET /api/selftest`, super-admin). New cases, all
non-mutating or using auto-cleaned `zz-selftest`/`TEST-` marker entities:

- webhook: unsigned request rejected (400)
- migrate endpoint fail-closed without secret (401/403, never 200)
- unauthenticated reads blocked: `/api/members`, `/api/logs`
- unauthenticated writes blocked: `PUT /api/settings`, purchases mutation
- legacy plain-email token rejected (auto-skips if explicitly re-enabled)
- role save rejects unknown permission names
- built-in `super_admin` role locked against API edits
- `/api/verify?skipRemote=1` reports zero failures

Local run: **27/27 passed** (wrangler pages dev + local D1). Cleanup now also
removes selftest roles/config probes and defensively restores the canonical
`super_admin` permission set.

## 4. Fixes applied on this branch

| # | File | Fix |
|---|------|-----|
| 1 | `functions/api/_lib.js` | **Legacy plain-email admin token disabled by default.** Previously any request with `?token=<admin email>` was accepted as that admin, unverified — full admin API access to anyone who knew an email address. Re-enable temporarily with env `ALLOW_LEGACY_EMAIL_TOKEN=true` if a workflow still needs it. |
| 2 | `functions/api/migrate.js` | **Fail closed.** With `MIGRATION_SECRET` unset the endpoint used to run unauthenticated; now it returns 403 unless the secret is both configured and presented. |
| 3 | `functions/api/webhook.js` | **Duplicate-delivery race.** Two simultaneous deliveries of the same payment made the loser 500 on the UNIQUE constraint, so Razorpay kept retrying an already-recorded payment. Now acknowledged with 200 "Duplicate payment ignored". |
| 4 | `functions/api/roles.js` | `save_role` now validates permission names against the known scope list (was: any JSON accepted → privilege escalation for `manage_roles` holders) and refuses to modify the built-in `super_admin` role. |
| 5 | `functions/api/funds.js` | Members-only fund detail returned 403 to the machine `ADMIN_API_TOKEN` (the `manage_funds` fallback was nested inside the has-email branch). Also gated the legacy-email viewer path behind the same env flag as #1. |

Webhook end-to-end verified locally with real HMAC signatures: valid payment →
one row (paise→INR and fund normalization correct); duplicate delivery → 200,
still one row; tampered body → 400.

### ⚠ Action needed on deploy
- If any admin workflow still passes a **plain email as token** (e.g. the
  admin.html dev-login fallback), it stops working. Sign in with Google, use
  `ADMIN_API_TOKEN`, or set `ALLOW_LEGACY_EMAIL_TOKEN=true` while transitioning.
- `MIGRATION_SECRET`: either set it in Pages env (to keep `/api/migrate` usable)
  or leave unset — the endpoint is now safely disabled without it.

## 5. Production verification runbook

1. Merge/deploy this branch.
2. Confirm migration `0002` on remote D1 (pending in task.md):
   `npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0002_dynamic_funds_audit.sql`
   (a re-run fails only on the final two ALTERs — harmless).
3. **Back up prod D1 before any cleanup**:
   `npx wrangler d1 export ljm-contributions-db --remote --output=backup-$(date +%F).sql`
4. As admin: `GET /api/verify` → expect all reconciliation checks to pass
   (sheet vs D1 row counts, amount totals, members). Investigate any `fail`
   immediately; triage `warn` items (expected: NULL-proof_id duplicate suspects,
   missing `first_join_date` backfill).
5. As admin: `GET /api/selftest` → expect **27/27**.
6. Only after `/api/verify` is clean, do the pending data cleanup (dedupe
   NULL-proof_id duplicates, backfill `first_join_date`) and re-run `/api/verify`.

## 6. Known issues still open (ranked)

1. **Dual-write divergence risk** — every payment writes D1 then best-effort
   syncs to Sheets; a failed sync silently diverges the two. Mitigation: run
   `/api/verify` on a schedule until the Sheets side is retired.
2. **`member.html` still reads the legacy Apps Script** — migrate it to
   `/api/contributions` (or `/api/funds?slug=`) so members see D1 data.
3. **Apps Script webhook is fail-open** (`payment-webhook.gs`): signature check
   skipped when secret unset, bypassable via `?secret=`/`isLocalTest`, and its
   duplicate check scans only the last 50 rows and fails open. Low priority once
   the Sheet is read-only, but worth hardening while dual-write continues.
4. **Member identity is the name string** — contributions join members by exact
   name; a rename orphans history, a name collision merges two people. Also
   `PUT /api/auth` lets a signed-in Google user claim any unclaimed member name.
   Longer-term: member_id foreign keys + explicit claim approval.
5. **Money stored as REAL (float)** — rupee totals accumulate float error;
   consider migrating to integer paise.
6. **No rate limiting** on auth or public ingest (`POST /api/logs`).
7. **Purchases mutations ride on GET** with no input validation (`/api/purchases?action=…`).
8. `admin-session.js` ships an HMAC "secret" in client JS — cosmetic only (server
   re-verifies), but it implies security it doesn't provide; drop or rework.
9. `roles.js` returns HTTP 200 with `success:false` on auth failures — should be 401.
10. Dead files: ` fundData.js` (leading space in name), `fund-dashboard.js`,
    `members.js` — unreferenced, all still carrying old Apps Script URLs.
