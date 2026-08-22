# LJM V2 — Release Verification

**Date:** 2026-08-22
**Verified by:** Claude (final release agent pass)

## Release branch / commits

- Working branch: `claude/ljm-v2-final-release-aybxw6`
- At session start this branch, `main`, and `origin/main` were already
  identical at `7772abc` — **V2 is already merged to `main`**. There was no
  pending PR and no divergent release branch to reconcile; the historical
  landing happened incrementally through PRs #16–#21 (contribution manual
  entry, beta-flow port) plus direct pushes for the Phase 0–5 ministry
  content build (churches/promises/testimonies/prayer/contact/programs/blog).
- V2 boundary used for this review: `1093ddc` (pre-V2 baseline, the commit
  before beta-flow work started) → `7772abc` (current HEAD).
- This verification pass added no functional code changes — see §9.

## V2 scope (what actually changed, `1093ddc..7772abc`)

66 files changed, +9004 / -139 lines:

- **Flag-gated beta flow**: `functions/_middleware.js`, `functions/api/_beta.js`,
  new `/v2/index.html`, `/v2/our-giving.html`, `/v2/events.html`,
  `/v2/give-flow.html`, `/v2/my-giving.html` (ports of the existing pages onto
  real data, gated by a signed cookie).
- **Ministry content platform** (new tables + endpoints + admin panels +
  public pages): churches, promises, testimonies, prayer requests, contact
  messages, programs, blog posts, plus a `church_id`/beneficiary extension to
  `events`.
- **Manual contribution entry**: `functions/api/contributions.js` gained
  `POST`/`PUT`/soft-`DELETE`, restricted to a hard-coded single-admin
  allowlist on top of the existing `requireAuth`, for recording cash gifts
  that never went through Razorpay.
