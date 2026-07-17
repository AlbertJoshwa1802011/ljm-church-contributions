# Contributing — mandatory process for this repo

This repo runs LJM's live giving/contribution portal — **real money and real
congregation data flow through it today.** This document is the standing
engineering process every change (human or AI agent) must follow. It exists
because a static-site-with-no-build-step repo has no compiler, no type checker,
and no linter to catch mistakes — **tests and process are the only safety net.**

If you are a new agent session picking up this repo, **read this file before
touching code.** Three sentences if you read nothing else: tests are mandatory
for every new or changed endpoint, the giving/money path never changes behavior,
and CI blocking a red suite from deploying is not optional configuration — it's
load-bearing.

---

## 1. Before you start — discover in-flight work first

This repo has been built by many different agent sessions over time, often
without one session knowing what another just did. To avoid duplicate or
conflicting work ("resolving conflicts at scale" applies here even with a small
team):

1. Read `CLAUDE.md` (repo root) — the pitfalls and the milestone-planning ritual.
2. Read `docs/milestone-v2/README.md` — the current milestone's plan and status.
3. Read `docs/testing/COVERAGE-TRACKER.md` — the live test-coverage backlog. Skim
   for open (`[ ]`) items in the area you're about to touch.
4. Run `git log --oneline -20` and `git status` — see what actually landed most
   recently, not just what a stale handoff doc claims.
5. Run `npm test` **before** making any change, to confirm you're starting from
   a green baseline. If it's already red, stop and fix that first — don't build
   on a broken foundation.

## 2. The non-negotiable rule: tests are mandatory

**Every new or changed `functions/api/*.js` endpoint ships with tests in the same
change.** Not "should have," not "nice to have" — mandatory, the same way a
compiler error is mandatory to fix in a typed language. This repo has no
compiler; `node --test` is the only thing standing between a mistake and
production.

For every endpoint/operation you add or touch:
- **Happy path** — it does what it's supposed to.
- **Permission gate** — an unauthorized caller is rejected (pattern:
  `makeContext({ authToken: null })` → `success:false`).
- **Visibility boundary** if applicable — draft/private/pending content is hidden
  from public reads; only published/approved rows are shown (pattern:
  `tests/api/expenses.test.mjs`).
- **Not-found / validation edges** — a bad id is a 404, a missing required field
  is a 400, not a 500 or (worse) a silent no-op.

Use the existing harness — don't invent a new one:
- `tests/helpers/mock-d1.mjs`: `freshDb()` (real in-memory SQLite from
  `schema.sql`) + `makeContext()` (fake Pages Functions context, defaults to the
  machine `ADMIN_API_TOKEN` path so no real Google token is needed).
- For Google-token-dependent flows, stub `globalThis.fetch` — see
  `tests/api/webhook.test.mjs` and `tests/api/appearance.test.mjs` for the
  pattern (save/restore the real `fetch` in `before`/`after`).
- Full conventions: [`TESTING.md`](./TESTING.md).

Run `npm test` yourself and confirm it passes before considering any task done.
**Never weaken or delete an existing test to make a new one pass.** If a test is
genuinely wrong, fix the test with a clear explanation of why — don't silence it.

## 3. The giving/money path is frozen

We have **real, live contribution data.** `functions/api/webhook.js`, the
`contributions` table (including the `proof_id UNIQUE` idempotency guarantee),
`functions/api/contributions.js`'s read model, and `razorpay-checkout.js` do not
change behavior without an explicit, deliberate decision — and even then, extra
tests plus a mutation-testing sanity check (see §5) are required, not optional.
Full detail: [`docs/milestone-v2/SAFETY-AND-TESTS.md`](./docs/milestone-v2/SAFETY-AND-TESTS.md).

## 4. Database changes are additive-only

- New tables: `CREATE TABLE IF NOT EXISTS`.
- New columns on existing tables: nullable, defaulted `ALTER TABLE ... ADD COLUMN`.
- **Never** drop, rename, or retype an existing column or table.
- Every migration is applied manually (see `.github/workflows/deploy-migrations.yml`
  / `apply-d1-migration.yml`) — dry-run and back up before running one against
  production D1. These workflows accept raw SQL/arbitrary migration files with no
  automated review, so the review has to be human: **get a second look (or, for
  a solo agent session, re-read the SQL once more, slowly, after a break) before
  dispatching a migration workflow against production.** This is the one place in
  the pipeline where CI cannot save you.
- When you add a new critical table, add it to the `REQUIRED` map in
  `tests/regression/schema-contract.test.mjs` so a future breaking migration gets
  caught automatically.

## 5. CI is a deploy gate, not a suggestion

`.github/workflows/deploy.yml` runs the full test suite as a job that
**`deploy` depends on** (`needs: test`) — a red suite cannot reach production.
**Do not remove that dependency, and do not add a way to bypass it.** If you're
ever tempted to skip tests "just this once" to ship faster, that instinct is
exactly what this rule exists to override.

When you touch something security- or money-relevant, prove your test actually
catches a regression, not just that it passes today:
1. Temporarily break the behavior (comment out a guard, flip a condition).
2. Run the specific test file — confirm it fails.
3. Revert the break.
4. Confirm `git diff` on the source file is empty and the suite is green again.

This mutation-testing step is cheap (a few tool calls) and is the difference
between a real safety net and a test that merely exercises code without
asserting anything meaningful.

## 6. Pull request checklist

Every PR uses [`.github/pull_request_template.md`](./.github/pull_request_template.md).
The checklist there mirrors
[`docs/milestone-v2/SAFETY-AND-TESTS.md`](./docs/milestone-v2/SAFETY-AND-TESTS.md) §4 —
that's the one source of truth; this file doesn't restate it.

## 7. Frontend (`script.js`, `admin.html`, etc.) — no build step means no safety net but tests

There's no bundler, TypeScript, or linter. A typo'd function name is invisible
until a real user's browser throws. See `CLAUDE.md`'s "Known pitfall" section for
the specific rule (grep to confirm a called function is defined; wrap chained
render/init calls in their own `try/catch`) and
`tests/frontend/analytics-charts.test.mjs` for the regression-test pattern to
extend when you add a new chained render chain.

## 8. Keep the tracker current

[`docs/testing/COVERAGE-TRACKER.md`](./docs/testing/COVERAGE-TRACKER.md) is the
living backlog of test-coverage gaps, prioritized. When you close an item, check
it off with the test file that covers it. When you add a new endpoint, add its
operations as new rows in the same change — this is what "mandatory" means in
practice: the backlog never silently grows without the addition being visible.

## 9. Milestone-scale work follows the 6-document ritual

For any major feature/milestone (not a routine bugfix), `CLAUDE.md`'s "Milestone
workflow" section applies: PRD → TRD → App Flow → UI/UX Spec → Backend Schema →
Implementation Plan, in order, before implementation begins. See
`docs/milestone-v2/README.md` for the live example.
