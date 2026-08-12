# Migration Plan

## The rules (already established, not new)

From `CONTRIBUTING.md` §4 — restated here because this document is about
applying them, not re-deciding them:

- New tables: `CREATE TABLE IF NOT EXISTS`.
- New columns on existing tables: nullable, defaulted, `ALTER TABLE ... ADD
  COLUMN`.
- Never drop, rename, or retype an existing column or table.
- Every migration is applied **manually** to production D1 via
  `workflow_dispatch` (`.github/workflows/deploy-migrations.yml` /
  `apply-d1-migration.yml`) — dry-run and back up first; these workflows
  accept raw SQL with no automated review, so the review is human: get a
  second look, or re-read the SQL slowly after a break, before dispatching
  against production.
- When a new critical table is added, add it to the `REQUIRED` map in
  `tests/regression/schema-contract.test.mjs` so a future breaking migration
  is caught automatically.

## Migrations applied so far

`migrations/0002` through `migrations/0014` (see [`DATA_MODEL.md`](./DATA_MODEL.md)
for what each introduced — dynamic funds/audit, expenses, subscriptions,
purchase attribution, families, bible verses, wishlist images, events,
member appearance, contribution attribution, beta access, and the webhook
backfill). All already folded into `schema.sql` as the current baseline.

## What's next: reconciling the two migration plans

There are currently **two different forward plans** in this repo, and they
are not the same thing — an implementing agent needs to know which one is
actually authoritative before writing `migrations/0015+`.

### Plan A: `docs/milestone-v2/06-implementation-plan.md`'s phases

Proposes: Phase 0 (`0012_churches.sql` + `/api/churches` + feature-flag
plumbing), Phase 1 (`0013_promises.sql`), Phase 2 (`0014_testimonies.sql`),
Phase 3 (`0015`/`0016`, prayer + contact), Phase 4 (`0019_events_church.sql`,
`0018_programs.sql`), Phase 5 (`0017_blog.sql`), Phase 6 (About/language/admin
polish), Phase 7 (cutover). **This numbering has drifted from reality** — the
actual repo's migrations already used `0012`–`0014` for unrelated,
already-shipped work (contribution attribution, beta access, the webhook
backfill) by the time this plan was written. Whoever picks this up needs to
renumber starting from the actual next free number (`0015` as of this
writing — confirm against `migrations/` before creating a new file, don't
trust the numbers in the planning doc literally).

### Plan B: what was actually built (`docs/milestone-v2/11-v2-flow-implementation.md`)

The team pivoted, per an explicit user request recorded in that document,
from Plan A's global `new_home_enabled` feature flag to a per-user
allowlist + signed cookie (`beta_testers` table, `migrations/0013_beta_access.sql`
— this is the actual `0013`, not Plan A's proposed `promises` table). This
shipped a **routing mechanism** and a **restyle of five existing pages** —
it did not implement any of Plan A's new content tables. See
[`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism)
for the mechanism, and [`DATA_MODEL.md`](./DATA_MODEL.md#tables-planned-but-not-yet-built)
for the full list of tables Plan A specifies that don't exist yet.

### Reconciling them

The `beta_testers`/cookie mechanism (Plan B) already answers Plan A's
"feature-flag plumbing" goal — just via a different, already-shipped
mechanism (per-user allowlist rather than a global boolean). **Do not build
`new_home_enabled` in addition** — that would be two competing flag systems
for the same purpose. When resuming Plan A's content-type work (`churches`,
`promises`, `testimonies`, `prayer_requests`, `contact_messages`,
`blog_posts`, `programs`), gate new UI behind the existing `ljm_beta`
cookie/`beta_testers` allowlist, consistent with what's already live, unless
the user explicitly decides otherwise.

`DECISION REQUIRED` before resuming: confirm with the user (a) that Plan B's
mechanism is the one to keep building on, and (b) the actual next migration
number and build order, before creating `migrations/0015_churches.sql` or
similar. Do not silently renumber and proceed — this is exactly the kind of
milestone-scale decision the six-document ritual
(`CLAUDE.md`'s "Milestone workflow") exists to make explicit, and part of
that ritual is already done (docs 01-06 exist) — what's missing is
re-confirming the plan against what actually shipped since those docs were
written, before writing new migrations against a stale numbering scheme.

## Safety checklist for any new migration

Per `docs/milestone-v2/SAFETY-AND-TESTS.md` §3, every new migration/feature
must ship with: a happy-path test, a permission-gate test, a
public-vs-private visibility test where applicable, an additive-schema guard
(extend `tests/regression/schema-contract.test.mjs`), and confirmation that
the existing suite stays green. See
[`../development/TESTING_STRATEGY.md`](../development/TESTING_STRATEGY.md).