- **A real production bug-fix** (PR #21, already merged before this session):
  `webhook.js` timestamp timezone (UTC→IST), removal of a stale hard-coded
  Google Sheets fallback URL, and a case-sensitivity fix in the Razorpay
  checkout fund label. Reasoned about in detail in §3 below since it touches
  a frozen file.
- **Migrations 0012–0022**: contribution attribution/soft-delete columns,
  beta allowlist, a one-time data backfill for 4 missed webhook deliveries,
  and the new ministry-content tables.

## 1. V1 regression protection

| Area | Result | Notes |
|---|---|---|
| Giving page / fund selection | PASS | `razorpay-checkout.js` diff is a label-text fix only (`fundName.includes("tech")` case-sensitivity bug); amount, fund routing, and checkout payload construction unchanged. |
| Razorpay checkout init | PASS | Untouched apart from the label fix above. |
| Webhook signature verification | PASS | `verifyRazorpaySignature` untouched; `tests/api/webhook.test.mjs` asserts an invalid signature is rejected (400) and writes nothing. |
| Webhook idempotency | PASS | `proof_id` UNIQUE constraint untouched; explicit test: "the same payment delivered twice is stored only once." |
| Contribution persistence / totals | PASS | Core INSERT path unchanged; `availableBalance` calc explicitly excludes soft-deleted rows even when an admin requests `includeDeleted=1`. |
| Existing read API shape | PASS | GET `/api/contributions` response keys unchanged; new fields (`id`, `createdBy`, `updatedBy`, `IsDeleted`) are additive. A migration-drift guard falls back to the pre-0012 query if the new columns aren't present yet (regression-tested). |
| Authentication (`_lib.js`) | PASS | `functions/api/_lib.js` (Google token verification, `requireAuth`, `getPermissions`) has **zero diff** across the entire V2 range — confirmed via `git diff`. |
| Authorization | PASS | `roles.js` diff is one additive line (`edit_contributions` registered in `VALID_PERMISSIONS`, granted to nobody by default). New manual-entry endpoint requires `requireAuth` **and** a separate hard-coded email allowlist (defense in depth, not a widening). |
| Beta gating vs. real auth | PASS | `functions/_middleware.js` only intercepts 5 exact legacy paths (`/`, `/index.html`, `/our-giving.html`, `/events.html`, `/give-flow.html`, `/my-giving.html`) and serves a static `/v2/*.html` file via `env.ASSETS.fetch` — it never touches `/api/*` or `/admin.html`, and grants no permissions. |
| Admin console / legacy pages | PASS | Not touched by the diff outside the new admin panels added for the new content types. |
| Database schema | PASS | All schema changes are `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` / `CREATE INDEX IF NOT EXISTS` / `INSERT OR IGNORE`. No `DROP`, no destructive `DELETE`, confirmed by grep across `migrations/` and `schema.sql`. |

### Note on the "frozen path" exception (webhook.js / contributions.js / razorpay-checkout.js)

Per `CONTRIBUTING.md`, these files are frozen unless a deliberate, signed-off
exception applies. PR #21 (merged before this session, `2ff9598`) is exactly
that exception: a real production incident (no Razorpay webhook had ever
reached D1; timestamps would have landed 5.5h off had it started working
without the fix) with owner sign-off recorded in the PR body, a mutation-
testing table proving each fix is covered by a test that fails without it,
and the backfill migration verified idempotent against a 94-row production
replica. This review re-confirmed: (a) the diff is exactly the 3 described
changes and nothing else, (b) signature verification and the idempotency
constraint are untouched, (c) all associated tests are present and green.

## 2. V2 verification

| Area | Result | Notes |
|---|---|---|
| Pages load / correct `/v2/` paths | PASS (static review) | No E2E harness in this repo (see §4); verified by reading `functions/_middleware.js`'s `ROUTE_MAP` and each `/v2/*.html` file's asset references. |
| Routing / beta gating | PASS | See table above; cookie is HMAC-signed, fails closed on missing/malformed/expired/invalid-signature input (`verifyBetaCookie` never throws, returns `null`). |
| `BETA_COOKIE_SECRET` hard-coded fallback | Documented, non-blocking | `DEFAULT_BETA_COOKIE_SECRET` in `functions/api/_beta.js` is repo-visible. Confirmed its blast radius is UI-routing only: the cookie is verified solely by `_middleware.js` to pick which static build to serve, and is never consulted by any `/api/*` handler for authorization. Real permissions always re-check `requireAuth`/`getPermissions` against Google-verified identity or the `member_roles` table. Classified low-risk per task §14; operationally, setting a real `env.BETA_COOKIE_SECRET` remains recommended. |
| Input validation | PASS | Every new endpoint (`contact.js`, `prayer.js`, `testimonies.js`, `churches.js`, `promises.js`, `programs.js`, `blog.js`, `contributions.js` POST/PUT/DELETE) validates required fields and returns 400 on missing/invalid input; all covered by tests. |
| XSS / escaping | No new risk found | All endpoints store data via parameterized `db.prepare(...).bind(...)` calls; no `innerHTML` assignment of unescaped API content was found introduced in the `/v2/*.html` diff (grep found none). |
| IDOR | PASS | Every admin mutation endpoint (contact/prayer/testimonies PUT/DELETE, contributions PUT/DELETE) checks existence by primary key and returns 404 when absent — regression-tested (`tests/api/*.test.mjs`, "PUT/DELETE on a nonexistent id is a 404"). |
| Authorization boundaries | PASS | Prayer requests and contact-message inboxes require `manage_content`; only `published`/non-deleted rows are ever returned to unauthenticated callers (testimonies, blog, contact never leak in GET without auth). |
| Error handling | Pre-existing pattern, not V2-introduced | New endpoints return raw `err.message` on a 500, matching the exact pattern already present in `webhook.js`/`contributions.js` before V2 (`git show <base>:...` confirms). Classified **D — pre-existing, untouched by V2**; not a release blocker. |
| SQL injection | PASS | 100% parameterized queries; `tests/regression/sql-injection-input.test.mjs` exercises injection-shaped input against members/expenses/funds tables. |
| Secrets exposure | PASS | No hardcoded API keys/tokens introduced (scanned the full V2 diff); the beta-cookie default secret is the one documented, intentional exception above. |

## 3. Database / migrations

All of `migrations/0012`–`0022` reviewed:

- Additive only (new tables/columns/indexes), consistent with `schema.sql`.
- `0014_backfill_missed_webhook_payments.sql` is a **data-only** backfill,
  explicitly safe to re-run (`INSERT OR IGNORE` keyed on the UNIQUE
  `proof_id`), already reconciled against Razorpay as source of truth and
  already applied in production per PR #21's record — no action needed here.
- `tests/regression/schema-contract.test.mjs` asserts the critical tables/
  columns still exist and `contributions.proof_id` stays UNIQUE.

No further production migration action is required by this release; any
migration not yet applied to the live D1 database (if any) should be applied
in numeric order per the repo's existing migration-runner convention before
relying on the corresponding feature in production — this is unchanged from
the existing repo process and not a new V2 requirement.

## 4. Testing

Real, freshly-run result (`npm test`, Node 22, `node --test`):

```
tests 368
pass 368
fail 0
cancelled 0
skipped 0
todo 0
```

This does not match previously-cited figures (368/368, 397/397, 420/420,
328) from earlier sessions/branches — those numbers came from other,
now-superseded branches or earlier points in history. **368/368 passing on
the current `main`/HEAD is the real, current number**, reproduced directly
in this session.

**E2E:** No Playwright/browser E2E harness exists in this repository (no
`playwright*` config or `*e2e*` test files found; `docs/milestone-v2/README.md`
lists a Playwright suite as explicit future work, not yet built). Equivalent
verification performed instead: full functional suite against a real
in-memory SQLite standing in for D1 (`tests/helpers/mock-d1.mjs`), plus
direct reading of every new/changed handler and the beta-routing middleware.

## 5. Adversarial spot-checks performed

- Unauthenticated access to `/api/prayer` GET, `/api/contact` GET,
  `/api/testimonies?all=1` → all require `manage_content`, tested.
- Manual contribution entry (`POST /api/contributions`) by an authenticated
  admin *not* on the manual-entry allowlist → rejected (403), tested
  (`"add rejects an admin who isn't on the manual-entry allowlist"`).
- Malformed/expired/tampered beta cookie → fails closed, returns to legacy
  flow (code-level: `verifyBetaCookie` catches all parse/verify errors).
- IDOR via nonexistent id on every new mutation endpoint → 404, tested.
- SQL-injection-shaped input on core tables → regression-tested, table
  survives, no injection effect.
- Duplicate webhook delivery (same `proof_id`) → stored once, tested.
- Invalid Razorpay signature → rejected, writes nothing, tested.

No new exploitable vulnerability was found in the V2 diff. Pre-existing V1
findings from prior audits (raw `err.message` in 500 responses, hard-coded
super-admin list, legacy email-token fallback gated by an env flag) are
untouched by V2 and are out of scope for this release per the task's
classification rules (Category D).

## 6. Final diff review

- No conflict markers (`<<<<<<<`/`=======`/`>>>>>>>`) anywhere in the repo.
- No `console.log` debug statements introduced by the V2 diff.
- No hardcoded API keys/passwords/tokens introduced.
- One `TODO` introduced (`contributions.js`, documenting a planned migration
  from the hard-coded manual-entry allowlist to the `edit_contributions`
  permission) — intentional, documented, non-blocking.
- Working tree clean; `git status` shows nothing to commit outside this
  document.

## 7. Release decision

**READY — already merged.** All planning docs are complete, the frozen
giving/webhook path was touched only under a documented, tested,
owner-signed-off exception, all new V2 surface area is behind either the
beta cookie (UI-only gate) or `requireAuth`/permission checks (API gate),
migrations are additive-only, and the full regression suite (368/368) is
green. No code changes were required during this verification pass.

## 8. Remaining risks / future work (non-blocking)

| Item | Classification |
|---|---|
| Hard-coded `DEFAULT_BETA_COOKIE_SECRET` fallback | V2 non-blocker (documented, UI-routing blast radius only) |
| Single hard-coded email allowlist for manual contribution entry, instead of the `edit_contributions` permission | V2 non-blocker (tracked via the TODO in `contributions.js`; `roles.js` already has the permission registered for the follow-up) |
| Raw `err.message` returned in several 500 responses | Pre-existing V1, untouched by V2 |
| No Playwright/browser E2E suite | Future architecture work (already tracked in `docs/milestone-v2/README.md`) |
| Youth Ministry hub page, full Tamil content | Future milestone work, explicitly out of scope per `docs/milestone-v2/README.md` |

## 9. Production boundary

**CODE MERGE STATUS:** V2 is merged into `main` (already was, at session
start). This session made no functional code changes — only added this
verification document.

**PRODUCTION DEPLOYMENT STATUS: NOT DEPLOYED BY THIS AGENT.** Deploys to
Cloudflare Pages happen automatically on push to `main` per
`.github/workflows/deploy.yml`; whether the currently-live production site
reflects this `main` HEAD, and whether the pending migrations 0012–0022 have
been applied to the **production** D1 database (as opposed to the test
harness), is for the human owner to verify and apply per
`docs/runbooks/razorpay-webhook.md` and the repo's existing migration
process. This agent did not run any production migration or deployment
action.
