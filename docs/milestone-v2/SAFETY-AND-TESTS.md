# ⚠️ Zero-Breakage Guarantee & Test Strategy

| | |
|---|---|
| **Product** | Light of Jesus Ministry — Worldwide Ministry App |
| **Milestone** | v2 — "Worldwide Ministry App" |
| **Applies to** | Every document (01–06) and every implementation phase |
| **Status** | Active — the net exists and passes today |

> **The one rule that overrides everything:** the ministry has **real, live
> contribution data** flowing through the app right now. **No new feature may break
> any existing functionality — not even slightly.** This document is the standing
> guarantee and the test strategy that enforces it. Read it before writing any code
> in any phase.

---

## 1. The guarantee

1. **The giving/money path is frozen.** `functions/api/webhook.js`, the
   `contributions` table (incl. `proof_id UNIQUE` idempotency), the read model in
   `functions/api/contributions.js`, `razorpay-checkout.js`, and the Google Sheets
   sync **do not change behavior** this milestone. New giving UI calls the **same**
   endpoints with the **same** request/response shapes.
2. **Database changes are additive only.** New features get **new tables** via new
   migrations (`0012+`) using `CREATE TABLE IF NOT EXISTS` and nullable, defaulted
   `ALTER … ADD COLUMN`. **Never** drop, rename, or retype an existing column/table.
3. **Existing endpoints keep their contracts.** New behavior ships as **new**
   `functions/api/*` files; existing response shapes stay byte-compatible with the
   current front-end.
4. **The new experience ships behind a feature flag** (reusing the `config`/
   `settings.js` pattern, like `force_login`). The current pages stay live until the
   flag is flipped; rollback is one flag (data untouched).
5. **Green tests are a deploy gate, not just a check.** `.github/workflows/deploy.yml`
   runs the suite as a `test` job that the `deploy` job depends on
   (`needs: test`) — a red suite cannot reach production. This is a repo-wide
   rule, not scoped to this milestone; full policy in
   [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) §5.

---

## 2. The regression safety net (in place today)

A characterization test net now locks in the current behavior of the previously
**untested** critical handlers. Suite: **46 → 82 passing tests.**

| Test file | Guards |
|---|---|
| `tests/api/webhook.test.mjs` | **Money-in path:** signature verify, paise→₹, fund normalization, member auto-add, **idempotency** (a duplicate delivery is stored once) |
| `tests/api/contributions.test.mjs` | Public read model: goal, collected, spent (`fund_contribution` only), `availableBalance` (never negative) |
| `tests/api/funds.test.mjs` | System funds can't be renamed/deleted; custom-fund delete is **soft** and preserves contribution history |
| `tests/api/members.test.mjs` | Stat aggregation + duplicate-name guard |
| `tests/api/expenses.test.mjs` | Public hides private/cancelled; admin `?all=1` sees all |
| `tests/api/auth.test.mjs` | Input-validation guard branches (no-network) |
| `tests/api/logs.test.mjs` | Ingestion never fails loudly; audit viewer is permission-gated |
| `tests/regression/schema-contract.test.mjs` | **Tripwire:** fails if a migration drops a critical table/column or the `proof_id UNIQUE` constraint |
| *(existing)* `tests/api/*`, `tests/frontend/analytics-charts.test.mjs` | Appearance, bible, families, purchases, roles, search, settings, subscriptions, wishlist; the analytics-chart lazy-render regression |

**The net is proven, not decorative.** Mutation testing confirmed it catches real
regressions: dropping the paise→₹ conversion fails the webhook test; removing
`proof_id UNIQUE` fails the schema-contract test.

**This is a starting point, not the finish line.** A full operation-by-operation
audit found many more gaps beyond this initial net (every operation on
`events.js`, `roles.js` DELETE, `funds.js`'s visibility gate, and dozens more).
The complete, prioritized, checkbox-tracked backlog — repo-wide, not scoped to
this milestone — lives in
[`../testing/COVERAGE-TRACKER.md`](../testing/COVERAGE-TRACKER.md). That file,
not this section, is the up-to-date source of truth for "what's tested."

Run it anytime:
```bash
npm test          # node --test 'tests/**/*.test.mjs'
```

---

## 3. How every new feature must be tested (per phase)

Each new endpoint/feature ships **with its own tests in the same change**, following
the existing harness (`tests/helpers/mock-d1.mjs`, real in-memory SQLite from
`schema.sql`, no network):

- **Happy path** — the feature does what the PRD says.
- **Permission gate** — admin mutations reject callers without the right scope
  (pattern: `makeContext({ authToken: null })` → `success:false`).
- **Public vs. private** — published/approved content is visible; drafts/private
  aren't (pattern: `expenses.test.mjs`).
- **Additive-schema guard** — extend `schema-contract.test.mjs`'s `REQUIRED` map with
  the new tables/columns so they, too, become protected once shipped.
- **No-regression check** — the full suite stays green; existing tests are never
  weakened to make a new feature pass.

For `script.js` (no build step): follow `CLAUDE.md` — grep that any function you call
is actually defined, wrap chained render/init calls in their own try/catch, and let
`tests/frontend/analytics-charts.test.mjs` guard the analytics chain.

---

## 4. Pre-merge checklist (every phase, every PR)

- [ ] `npm test` is green locally and in CI.
- [ ] No existing `functions/api/*` response shape changed.
- [ ] No existing column/table dropped/renamed; only additive migrations added.
- [ ] `schema-contract.test.mjs` updated to cover any new critical tables.
- [ ] New feature has happy-path + permission + visibility tests.
- [ ] New public UI is behind the feature flag; existing pages still load.
- [ ] Giving path untouched (or, if unavoidable, extra tests + explicit sign-off).

If any box can't be checked, the change is not ready.

This checklist is mirrored in [`../../.github/pull_request_template.md`](../../.github/pull_request_template.md)
so it's enforced on every PR, not just remembered by convention. The repo-wide
(not milestone-scoped) version of this process lives in
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
