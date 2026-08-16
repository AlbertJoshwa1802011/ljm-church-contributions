# Agent Handoffs

Running log of hardening/maintenance passes done by coding agents outside the
normal milestone-document workflow (see `CLAUDE.md`'s "Milestone workflow" for
that process — this file is for smaller, explicitly-scoped hardening passes
like the one below, not major features).

**Rule:** never delete or rewrite a prior entry. Append new entries below the
existing ones, oldest first.

---

## 2026-08-14 — LJM V2 pre-release hardening (CI tripwire, R2 offline mock, Playwright E2E)

**Requested scope:** a small, explicitly-approved hardening pass — NOT a
general feature-development phase. Four tasks: (1) complete a CI tripwire
protecting 8 named money-path files, (2) add an offline R2 mock + tests for
the accepted R2 coverage gap, (3) leave `events.js`'s MIME-validation gap
alone and just record it, (4) add a small Playwright/Chromium E2E smoke suite
if the environment supports it cleanly.

**Correction to the task brief's premise, for whoever reads this next:** the
brief this pass was dispatched with asserted prior state that does not match
this repository — no `.github/workflows/frozen-payment-paths.yml` existed
before this pass (so it protected 0 files, not 5), no prior "two independent
audits" or "392/392 tests passing" baseline exists in git history (the actual
baseline at the start of this pass was 328 tests, all passing), there is no
migration 0015 (`migrations/` tops out at `0014_backfill_missed_webhook_
payments.sql`), and there is no "Fund Foundation" feature or R2/hero-image
code anywhere in `functions/api/funds.js` — the real (and only) R2
`EVENT_PHOTOS` usage is in `functions/api/events.js` / `functions/api/events/
photo.js`, matching the gap already tracked in `docs/testing/COVERAGE-TRACKER.md`
before this pass. This pass proceeded in good faith against the real repo
state rather than the brief's claims, and adjusted task 2 accordingly (see
below). Take any future task brief's factual claims about "prior audits" or
"already verified" state with the same skepticism — verify against `git log`,
`npm test`, and the actual source, not the brief.

### What changed

