# Code Review Rules

## The checklist

`.github/pull_request_template.md` is the actual checklist every PR uses,
and it mirrors `docs/milestone-v2/SAFETY-AND-TESTS.md` §4 — that document is
the one source of truth for what a reviewer checks; this file doesn't
restate the items, it states how to apply them.

## What a reviewer (human or agent) is specifically watching for in this repo

- **Anything touching the frozen giving path**
  (`functions/api/webhook.js`, `contributions` table shape,
  `functions/api/contributions.js`, `razorpay-checkout.js`) needs an
  explicit, deliberate justification for the change, not just passing tests
  — see [`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md).
  If the PR doesn't explain *why* this frozen surface had to move, that's a
  request-changes, not a nitpick.
- **A new endpoint without a permission-gate test.** Every mutating
  `functions/api/*.js` endpoint must call `requireAuth` (or explicitly
  justify why it's intentionally public, like `subscriptions.js`'s GET) —
  and the test suite must prove an unauthorized caller is rejected. See
  [`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md).
- **A new hard-coded fund/church/event/prayer name in the frontend.** This
  is the single most repeated mistake in this codebase's history — see
  [`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md).
  If a PR adds a new literal string keyed to a specific fund/church/content
  item where a lookup against the relevant API would do instead, flag it.
- **A migration that isn't additive.** Any `DROP`, `RENAME`, column-retype,
  or non-nullable `ADD COLUMN` without a default on an existing table is an
  automatic block per `CONTRIBUTING.md` §4 — no exceptions without an
  explicit, separately-approved decision.
- **A new critical table without a `schema-contract.test.mjs` entry.** See
  [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md#extending-the-schema-contract-tripwire).
- **`script.js`/`admin.html` changes that add a function call without
  confirming the function exists**, or that chain multiple render/init calls
  without individual `try`/`catch`. See `CLAUDE.md`'s "Known pitfall"
  section — this has caused a real production incident (a silently broken
  Analytics tab) and `tests/frontend/analytics-charts.test.mjs`
  regression-tests the specific pattern.
- **A change to `activity_logs` coverage, `ALLOW_LEGACY_EMAIL_TOKEN`, or
  anything else flagged as known debt in
  [`../architecture/`](../architecture/)** — these are documented gaps with
  context on *why* they haven't been fixed yet (usually: they sit inside the
  frozen path and need their own deliberate change). A PR that touches one
  incidentally, as a side effect of unrelated work, should be split out.

## Mutation testing is part of review, not just implementation

Per `CONTRIBUTING.md` §5: for anything security- or money-relevant, the
reviewer should expect to see evidence the author actually broke the
behavior, watched the specific test fail, and reverted — not just that the
suite is green today. A PR description that includes this evidence is doing
the reviewer's job for them; ask for it if it's missing on a sensitive
change.

## What review is not for

Not the place to request unrelated refactoring, speculative abstraction, or
scope expansion beyond what the task needed — see
[`AGENT_RULES.md`](./AGENT_RULES.md#no-unrelated-refactoring). If review
surfaces a real architectural problem outside the PR's scope, the right
output is a note in the relevant [`../architecture/`](../architecture/)
document or a new [`../decisions/ADR/`](../decisions/ADR/) entry, not a
larger PR.
