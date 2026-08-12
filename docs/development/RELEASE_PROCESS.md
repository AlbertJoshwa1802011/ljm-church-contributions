# Release Process

## Deploy: automatic on merge to `main`, gated on tests

`.github/workflows/deploy.yml` runs on every push to `main`. Its `deploy`
job has `needs: test` — the full `npm test` suite must pass before
Cloudflare Pages publishes. There is no separate staging environment or
manual deploy approval step: merging to `main` with a green suite is the
release. This is why `CONTRIBUTING.md`'s "tests are mandatory" and "CI is a
deploy gate, not a suggestion" rules exist — they're the entire release
safety mechanism, not one layer among several.

Do not remove the `needs: test` dependency, and do not add a way to bypass
it (`--no-verify` on hooks, skipping the workflow, etc.) — see
`CONTRIBUTING.md` §5.

## Database migrations: manual, separate from code deploy

Migrations are **not** part of the automatic `main` deploy. They're applied
by hand via `workflow_dispatch`
(`.github/workflows/deploy-migrations.yml` / `apply-d1-migration.yml`)
against production D1, with a dry-run-and-backup step first. See
[`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md) for
the additive-only rules and current migration-numbering state. Because these
workflows accept raw SQL/arbitrary migration files with no automated review,
the review is human — get a second look, or re-read the SQL slowly after a
break, before dispatching one against production. This is the one place in
the pipeline CI cannot save you.

## Feature rollout: behind a flag, not a big-bang cutover

New user-facing surfaces ship gated, not directly to every visitor. The
currently-live mechanism is the `ljm_beta` signed-cookie + `beta_testers`
allowlist (see
[`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism)) —
use this for any new gated rollout rather than introducing a second,
competing flag mechanism (see
[`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md) for
why a second mechanism, `new_home_enabled`, was planned but correctly never
built once the team pivoted to the allowlist approach).

## Rollback

- **Code**: revert the merge commit; the next `main` push redeploys the
  previous state (subject to the same test gate).
- **A gated feature**: remove the allowlisted testers, or disable the
  feature's specific gate — data written by the new feature is untouched,
  since all new-feature schema changes are additive-only by construction.
- **A migration**: there is no automated rollback for a production D1
  migration. This is exactly why migrations must be additive-only (a bad
  additive migration can usually be left in place harmlessly, or reversed by
  a hand-written follow-up migration) and why the dry-run-and-backup step is
  not optional.

## Production verification after a risky change

For anything touching the payment path or a schema change, use
`functions/api/selftest.js` (admin console → Admin → Self-test) as a live,
self-cleaning end-to-end check after deploy, and
`functions/api/verify.js` (admin console usage, `view_members`) to
reconcile D1 against the legacy Sheets source if the change is anywhere near
contribution data. See
[`../operations/TROUBLESHOOTING.md`](../operations/TROUBLESHOOTING.md).