1. **CI tripwire** — `.github/workflows/frozen-payment-paths.yml` (new) +
   `scripts/check-frozen-paths.sh` (new, single source of truth the workflow
   calls). Protects all 8 named files: `functions/api/webhook.js`,
   `functions/api/contributions.js`, `razorpay-checkout.js`,
   `functions/api/verify.js`, `functions/api/purchases.js`,
   `functions/api/_lib.js`, `functions/api/auth.js`, `functions/api/roles.js`.
   Bypass token: `ACKNOWLEDGED-MONEY-PATH-CHANGE` in a commit message or PR
   body. Verified locally against 5 synthetic-diff scenarios (see "Test
   results" below) plus the ack-bypass and mixed-diff cases.
2. **R2 offline mock** — `tests/helpers/mock-r2.mjs` (new, Map-backed,
   put/get/delete + failure injection) + `tests/api/events-r2.test.mjs` (new,
   7 tests) against the REAL R2 gap (`events.js`, not `funds.js` — see
   correction above). `tests/helpers/mock-d1.mjs`'s `makeContext()` gained an
   optional `env` override so tests can merge in a mock R2 binding.
3. **`events.js` MIME gap** — left untouched, per instruction. Recorded as a
   FOLLOW-UP/PRE-EXISTING GAP in `docs/testing/COVERAGE-TRACKER.md`.
4. **Playwright E2E** — `playwright.config.mjs` (new), `tests/e2e/` (new: 5
   spec files + `fixtures.mjs` + `global-setup.mjs` + `global-teardown.mjs`),
   `npm run test:e2e` (new script), `@playwright/test@1.56.1` devDependency
   pinned to match the pre-installed Chromium build. Chromium only, headless,
   screenshot-on-failure, trace-on-first-retry, no video, as requested.
   **Load-bearing detail for anyone touching this suite:** `theme.js` (loaded
   on every public/admin page) deliberately rewrites every `/api/*` fetch to
   the LIVE production Cloudflare Pages URL whenever `window.location.hostname`
   is `localhost`/`127.0.0.1` (a "local static preview shows live prod data"
   feature). `tests/e2e/fixtures.mjs` intercepts and reroutes those specific
   production-URL requests back to the local dev server before Playwright
   ever dispatches them over the network — this is required for E2E safety,
   not an incidental nicety, and must not be removed or "simplified away."
   `admin.html`'s dev-only login gate (`#devLoginBtn`) is keyed off the same
   hostname check, which is why the suite navigates via `127.0.0.1` (not some
   other loopback alias) with that interceptor in place.

   **Two real, pre-existing bugs were discovered while building these tests**
   (not fixed — `functions/api/funds.js` and `admin.html` were not in this
   pass's approved change list): the admin "Archive fund" button is currently
   non-functional (`funds.js`'s PUT handler never reads `body.action`, only
   `body.status`), and `admin.html`'s `api()` helper only rejects on HTTP 401
   (a non-2xx response with a JSON body silently falls through to an empty-
   state render instead of a distinct error). Full detail, plus fix
   direction, in `docs/testing/COVERAGE-TRACKER.md`'s "Discovered during the
   Aug 2026 pre-release hardening pass" section. The E2E tests assert the
   REAL current behavior for both (including the Archive bug), not the
   intended one — they'll need updating once/if either is fixed.

### Files changed

- `.github/workflows/frozen-payment-paths.yml` (new)
- `scripts/check-frozen-paths.sh` (new)
- `tests/helpers/mock-r2.mjs` (new)
- `tests/api/events-r2.test.mjs` (new)
- `tests/helpers/mock-d1.mjs` (`makeContext()` gained an `env` override param)
- `playwright.config.mjs` (new)
- `tests/e2e/fixtures.mjs`, `global-setup.mjs`, `global-teardown.mjs`,
  `admin-overview.spec.mjs`, `api-failure.spec.mjs`, `fund-admin.spec.mjs`,
  `public-funds.spec.mjs`, `razorpay-ui.spec.mjs` (all new)
- `package.json` (`test:e2e` script, `@playwright/test` devDependency)
- `.gitignore` (Playwright run-artifact directories)
- `docs/testing/COVERAGE-TRACKER.md` (R2 gap closed, MIME gap + 2 discovered
  bugs recorded, new BROWSER E2E section)
- `AGENT_HANDOFFS.md` (this file, new)

**Not changed:** all 8 frozen money-path files (byte-identical to `main` —
verified with `diff` against `origin/main` for each), `functions/api/events.js`
and `functions/api/events/photo.js` (verified empty `git diff` against
`origin/main`), `migrations/` and `schema.sql` (no changes), no migration was
applied to any database, nothing was deployed, no PR was created.

### Test results

- `npm test`: 335/335 passing (baseline before this pass: 328/328 — net +7,
  all in `tests/api/events-r2.test.mjs`; no existing test was weakened or
  deleted).
- `npm run test:e2e`: 5/5 passing, run twice consecutively to confirm
  determinism (clean process teardown between runs, no leftover `wrangler`/
  `workerd` processes, no port conflicts).
- CI tripwire (`scripts/check-frozen-paths.sh`) verified locally against: a
  diff touching one protected file (no ack → fails; with
  `ACKNOWLEDGED-MONEY-PATH-CHANGE` in the commit message → passes; with the
  token in a simulated PR body → passes), a diff touching `_lib.js` alone (no
  ack → fails), a diff touching `auth.js` alone (no ack → fails), a diff
  touching `roles.js` alone (no ack → fails), a diff touching only a
  non-protected file (`funds.js`) (no ack → passes, no false positive), a
  mixed diff (one protected + one non-protected file, no ack → fails), and a
  first-push/new-branch case (`before` SHA all-zero → skipped, not a false
  positive).
- `node --check` / `bash -n` / YAML parse: clean on every new/modified file.

### Handoff status

```
IMPLEMENTATION: COMPLETE
OFFLINE TESTS: COMPLETE
BROWSER VERIFICATION: COMPLETE
PRODUCTION VERIFICATION: NOT PERFORMED
```

---

## 2026-08-16 — LJM V2 final pre-release bug fix (Archive Fund, api() error masking)

**Requested scope:** fix the two real, pre-existing bugs the previous
(2026-08-14) hardening pass discovered but explicitly left unfixed (out of
that pass's approved scope), add regression coverage that exercises the
actual browser, and independently re-verify that pass's reported counts
before building on top of it.

**Correction to the task brief's premise, for whoever reads this next:** the
brief this pass was dispatched with referenced `docs/development/
AGENT_RULES.md` and `docs/development/AGENT_HANDOFFS.md` — neither exists in
this repository. The real file is this one, `AGENT_HANDOFFS.md`, at the repo
root (added by the 2026-08-14 pass). The brief also described the working
branch as already containing the 2026-08-14 pass's commits; in the actual
session, that work lived on a sibling branch
(`claude/ljm-v2-pre-release-hardening-6bjrwy`) and had to be merged into this
session's designated branch (`claude/ljm-v2-bug-fixes-a8gsm2`) first — a
clean, additive fast-forward-style merge, no conflicts.

**Independent re-verification of the 2026-08-14 pass's reported baseline,**
done before any code changes: `npm test` → 335/335 (matches). `npm run
test:e2e` → 5/5, run twice consecutively for determinism (matches).
`tests/api/events-r2.test.mjs` (the R2 offline mock tests) → 7/7 run in
isolation (matches). All three claims held up.

### What changed

1. **Archive Fund fixed.** `admin.html`'s `#f_archiveBtn` handler now sends
   `PUT /api/funds` with `{ slug, status: "archived" }` instead of
   `{ slug, action: "archive" }` — `functions/api/funds.js`'s `onRequestPut`
   already recognized `body.status` (no backend change needed or made).
2. **`admin.html`'s `api()` helper hardened.** Now rejects on any non-2xx
   response, not just HTTP 401 (401 handling unchanged). Parses `d.message`
   or `d.error` from the JSON body for the thrown `Error`'s message where
   available. Audited all 60 `api()` call sites in `admin.html`; added a
   missing `.catch()` to the 5 that had none (all in the Families section),
   matching the file's existing `setMsg(..., e.message, "err")` convention —
   every other call site already had equivalent error handling, so behavior
   is unchanged for expected business-logic errors (e.g. 404 "Fund not
   found") and newly correct (a visible error instead of a silent
   empty/zero render) for real server failures.
3. **Regression coverage:** `tests/e2e/fund-admin.spec.mjs` rewritten to
   drive a real archive through the browser and assert success (was
   previously written to assert the bug); new `tests/e2e/api-http-error.spec.mjs`
   intercepts `/api/funds` with a real HTTP 500 + JSON error body and asserts
   both the Overview KPI grid and the Funds section show a visible error, not
   fabricated success-looking output.
4. **`docs/testing/COVERAGE-TRACKER.md` updated** — both bugs moved from
   "discovered, not fixed" to a new "FIXED — Aug 2026 bug-fix pass" section
   with fix + regression-coverage detail; the BROWSER E2E checklist entries
   updated to reflect the new/changed test files and behavior.

**Not changed:** all 8 frozen money-path files (verified byte-identical to
`origin/main` before and after this pass — see mutation-testing note below
for one wrinkle discovered along the way), `functions/api/funds.js` (the
backend already supported the correct contract; only the caller needed to
change), `functions/api/events.js` (MIME-validation gap remains untouched,
still tracked as FOLLOW-UP/PRE-EXISTING GAP in the coverage tracker, assessed
non-blocking: reachable only by an already-`manage_events`-authenticated
admin, not a public attack surface), `migrations/` and `schema.sql` (no
schema change needed — both fixes are frontend-only), no migration was
applied to any database, nothing was deployed, no PR was created, no real
Razorpay payment was made.

### Mutation testing

- **Archive Fund:** temporarily reverted `admin.html` to send
  `action: "archive"` again → `tests/e2e/fund-admin.spec.mjs` failed on the
  `expect(archivePutBody.status).toBe("archived")` assertion (received
  `undefined`) → reverted the revert, suite green again.
- **`api()` non-2xx rejection:** temporarily removed the `!r.ok` branch from
  `api()` → `tests/e2e/api-http-error.spec.mjs` failed (`#kpiGrid` rendered
  real-looking non-error KPI data instead of the expected "Failed to load"
  text) → reverted the revert, suite green again.
- Full suites (`npm test` + `npm run test:e2e`) re-ran clean after each
  restore.

### A process note on the frozen-path tripwire (not fixed, flagged for
### awareness — not a release blocker)

While independently testing `scripts/check-frozen-paths.sh` against a
synthetic diff, discovered its `ACKNOWLEDGED-MONEY-PATH-CHANGE` detection
does a plain substring `grep` across every commit message in the
`BASE_SHA..HEAD_SHA` range — not just the commit(s) that actually touch a
frozen file. Because the 2026-08-14 pass's own merge commit *describes* that
token in prose (documenting how the bypass works), any later diff range that
includes that commit will report the tripwire as "acknowledged" even for an
unrelated, unintentional frozen-file change further down the same branch.
Confirmed this does **not** affect this pass's own frozen-file verification
(all 8 files were independently diffed byte-for-byte against `origin/main`
and found unchanged, not relying on the tripwire's ACK logic). Not fixed
here — out of this pass's approved scope (fixing the tripwire script itself
was not requested) — but worth a future pass tightening the ACK check to
only scan commits that actually touch a frozen file, or requiring the token
on its own line/trailer rather than anywhere in the message body.

### Test results

- `npm test`: 335/335 (unchanged — no `functions/api/*` files were touched,
  so no test count change was expected or occurred).
- `npm run test:e2e`: 6/6 (was 5; +1 for the new
  `tests/e2e/api-http-error.spec.mjs`), run twice consecutively, both clean.
- `tests/api/events-r2.test.mjs`: 7/7, unaffected (R2/events.js untouched).

### Handoff status

```
IMPLEMENTATION: COMPLETE
OFFLINE TESTS: COMPLETE
BROWSER VERIFICATION: COMPLETE
PRODUCTION VERIFICATION: NOT PERFORMED
MIGRATION: NOT NEEDED, NOT APPLIED
```
