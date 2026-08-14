# Migrations

## How this actually works today

There is **no migration framework and no migration ledger** in this repo —
no `schema_migrations` table, nothing that tracks "which migrations have
been applied to production D1". Each file here is applied by hand, once,
directly against production via a GitHub Actions `workflow_dispatch`:

- `.github/workflows/deploy-migrations.yml` — a dropdown of known migration
  files, runs `wrangler d1 execute --file=...`.
- `.github/workflows/apply-d1-migration.yml` — the same execution mechanism,
  but takes a free-text file path or raw SQL instead of a dropdown.

Both just call `wrangler d1 execute`. Neither workflow, nor `wrangler`
itself, knows or cares what the numeric prefix on a migration filename
means — the number is a purely human convention for ordering and
discoverability. Applying a migration is choosing a file by its exact name,
not by a number.

`schema.sql` is the separate, hand-maintained source of truth for a fresh
database — every migration's changes are expected to also be reflected
there, since `tests/helpers/mock-d1.mjs`'s `freshDb()` (and therefore
`npm test`) builds a database from `schema.sql`, never by replaying
`migrations/*.sql`.

Convention (see `CONTRIBUTING.md` §4, unchanged by this doc): every
migration is additive-only — `CREATE TABLE IF NOT EXISTS`, nullable/defaulted
`ALTER TABLE ... ADD COLUMN`, `INSERT OR IGNORE`. Never drop, rename, or
retype an existing column or table.

## Validation: `tests/regression/migrations-validate.test.mjs`

