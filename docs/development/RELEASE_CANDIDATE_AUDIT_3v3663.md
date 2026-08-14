# LJM V2 — Independent Release Candidate Audit

**Auditor role:** Independent release auditor. Did not implement, did not modify
application code, migrations, or production data. Did not deploy. Did not
create a PR or merge to `main`.

**Audit date:** 2026-08-14
**Branch audited:** `claude/ljm-v2-release-candidate-3v3663`
**Commit audited:** `5019da72af2317a330565e45c442f26d3e2a970b` (matches the
short hash `5019da7` given in the brief)
**Method:** All facts below were independently re-derived from `git`, the
actual test run, and direct source reading in a detached worktree at the
audited commit — not taken from any prior agent's self-report. Where a prior
report's claim is cited, it is because independent verification produced the
same result, and that is stated explicitly.

---

## STATUS

IMPLEMENTATION: COMPLETE (per prior sessions' commits — this audit did not implement anything)
OFFLINE TESTS: VERIFIED — 392/392 passing, independently re-run
UI VERIFICATION: NOT PERFORMED (no browser exercised in this audit; see BROWSER/E2E PLAN)
PRODUCTION VERIFICATION: NOT PERFORMED (no D1/Cloudflare production access used or claimed)
MIGRATION 0015 APPLICATION: NOT PERFORMED (confirmed not applied by this or any prior session)

## RELEASE READINESS

**Ready for human release review, conditional on the sequence in FINAL
RECOMMENDATION.** No release blockers were found. The money/payment path is
byte-identical to `main`. All eight frozen files pass cryptographic
comparison. The full test suite and every targeted suite pass. One MEDIUM
and several LOW/FOLLOW-UP gaps exist (below) — none affect the live giving
path and none require code changes before a human merge decision.

---

## VERIFIED FACTS

All obtained directly via `git`, not from prior reports:

- Current audit-session branch: `claude/ljm-v2-release-audit-al8u2p`, HEAD
  `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f`, working tree clean, no local
  modifications.
- `origin/main` = `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f` (same commit —
  the audit branch was cut from current `main`).
- `origin/claude/ljm-v2-release-candidate-3v3663` HEAD =
  `5019da72af2317a330565e45c442f26d3e2a970b`, subject "LJM V2
  release-candidate integration: reconcile Archive Fund bug status, add
  integration handoff entry".
- `git merge-base origin/claude/ljm-v2-release-candidate-3v3663 origin/main`
  = `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f` — the candidate branch is
  cleanly forked from `main`'s current tip, not diverged/stale.
- `git merge-base --is-ancestor` confirms **every** one of the seven claimed
  ancestry commits is actually an ancestor of the candidate HEAD:
  `2ff9598` (main) → `e41903f` (integration audit) → `d54c063` (admin
  hardening) → `606f8c9` (fund hardening) → `48d397e` (agent hardening) →
  `7f7ba0f` (migration hardening) → `5019da7` (release candidate). The
  claimed ancestry chain in the brief is **accurate**.
- `git log --graph --decorate` shows the candidate as five sequential no-ff
  merges into the integration-audit tip (matching the candidate's own
  handoff narrative) — not a rebase, not a squash, no missing merge.
- `git diff --stat origin/main...origin/claude/ljm-v2-release-candidate-3v3663`:
  **19 files changed, 5044 insertions(+), 65 deletions(-)**. Full file list
  reviewed; nothing outside the expected admin/funds/docs/migration/test
  surface (see MONEY-PATH VERIFICATION for the money-path exclusion check).
- Working tree used for testing: a `git worktree` checked out at
  `5019da7` in detached HEAD, confirmed clean before and after `npm test`
  (`git status --porcelain` empty both times) — the test run does not write
  stray files into the tree.
- Node `v22.22.2`, npm `10.9.7` — satisfies `package.json`'s
  `"engines": {"node": ">=22"}`.

---

## TEST RESULTS

`npm test` (`node --test 'tests/**/*.test.mjs'`) run against the release
candidate worktree at `5019da7`:

```
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2783.786581   (wall clock: real 0m3.034s)
```

**392/392 passing — matches the brief's expected count exactly, independently
confirmed, not assumed.**

Targeted suites, run together in one `node --test` invocation for an
independent count (not trusting the aggregate number alone):

```
node --test tests/api/funds.test.mjs tests/frontend/fund-admin-wiring.test.mjs \
  tests/frontend/admin-overview-dynamic-funds.test.mjs \
  tests/regression/migrations-validate.test.mjs tests/regression/schema-contract.test.mjs

# tests 83
# pass 83
# fail 0
# duration_ms 415.259864
```

Breakdown (consistent with the candidate's own handoff claim, independently
reproduced): `funds.test.mjs` 38, `fund-admin-wiring.test.mjs` 8,
`admin-overview-dynamic-funds.test.mjs` 14, `migrations-validate.test.mjs`
20, `schema-contract.test.mjs` 3 → sums to 83, matching the combined run.

**No failures anywhere. No STOP condition triggered.**

---

## MONEY-PATH VERIFICATION

All eight frozen files compared via `git hash-object` (not `git diff`) between
`origin/main` and the candidate HEAD:

| File | main hash | candidate hash | Result |
|---|---|---|---|
| `functions/api/webhook.js` | `ffaab604...` | `ffaab604...` | **IDENTICAL** |
| `functions/api/contributions.js` | `820126d3...` | `820126d3...` | **IDENTICAL** |
| `razorpay-checkout.js` | `c61f09af...` | `c61f09af...` | **IDENTICAL** |
| `functions/api/verify.js` | `96aa972c...` | `96aa972c...` | **IDENTICAL** |
| `functions/api/purchases.js` | `f95897e4...` | `f95897e4...` | **IDENTICAL** |
| `functions/api/_lib.js` | `41abd915...` | `41abd915...` | **IDENTICAL** |
| `functions/api/auth.js` | `36fcde87...` | `36fcde87...` | **IDENTICAL** |
| `functions/api/roles.js` | `e1fa37d7...` | `e1fa37d7...` | **IDENTICAL** |

**All 8/8 byte-identical. No RELEASE BLOCKER.**

`razorpay_key_id` / `razorpayKeyId` full-tree grep — every hit reviewed:

- `functions/api/funds.js`: stored, format-validated (`/^rzp_[A-Za-z0-9_]+$/`
  — deliberately rejects a key *secret*, which has no `rzp_` prefix), and
  returned as plain fund metadata (GET listing/detail, POST create, PUT
  update). **Never read outside `funds.js`.**
- `admin.html`: one form field (`f_razorpayKeyId`) that reads/writes this
  metadata through `/api/funds` — no payment call.
- `migrations/0015_fund_foundation_metadata.sql`, `schema.sql`: column
  definition only, with an explicit comment that it "is not read by any
  payment code yet."

**Confirmed: never referenced in `webhook.js`, `contributions.js`,
`razorpay-checkout.js`, `verify.js`, or `purchases.js`.** It plays no role in
payment routing, checkout key selection, verification, webhook processing,
or authentication. This matches the candidate's own claim, independently
re-derived by grepping the full tree rather than trusting the summary.

---

## FUND FOUNDATION VERIFICATION

Read directly (`functions/api/funds.js`, 617 lines; `tests/api/funds.test.mjs`,
724 lines) rather than counted:

1. **System fund identity lock** — `onRequestPut`: `if (!isSystem) { ...name/description/visibility/status... } else if (body.name || body.status || body.visibility) { return 400 "System funds (Tech/Christmas) allow only goal amount edits" }`. Tested (`funds.test.mjs:35`).
2. **Custom funds** — create (`onRequestPost`), update (`onRequestPut`), soft-delete (`onRequestDelete`, sets `status='deleted'`, preserves contribution rows) all present and tested (`:22`, `:63`, `:203`).
3. **Permissions** — `requireAuth(context, "manage_funds")` gates POST/PUT; `requireAuth(context, "delete_funds")` gates DELETE, confirmed as a **distinct** scope from `manage_funds` by its own test (`:212`, "delete_funds permission, which is distinct from manage_funds"). Unauthorized-caller test present (`:83`).
4. **Validation** — all present and independently read in source, each with a corresponding test: `rankingVisibility` must be `public`/`members` (`:421`), message length cap `MESSAGE_MAX_LEN=5000` (`:411`), `razorpayKeyId` format regex (`:441`), hero-image MIME allowlist (png/jpeg/webp/gif only — **SVG deliberately excluded**, with a code comment explaining the XSS rationale) (`:672`), malformed data-URI rejection (`:682`), size cap `HERO_IMAGE_DATA_URI_MAX_LEN = 2MB` (`:699`).
5. **Soft-deleted contributions excluded** — both listing `totalCollected` and detail `contributions` filter `is_deleted = 0`, tested for system and custom funds alike (`:278`).
6. **Archived fund behavior** — understood from code (`status='archived'` funds are excluded from the public listing's `WHERE f.status = 'active' ...` clause, but included in the admin listing's `WHERE f.status != 'deleted'` clause, so an admin can see and un-archive them) but **has no dedicated test** — `grep -i archiv tests/api/funds.test.mjs` returns zero hits. See LOW RISKS.
7. **GET listing/detail** — both read and both covered (`:12`, `:91`, `:245`).
8. **Schema-drift fallback** — three states tested independently: pre-0012 (missing `is_deleted`) (`:302`), pre-0015-without-0012-columns-affected (`:585`), and the full pre-0015 (`:585`) plus 0012-without-0015 combined-axis fallback (`onRequestGet`'s three-tier `buildQuery(includeFoundation, includeIsDeletedFilter)` try/catch, read directly in source at `funds.js:182-206`).
9. **POST/PUT on pre-0015 databases** — plain creation still works (`:620`), Fund Foundation fields on POST get a clear `503` (not a raw SQL 500) (`:634`), same for PUT (`:648`). Read directly: `fundFoundationColumnsExist()` (`funds.js:40-48`) probes once via `SELECT hero_image_url ... LIMIT 1` and short-circuits with a 503 message before any INSERT/UPDATE touches a nonexistent column.
10. **Hero image storage** — base64-in-D1 fallback is tested and covered (`:361`). The R2 branch (`env.EVENT_PHOTOS.put`, `funds.js:113-129`) exists in code but is **explicitly documented as untested offline** in a code comment (no R2 mock in `tests/helpers/mock-d1.mjs`) — this is disclosed as an accepted gap, not silently claimed as covered. Cleanup (`deleteHeroImageObject`, `funds.js:135-144`) exists and is called from `removeHeroImage`/replace-image PUT paths, also untested against real R2 for the same reason.

**Conclusion: Fund Foundation is implemented to a high standard with honest, granular test coverage. One real gap (item 6, archived-fund test) is a LOW-severity test-coverage gap, not a functional defect** — the code's `WHERE` clauses were read directly and are correct.

---

## MIGRATION VERIFICATION

- **Mechanism, independently confirmed from `.github/workflows/`,
  `migrations/README.md`, and `CONTRIBUTING.md` §4**: there is **no migration
  ledger/framework** — no `schema_migrations` table. Every migration is a
  hand-written `.sql` file, applied once by a human dispatching
  `.github/workflows/deploy-migrations.yml` (a dropdown of known files) or
  `apply-d1-migration.yml` (free-text path), both of which just run
  `wrangler d1 execute ljm-contributions-db --remote --file=...`. Confirmed by
  reading both workflow files directly.
- **`deploy.yml` does NOT apply migrations** — confirmed by reading the file:
  it only runs `npm test` (gating `deploy`) and `cloudflare/pages-action@v1`
  to publish the static site + Functions. Migrations are never touched by
  the push-to-`main` pipeline. **Production migration requires manual
  `workflow_dispatch`, confirmed.**
- **0015 exists on this branch** — `migrations/0015_fund_foundation_metadata.sql`,
  read in full: six `ALTER TABLE funds ADD COLUMN` statements
  (`hero_image_url`, `hero_image_storage`, `message` all nullable TEXT;
  `ranking_enabled INTEGER NOT NULL DEFAULT 0`; `ranking_visibility TEXT NOT
  NULL DEFAULT 'public'`; `razorpay_key_id` nullable TEXT). **Purely
  additive — no drop/rename/retype, every column nullable or DEFAULT-ed.**
  Confirmed additive by direct reading, not by trusting the file's own header
  comment.
- **What's known-applied to production**: `PRODUCTION_STATUS.md` is stale
  (dated 2026-07-14, only documents through migration 0010) and is **not**
  reliable evidence of current state. There is no ledger. The strongest
  available evidence is in `docs/development/AGENT_HANDOFFS.md`, which
  states in multiple independent entries (fund-foundation-phase,
  fund-hardening, and the release-candidate integration itself) that
  **"migration 0015 has not been applied to production D1"** and that
  0012/0013/0014 are assumed applied only inasmuch as 0014
  (`0014_backfill_missed_webhook_payments.sql`) was written and "verified
  against a replica seeded with all 94 production rows" — evidence 0014 was
  *designed* against a production snapshot, not proof it was *dispatched*.
  **This audit could not independently confirm which of 0011–0014 are
  actually live in production**, because the repo genuinely has no ledger —
  this is a process gap inherent to the repo's design (documented,
  acknowledged, and explicitly out of scope to fix per the brief's
  architecture-decision constraint), not something this audit can resolve
  from the repository alone. The honest, verifiable claim is: **0015 is
  known NOT applied; 0011–0014's production status is undocumented and must
  be confirmed by the human operator via `wrangler d1 execute --remote`
  before dispatching 0015** (see MIGRATION PRODUCTION PLAN below).
- **Is 0015 safe to apply from wherever production actually is?** Yes —
  every statement is `ALTER TABLE ADD COLUMN`, nullable/defaulted, and has
  no dependency on 0011-0014 having run (it only touches `funds`, a table
  that predates `migrations/` entirely). It is safe regardless of whether
  production is at 0011, 0012, 0013, or 0014, as long as the `funds` table
  exists (it does, in `schema.sql` from the start).
- **Does migration validation actually execute the SQL?**
  `tests/regression/migrations-validate.test.mjs` (367 lines, read
  directly) replays every migration statement against a live in-memory
  SQLite built from `schema.sql`, asserts idempotent statements succeed and
  non-idempotent `ALTER TABLE` statements fail with `duplicate column name`
  (proving `schema.sql` already reflects them), runs a static ordering
  check (no migration references a table before it exists), a numbering
  monotonicity check, a **dedicated from-scratch run of 0015** against a
  pre-0015 `funds` table asserting the resulting column types/defaults/
  round-trip usability, and a picker-staleness guard against
  `deploy-migrations.yml`'s dropdown. **This is genuine SQL execution
  against real SQLite, not a string/regex check** — confirmed by reading
  the test file, not by trusting its name.
- **Does `funds.js` handle migration ordering safely?** Yes, independently
  verified in FUND FOUNDATION VERIFICATION item 9 above — `POST`/`PUT`
  probe for the columns and return a clean `503` rather than a raw SQL
  error; `GET` degrades through a three-tier fallback. **The
  migration-deployment-ordering risk flagged by the prior integration audit
  (`e41903f`'s own DISCOVERIES) is resolved in this candidate** — confirmed
  by reading the current `onRequestGet` three-tier `buildQuery`, not by
  trusting the release-candidate's own claim that it resolved the finding.
- **0011 duplicate numbering**: confirmed real —
  `migrations/0011_events.sql` and `migrations/0011_member_appearance.sql`
  both exist and both begin `-- Migration 0011:`. Both are listed as
  separate dropdown entries in `deploy-migrations.yml` (`0011_events`,
  `0011_member_appearance`), so the workflow disambiguates by filename, not
  number — the duplicate is a documentation/convention wart, not an
  execution hazard. Pre-existing on `main` before this integration,
  correctly documented as such in every handoff entry reviewed.

**Architecture decision: KEEP_INCREMENTAL_MIGRATIONS.** No concrete technical
problem was found that the existing additive-ALTER-TABLE strategy cannot
handle. A schema rebuild is not warranted and was not attempted.

---

## R2 VERIFICATION

Distinguishing code support / offline coverage / production availability, as
required:

- **A. Code support**: confirmed present in both `functions/api/funds.js`
  (`storeHeroImage`/`deleteHeroImageObject`) and `functions/api/events.js`
  (`storePhoto`/`deletePhotoObject`), both gated on `env.EVENT_PHOTOS` with a
  base64-in-D1 fallback when the binding is absent. Both reuse the same
  bucket/binding and the same `/api/events/photo?key=...` serving endpoint —
  confirmed by reading both files, not assumed from naming similarity.
- **B. Offline test coverage**: the base64 fallback path IS genuinely
  exercised by `funds.test.mjs:361` (create with data-URL hero image, no R2
  binding, round-trips through listing+detail). **The R2 branch itself
  (`env.EVENT_PHOTOS.put`/`.delete`) is NOT exercised by any test** — this
  audit confirms the repo's own code comment (`funds.js:100-105`) is
  accurate: `tests/helpers/mock-d1.mjs`'s `makeContext()` never sets an
  `EVENT_PHOTOS` binding, so the `if (env.EVENT_PHOTOS)` branch is dead code
  under test. **This audit does NOT claim B for the R2 branch** — only for
  the base64 fallback.
- **C. Real production R2 availability**: **NOT verified** — this audit has
  no Cloudflare dashboard/API access and did not attempt to check it. No
  `wrangler.toml` exists in the repo (bindings are configured entirely via
  the Cloudflare Pages dashboard, not as code) — confirmed by its absence in
  the repository listing. **This audit does not claim C.**
- **Expected binding/bucket**: `EVENT_PHOTOS` binding name, `ljm-event-photos`
  bucket, confirmed as the name mentioned in the brief; the repo code itself
  never hardcodes the bucket name (bucket name is a dashboard-side binding
  config, not read from any source file) — could not independently confirm
  `ljm-event-photos` is the actual configured bucket name from the
  repository alone; this is a dashboard fact, not a code fact.
- **MIME validation consistency, `events.js` vs `funds.js`**: **confirmed
  inconsistent.** `funds.js` has an explicit MIME allowlist (`image/png`,
  `image/jpeg`, `image/webp`, `image/gif`; SVG deliberately excluded with an
  XSS rationale comment) and a size cap. `functions/api/events.js`'s
  `storePhoto()` has **no MIME allowlist and no size cap at all** — it
  accepts any `data:<mime>;base64,<payload>` string unconditionally.
  Verified `events.js` is **byte-identical to `origin/main`**
  (`git hash-object` match) — this gap **predates the release candidate and
  was not introduced by it**. Classified **PRE-EXISTING GAP / FOLLOW-UP**,
  not a release blocker, per the brief's own instruction not to silently fix
  it.
- **R2 pricing** (for the "should we enable R2 before release" question):
  could not reach `developers.cloudflare.com` directly — outbound requests
  to that domain are blocked by this environment's network egress proxy
  (`EGRESS_BLOCKED` error). Verified instead via web search aggregating
  multiple third-party sources: Cloudflare R2's Standard-storage free tier
  is commonly reported as **10 GB storage, 1,000,000 Class A operations/month
  (writes/mutations), 10,000,000 Class B operations/month (reads), with zero
  egress fees**, and the free tier does not expire. **This is
  search-aggregated, not fetched from the primary Cloudflare docs page in
  this session — the human should re-confirm the exact current numbers on
  the official pricing page before treating this as a financial decision
  input.**

**R2 is optional today** — the base64-in-D1 fallback is real, tested, and
would serve hero images/event photos without R2 configured. Nothing in the
release candidate requires R2 to function.

---

## BROWSER/E2E PLAN

**Not created in this audit, per the brief's instruction — plan only.**

Installed today, confirmed by direct inspection:
- Playwright CLI: `1.56.1` (via `npx playwright --version`).
- Chromium: pre-installed at `/opt/pw-browsers/chromium-1194` (env var
  `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` already points at it — `npm ls`
  confirms `@playwright/test` is **not** currently a project dependency
  (`node_modules` empty for it), so `playwright.config.js` + a `devDependencies`
  entry would need to be added — no `playwright install` required since
  Chromium is already on disk).
- `wrangler`: not installed locally; `npx wrangler --version` resolves and
  runs `4.123.0` on demand through the proxy (network-dependent, not
  pre-installed).
- Node `v22.22.2` — satisfies Playwright's and the repo's own requirements.

**Proposed structure** (implementation plan only, not built here):

```
tests/e2e/
  playwright.config.js       # chromium only, headless, screenshot-on-failure,
                              # trace-on-retry, no video, no other browsers
  admin-login.spec.mjs        # admin login/session
  admin-overview.spec.mjs     # Admin Overview loads, dynamic funds appear,
                               # API failure surfaces a visible error (not a
                               # fake zero/empty dashboard)
  fund-crud.spec.mjs          # fund create/edit/archive via admin UI
  public-funds.spec.mjs       # public funds/giving page renders
```

`package.json` gains: `"test:e2e": "playwright test"` (kept fully separate
from `npm test`, which stays the fast offline suite CI gates deploy on).

Constraints to honor when this is built: headless Chromium only; no real
Razorpay payment automation — verify checkout UI/wiring only (button
present, correct amount rendered, Razorpay script loaded) never a live
charge; screenshot only on failure; trace only on retry; no video; no large
fixture system — reuse the existing admin `ADMIN_API_TOKEN` auth pattern
already used by the offline test harness, pointed at a real (or
`wrangler pages dev` local) deployment instead of the mock.

**Is this practical in this repo?** Yes — the tooling is already present,
and the site is server-rendered static HTML + Functions with no SPA
framework to fight, which keeps selectors stable. **This audit recommends
building this suite as a follow-up phase**, not before this release
candidate is human-reviewed, since offline coverage is already strong and
this candidate makes no risky UI changes beyond structurally-tested
`admin.html` wiring.

---

## DOCUMENTATION/PROCESS VERIFICATION

Read `docs/development/AGENT_RULES.md` (446 lines), `docs/development/AGENT_HANDOFFS.md`,
`docs/testing/COVERAGE-TRACKER.md` (224 lines), `CONTRIBUTING.md` (186 lines)
directly:

| Requirement | Verified? | Where |
|---|---|---|
| STATUS honesty requirements | Yes | `AGENT_RULES.md` §9 "No false COMPLETE status" |
| UI/browser verification cannot be falsely claimed | Yes | `AGENT_RULES.md` §3, §5 (three distinct claims: implementation / offline tests / production-verified, never collapsed) |
| Discovery classification exists | Yes | `AGENT_RULES.md` §8, full scale: BLOCKER/NEW BUG/REGRESSION/PRE-EXISTING BUG/TEST GAP/ACCEPTED LIMITATION/FOLLOW-UP/HIGH RISK/TECH DEBT/INFORMATIONAL |
| Coverage discoveries persisted | Yes | `COVERAGE-TRACKER.md` header: "not optional narration... goes here, in the same session that found it" |
| Parallel-branch synchronization guidance | Yes | `AGENT_RULES.md` §10 + `CONTRIBUTING.md` §1.6 |
| Migration numbering guidance | Yes | `AGENT_RULES.md` §4 (explicit `git for-each-ref` command to check every remote before picking a number) |
| Money-path freeze | Yes | `CONTRIBUTING.md` §3, technically enforced by `frozen-payment-paths.yml` (see CI gap below) |
| Test-quality guidance | Yes | `AGENT_RULES.md` §13 "Test quality over test count" |
| Merge checklist | Yes | `AGENT_RULES.md` §14 "Integration/merge-agent completion checklist" |
| Handoff entries collision-resistant | Yes | `AGENT_RULES.md` §11, `<date> — <branch> — <title>` heading convention, append-only |
| Canonical status not claimed by a non-integrating agent | Yes | The release-candidate's own handoff entry (5019da7) explicitly declines to fabricate handoff entries on behalf of admin-hardening/fund-hardening/migration-hardening sessions that didn't write their own, flagging the gap instead of papering over it |

**Archive Fund bug status — specifically checked, per the brief:**
`docs/testing/COVERAGE-TRACKER.md:150` reads `[x] funds.js **PRE-EXISTING
BUG — FIXED.**` with the fix description and regression test named. This is
the **current, canonical** entry. Older `AGENT_HANDOFFS.md` entries (dated
2026-08-12/13, before the fix landed) still describe it as open/out-of-scope
— this is correct and expected: handoff entries are historical, append-only,
never rewritten, so past entries legitimately describe past state. The
**live/canonical** source (`COVERAGE-TRACKER.md`) is consistently FIXED.
Independently confirmed the fix is real by reading `admin.html`'s
`$("f_archiveBtn").onclick` — it sends
`{ slug: state.editingFundSlug, status: "archived" }`, matching what
`funds.js`'s `onRequestPut` actually reads. The regression test
(`tests/frontend/fund-admin-wiring.test.mjs:134`) asserts both the new shape
is sent and the old `{action:"archive"}` shape is not.

---

## BLOCKERS

**None found.**

## HIGH RISKS

**None found.**

## MEDIUM RISKS

1. **CI money-path tripwire protects only 5 of the 8 frozen files.**
   `.github/workflows/frozen-payment-paths.yml` line ~29:
   `FROZEN_PATHS="functions/api/webhook.js functions/api/contributions.js razorpay-checkout.js functions/api/verify.js functions/api/purchases.js"`
   — missing `functions/api/_lib.js`, `functions/api/auth.js`,
   `functions/api/roles.js`, all three of which `CONTRIBUTING.md`/the brief
   also treat as frozen. **Classification: FOLLOW-UP / MEDIUM**, per the
   brief's explicit instruction not to fix it in this audit.
   **Recommended change** (for a future session, not applied here): add the
   three missing paths to the `FROZEN_PATHS` string in
   `.github/workflows/frozen-payment-paths.yml`:
   ```
   FROZEN_PATHS="functions/api/webhook.js functions/api/contributions.js razorpay-checkout.js functions/api/verify.js functions/api/purchases.js functions/api/_lib.js functions/api/auth.js functions/api/roles.js"
   ```
   No other change needed — the rest of the workflow already operates on
   whatever list `FROZEN_PATHS` contains.

2. **Production's actual applied-migration state (0011–0014) is not
   verifiable from the repository.** No ledger exists by design (see
   MIGRATION VERIFICATION). This is not a defect introduced by this
   candidate, but it is a real precondition the human operator must confirm
   before dispatching 0015 — see HUMAN ACTIONS REQUIRED.

## LOW RISKS

1. **No dedicated test for archived-fund GET/listing behavior.** Confirmed
   by `grep -i archiv tests/api/funds.test.mjs` returning zero hits. The
   code path itself was read directly and is correct (`status='active'`
   required for the public `WHERE` clause; admin listing shows archived
   funds via `status != 'deleted'`), so this is a coverage gap, not a
   functional bug. Recommend a future session add a test asserting an
   archived fund is excluded from public `GET /api/funds` listing/detail
   but visible to an admin listing.
2. **`events.js` lacks the MIME allowlist/size-cap `funds.js` has** for hero
   images/event photos. Confirmed pre-existing (byte-identical to `main`),
   not introduced by this candidate. **Classification: PRE-EXISTING GAP /
   FOLLOW-UP**, per the brief's instruction not to silently fix it.
3. **R2 branch of `storeHeroImage`/`deleteHeroImageObject` (and `events.js`'s
   equivalent) has zero offline test coverage** — disclosed honestly in the
   code's own comments and in `COVERAGE-TRACKER.md`'s "Explicitly accepted
   gaps" section, not silently claimed as tested. Accepted limitation until
   an R2 mock exists.

## ACCEPTED LIMITATIONS

1. **0011 duplicate migration numbering** (`0011_events.sql` /
   `0011_member_appearance.sql`) — pre-existing on `main`, disambiguated by
   filename in the dispatch workflow, does not block execution, documented
   consistently everywhere it's mentioned.
2. **No migration ledger / no automated "what's applied to production"
   tracking** — a deliberate, documented repo convention (manual
   `workflow_dispatch`, human-verified), not a bug to fix in this release.

---

## HUMAN ACTIONS REQUIRED

These cannot be automated or verified from the repository alone:

1. **Confirm production D1's actual current schema** before dispatching
   0015 — e.g. `wrangler d1 execute ljm-contributions-db --remote --command "PRAGMA table_info(funds);"` — to confirm `hero_image_url` etc. are absent (expected) and to confirm which of 0011–0014's tables/columns already exist, since the repo has no ledger to answer this.
2. **Human code review** of this branch against `main`
   (`git diff main...claude/ljm-v2-release-candidate-3v3663`) and a merge/PR
   decision — explicitly not performed or recommended by this audit acting
   alone.
3. **Dispatch `migrations/0015_fund_foundation_metadata.sql`** via
   `.github/workflows/deploy-migrations.yml` (dropdown already includes it,
   confirmed) once schema state is confirmed — a human, deliberate action.
4. **Verify the new columns exist** post-dispatch (`PRAGMA table_info(funds);`
   again) and spot-check that existing `contributions`/`members`/`purchases`
   rows are untouched (row counts before/after) — a human action against
   real production D1.
5. **Confirm the Cloudflare Pages `EVENT_PHOTOS` R2 binding** (bucket name,
   Production + Preview environments) via the Cloudflare dashboard — see
   the checklist below. Optional, since base64 fallback works without it.
6. **Merge/deploy decision and timing** — this audit recommends but does not
   perform.

### Cloudflare dashboard checklist (R2), for the human owner:

1. Confirm whether an R2 bucket already exists (expected name
   `ljm-event-photos`, per the brief — not independently confirmable from
   the repo since there's no `wrangler.toml`).
2. If it doesn't exist, create it (Standard storage class is sufficient;
   this workload is small).
3. Add an `EVENT_PHOTOS` binding pointing at that bucket to the **Production**
   Pages environment.
4. Add the same binding to **Preview** if preview deployments should also
   exercise the R2 path (optional — base64 fallback covers Preview fine
   either way).
5. After the next deploy, confirm the binding is live (e.g. upload a fund
   hero image or event photo in the admin UI and check whether
   `heroImageStorage`/`storage` comes back `"r2"` instead of `"base64"`).
6. Re-confirm current R2 free-tier limits directly on
   `developers.cloudflare.com/r2/pricing` before deciding to enable it for
   billing certainty — this audit's environment could not reach that page
   directly (network egress block) and used search-aggregated figures
   instead (see R2 VERIFICATION).

## RECOMMENDED NEXT PHASE

1. Human code review of this release candidate (no further agent work
   needed to make it reviewable — it already is).
2. Optionally, a follow-up session to widen `frozen-payment-paths.yml` to
   all 8 files (MEDIUM finding #1) — small, low-risk, not urgent.
3. Optionally, a follow-up session to build the `tests/e2e/` Playwright
   suite described above, before the *next* UI-heavy milestone rather than
   blocking this one.
4. Production migration dispatch, per MIGRATION PRODUCTION PLAN below —
   human-gated, not an agent task.

---

## RELEASE ARCHITECTURE DECISION

1. **Is the current application architecture safe enough to release?** Yes.
   Money path untouched (byte-identical, hash-verified). New surface
   (Fund Foundation metadata) is additive, validated, and gracefully
   degrades on schema drift.
2. **Is incremental migration safe enough?** Yes — additive-only convention,
   validated by real SQL execution tests, no framework needed.
   `KEEP_INCREMENTAL_MIGRATIONS` — no architectural rebuild justified.
3. **Is 0015 safe to apply after the current (unverified) production
   migration state?** Yes — it only touches `funds`, adds nullable/defaulted
   columns, and has no dependency on 0011–0014.
4. **Does the code safely handle migration ordering?** Yes — verified
   directly in `funds.js`: GET degrades through a three-tier fallback, POST/PUT
   return a clean 503 rather than a raw SQL error when Foundation columns
   are requested but absent. **Either MIGRATION FIRST or CODE FIRST is
   safe** — this candidate resolved the ordering risk the prior integration
   audit had flagged as open.
5. **Is R2 optional or required?** Optional — base64-in-D1 fallback is real
   and tested.
6. **Should R2 be enabled before release?** Not required for release; safe
   to enable independently at the human's convenience, since it's currently
   within the commonly-reported free tier for this workload's likely volume
   (a handful of admin-uploaded hero/event images) — re-confirm exact
   current pricing on Cloudflare's own page first (see R2 VERIFICATION).
7. **Is browser testing necessary before production?** Not a hard blocker
   for this candidate specifically (offline coverage is strong, UI changes
   are structurally tested), but recommended as a near-term follow-up given
   this is the first real Fund Foundation admin UI surface.
8. **Minimum Playwright suite required?** The 6-flow set from PHASE 8 above
   (admin login, Admin Overview load, dynamic funds appear, API-failure
   error surfacing, fund create/edit/archive, public funds page render) —
   Chromium-only, headless, no real Razorpay automation.
9. **Any money-path risks?** None found — hash-identical files, no
   `razorpay_key_id` usage outside metadata.
10. **Any release blockers?** None found.
11. **What must the human owner do manually?** See HUMAN ACTIONS REQUIRED.
12. **What can be automated safely?** Re-running `npm test` in CI (already
    wired), the targeted-suite re-checks, the migration validation
    tests — all already automated and already passing.
13. **What should NOT be changed before release?** The 8 frozen money-path
    files (verified untouched — keep it that way), the incremental
    migration strategy (no rebuild), and the existing `deploy.yml`
    `needs: test` gate.

---

## MIGRATION PRODUCTION PLAN

**MIGRATION FIRST is the recommended order, though CODE FIRST is also safe**
given the verified schema-drift guards — recommending MIGRATION FIRST
anyway because it's simpler to reason about (once applied, `funds.js`'s
fallback branches simply never need to activate in production) and because
0015 has zero dependency on the new code being deployed.

1. **Human review of `migrations/0015_fund_foundation_metadata.sql`** — six
   `ALTER TABLE ADD COLUMN` statements, all nullable/defaulted, already
   reviewed in this audit (see MIGRATION VERIFICATION) — a second human look
   per `CONTRIBUTING.md` §4's "get a second look... before dispatching."
2. **Confirm current production schema** —
   `wrangler d1 execute ljm-contributions-db --remote --command "PRAGMA table_info(funds);"`
   to confirm the six 0015 columns are absent (expected) before applying.
3. **Optional dry-run** — `wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0015_fund_foundation_metadata.sql --dry-run` if supported by the installed `wrangler` version, or apply to a scratch/preview D1 first.
4. **Apply 0015** via `.github/workflows/deploy-migrations.yml`
   `workflow_dispatch`, selecting `0015_fund_foundation_metadata` from the
   dropdown (confirmed present).
5. **Verify successful execution** — workflow's own "Verify Migration" step,
   plus a manual `PRAGMA table_info(funds);` re-check that the six columns
   now exist with the expected types/defaults.
6. **Verify existing data untouched** — row counts on `contributions`,
   `members`, `purchases` before/after (`SELECT COUNT(*) FROM ...`) should be
   identical; `ALTER TABLE ADD COLUMN` never touches existing rows' other
   columns.
7. **Deploy the release-candidate code** (merge to `main`, which triggers
   `deploy.yml`) — safe at this point since the schema now matches what the
   code expects; also safe even if deployed *before* step 4, per the
   verified fallback behavior.
8. **Enable/verify R2** — independent, optional, human dashboard action
   (see checklist above) — can happen before, after, or never, without
   affecting the giving/money path or Fund Foundation metadata.
9. **Run the Playwright smoke suite** — once built (follow-up phase),
   against the live deployment.
10. **Production smoke verification** — `functions/api/selftest.js` tab or
    manual spot-check, per `AGENT_RULES.md` §5's "production-verified" bar.
11. **Release sign-off.**

---

## FINAL RECOMMENDATION

**Approve for human release review.** No release blockers. Money path is
provably untouched. Test suite is fully green (392/392, independently
re-run) and targeted suites match claimed counts exactly. The one MEDIUM
finding (CI tripwire covers 5/8 frozen files) and the LOW findings
(archived-fund test gap, `events.js` MIME inconsistency, untested R2 branch)
are all real but none block a release decision — they're follow-up items,
consistent with this repo's own discovery-classification discipline.

**Release sequence:**

1. Human review (this report + `git diff main...claude/ljm-v2-release-candidate-3v3663`)
2. Merge/PR approval decision (not performed by this audit)
3. Confirm current production D1 schema state (no ledger exists — must be checked live)
4. Apply production migration 0015 via `deploy-migrations.yml`
5. Verify migration success (columns exist, existing data untouched)
6. Deploy release (merge to `main` → `deploy.yml`)
7. Enable/verify R2 (optional, independent of the above)
8. Build and run Playwright smoke suite (follow-up phase, not blocking)
9. Production smoke verification
10. Release sign-off

No production changes, migrations, deployments, code edits, or merges were
performed by this audit.
