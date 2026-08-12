# Fund Architecture

## What exists today

Two systems coexist, and this is the single biggest piece of architectural
debt in the codebase relative to the constitution's "config over hardcoding"
principle (§33 / §11):

### 1. The dynamic fund registry (`functions/api/funds.js`, `funds` table)

This is the correct pattern and already works: `funds` (`slug UNIQUE`, `name`,
`description`, `goal_amount`, `status`, `visibility`, `is_system`) plus
`fund_members` for members-only assignment. An admin holding `manage_funds`
can create a fund via `POST /api/funds` with no frontend code change —
`funds.html` appends admin-created funds dynamically after fetching
`/api/funds`, and `header.js`'s fund switcher does the same. `visibility` can
be `public` or `members` (gated to assigned members via `fund_members`).
Deletion is soft (`status='deleted'`) and system funds cannot be deleted or
renamed via the API.

### 2. The two hard-coded "system funds" (`tech-contributions`, `christmas-fund`)

These are seeded with `is_system=1` in `schema.sql`, but they are **not**
just a cosmetic default — they are woven through nearly every layer:

- `functions/api/contributions.js` — the primary giving read/write endpoint
  — is hard-coded to serve **only these two funds**. `normalizeFund()`
  aliases any unrecognized input back to `tech-contributions`. Dynamic funds
  created via `funds.js` are **not** readable through `contributions.js` at
  all; they're read through `funds.js?slug=` instead. This is a real split:
  two different endpoints serve fund data depending on which fund it is.
- `functions/api/webhook.js` and `functions/api/settings.js` independently
  re-implement the same tech/christmas normalization and goal-amount sync
  logic.
- Frontend: `funds.html` has static markup for these two funds with admin
  funds appended after; `script.js` has hard-coded headings, empty-state
  copy, and alias arrays (`LEGACY_TECH`/`LEGACY_XMAS`) keyed to them;
  `header.js`'s fallback fund list and emoji map are hard-coded to them;
  `admin.html`'s manual-entry dropdown, goal-amount settings fields
  (`s_techGoal`/`s_xmasGoal`), and several fallback arrays repeat the same
  pair; `razorpay-checkout.js`'s `fundDisplayName()` hard-codes a binary
  Christmas-or-Tech label; `impact.html`'s filter chips are hard-coded to
  them; the `v2/` beta redesign inherits the same pattern.
- `member-dashboard.js` still points at the **legacy Google Apps Script
  URLs** directly for these two funds, bypassing `/api/` entirely.

This is exactly the pattern the constitution calls out by name as the mistake
not to repeat: *"The previous implementation hard-coded funds such as
Christmas Fund and Tech Fund... This architecture must NOT be repeated."*
It already happened, before this constitution existed, and it's load-bearing
production behavior today — not something to silently refactor as a side
effect of an unrelated task (`CLAUDE.md`/constitution §39, no unrelated
refactoring).

## Why this hasn't been fixed yet

`contributions.js` and the tech/christmas special-casing sit inside the
**frozen giving/money path** (`CONTRIBUTING.md` §3,
`docs/milestone-v2/SAFETY-AND-TESTS.md`). Unifying fund handling so
`contributions.js` treats all funds identically is exactly the kind of change
that requires "an explicit, deliberate decision... plus a mutation-testing
sanity check" — not a drive-by cleanup. `docs/milestone-v2/02-TRD.md` §4
explicitly keeps this path frozen for the current milestone.

## Target architecture

Per the constitution: an admin creates a fund from the admin console — name,
purpose, description, target amount, dates, status, visibility, ranking
config, donor-visibility config, associated media/expenses — and the frontend
renders it automatically, with **zero frontend code changes required.**
Concretely, closing the gap means:

1. `contributions.js`'s read/write model needs to stop special-casing exactly
   two slugs and instead resolve any fund through the `funds` table (or the
   two data paths need to be formally merged into one).
2. Every hard-coded fund reference listed above needs to become a lookup
   against `/api/funds` (already the pattern `header.js`'s `getFunds()`
   correctly follows — that function is the reference implementation to
   generalize from, not to special-case around).
3. `razorpay-checkout.js`'s fund-display logic needs to resolve names from
   the fund registry rather than a binary alias.

This is a substantial, cross-cutting change to a frozen path and should be
scoped as its own reviewed milestone work with its own tests — not attempted
incidentally. This document exists so the next agent who touches funds
understands the debt is real and already scoped, rather than rediscovering it.

## Payment-account configuration (future)

The constitution requires eventual support for multiple Razorpay
accounts/configurations per fund (e.g. Building Fund → Account B, Tech Fund →
Account A), resolved server-side with no fund-specific payment logic in the
frontend. This does not exist today — see
[`PAYMENT_ARCHITECTURE.md`](./PAYMENT_ARCHITECTURE.md#future-multi-account-support) —
`DECISION REQUIRED` on rollout order relative to the fund-hardcoding cleanup
above (the two are related: a clean fund abstraction makes per-fund payment
routing straightforward; doing payment routing first on top of the current
hard-coded model would compound the debt).