Before this hardening pass, nothing executed `migrations/*.sql` at all — a
migration could drift from `schema.sql` indefinitely without `npm test`
noticing (they're independent, hand-maintained artifacts). That test file
closes the gap with a validation strategy fitted to how this repo actually
works, rather than a bolted-on migration framework:

1. **Replay against `schema.sql`.** `schema.sql` is the accumulated
   end-state of every migration ever written, so it's a valid stand-in for
   "a database that already has everything applied." Every statement in
   every migration file is executed against it:
   - Idempotent statements (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF
     NOT EXISTS`, `INSERT OR IGNORE`, `UPDATE ... SET <fixed value>`, and
     plain `INSERT`/`UPDATE` for data-only migrations like 0014) must
     **succeed**. Any failure means malformed SQL, a wrong table/column
     reference, or a genuine ordering problem.
   - `ALTER TABLE ... ADD COLUMN` (the one non-idempotent statement shape
     used here — SQLite has no `ADD COLUMN IF NOT EXISTS`) must **fail**
     with `duplicate column name`, because `schema.sql` should already
     carry that column. If it *succeeds* instead, `schema.sql` is missing a
     column a real migration adds — that's schema/migration drift, and the
     test fails loudly with that exact explanation. (Verified directly:
     temporarily deleting `wishlist.image_url` from `schema.sql` and
     re-running the suite makes the 0010 test fail with this message, then
     restoring `schema.sql` makes it pass again.)
2. **Static ordering check.** A lightweight scan (not a real SQL parser)
   walks migrations in numeric order and tracks which tables are known at
   each point — the seven tables that predate `migrations/` entirely
   (`members`, `contributions`, `purchases`, `config`, `wishlist`, `roles`,
   `member_roles`, all defined only in `schema.sql`) plus every table a
   migration has created so far. Any `ALTER TABLE` / `INSERT INTO` /
   `UPDATE ... SET` / `... FROM` reference to a table not yet known fails —
   catching a migration numbered or written out of order.
3. **Numbering guard.** Fails if any migration number is duplicated other
   than the documented `0011` pair (see below), or if a numbering gap
   appears.
4. **0015 gets a dedicated, from-scratch run.** Its own test builds the
   `funds` table exactly as it looked *before* 0015 (i.e. without the six
   columns it adds), executes 0015's real SQL against it, and asserts the
   resulting column types, nullability, defaults, and that the columns are
   actually usable (round-trip insert/read) — not just tolerated as a
   duplicate-column no-op like the other migrations.
5. **Picker staleness guard.** Asserts every migration from 0005 onward has
   a matching entry in `deploy-migrations.yml`'s dropdown, so it can never
   again silently stop short of the newest migration (see below).

This is deterministic, runs in `npm test` (no network, no real D1), and adds
no new tooling or dependency — it's assertions over `node:sqlite`, the same
primitive `tests/helpers/mock-d1.mjs` already uses.

### Why not replay every migration from an empty database?

`migrations/` starts at `0002`. `0001` never existed as a file — the base
tables (`members`, `contributions`, `purchases`, `config`, `wishlist`,
`roles`, `member_roles`) predate the migrations folder and live only in
`schema.sql`. Reconstructing a synthetic "0001" migration to make a
from-empty replay possible would mean maintaining a second, hand-guessed
copy of history in parallel with `schema.sql` — exactly the "migration
framework" this hardening task was scoped to avoid building. Replaying
against `schema.sql` (option 1 above) gets the same practical guarantees
(malformed SQL, ordering, drift) without inventing that second copy.

## `deploy-migrations.yml`'s picker: known limitation

GitHub Actions `type: choice` inputs must list their options statically in
the workflow YAML — there's no supported way to populate a dropdown from
`migrations/`'s actual contents at dispatch time. That's exactly how this
picker went stale: it stopped at `0011_events` / `0011_member_appearance`
while the repo moved on through `0015`, silently hiding four newer
migrations from the operational UI.

This pass extended the list through `0015` and added the picker-staleness
test described above (item 5), so a future migration that isn't added to
the dropdown fails CI instead of silently going missing from the UI again.
The list still has to be edited by hand for every new migration — that's
inherent to `type: choice`, not fixable without either (a) switching this
workflow to a free-text input like `apply-d1-migration.yml` already uses
(which would remove the guided list entirely — a real safety trade-off for
a workflow whose whole point is a curated, typo-resistant picker, so this
pass didn't make that call unilaterally) or (b) a periodic/generated step
outside the workflow's own YAML. The CI test is the safety net in the
meantime.

The dropdown intentionally still starts at `0005`, not `0002` — migrations
`0002`–`0004` predate this workflow's creation and were already applied to
production before it existed; the picker-staleness test only requires
`0005` onward to be listed.

## The duplicate `0011`

`migrations/0011_events.sql` and `migrations/0011_member_appearance.sql`
share a number. This predates the current hardening batch (see `0013`'s own
header comment: `"Renumbered from 0012 during merge; slot 0012 was taken
by..."` — a prior instance of exactly this kind of collision being resolved
by picking the next free number instead of leaving a duplicate). This task
was scoped to **investigate, not remediate**. Findings:

**How the runner handles it: it doesn't need to.** There is no
numeric-prefix parsing anywhere in the codebase — not in `deploy-migrations
.yml`, not in `apply-d1-migration.yml`, not in `wrangler`. Both workflows
apply a migration by its exact, full filename (`wrangler d1 execute --file
=./migrations/<name>.sql`), and `deploy-migrations.yml`'s dropdown already
lists `0011_events` and `0011_member_appearance` as two distinct options.
Nothing anywhere treats "0011" as a lookup key or an ordering/applied-state
marker. The duplicate number never reaches any code path that resolves
migrations by number.

**Is it dangerous today? No — not technically.** The two files touch
entirely disjoint schema objects (`events` / `event_photos` vs.
`member_preferences`), share no dependency on each other, and can be applied
in either order or independently with no conflict; `schema.sql` already
carries both side by side without incident (and the new replay-based
validation test in this pass runs both against it cleanly). The only real
risk is **human**, not technical: someone scanning a checklist or an
operator picking "migration 0011" from memory could believe there is one
migration numbered 0011 and only apply one of the two files, silently
leaving the other's tables missing in production. That's a documentation/
process risk, not a runner or data-integrity risk.

**Future-safe remediation, if this is ever revisited:** follow the same
pattern `0013` already used for the previous 0012 collision — pick the next
free number (currently `0016`) for one of the two files, rename it, and add
a header comment on the renamed file cross-referencing the old name (so
anyone grepping history for the old filename still finds it), then update
`deploy-migrations.yml`'s dropdown and this doc to match. Renaming itself
carries no execution risk (application is filename-driven and manual, not
tracked by any ledger), but choosing *which* of the two files to renumber,
and confirming production's actual apply-state for both, needs a human who
can check the real deployment history — not something to do "casually" from
the repo alone. That's exactly why this task scoped it as investigate-only.
