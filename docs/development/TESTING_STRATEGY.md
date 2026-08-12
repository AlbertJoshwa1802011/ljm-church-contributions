# Testing Strategy

The full, authoritative testing guide is [`../../TESTING.md`](../../TESTING.md)
— harness details, conventions, and how to write a new test file. The live
backlog of coverage gaps is
[`../testing/COVERAGE-TRACKER.md`](../testing/COVERAGE-TRACKER.md). This
document doesn't duplicate either — it's the short orientation for where
testing fits in the bigger picture.

## The shape of the safety net

No compiler, no type checker, no linter — `node --test` (Node's built-in
runner, no external framework) plus `node:sqlite` for a real in-memory SQLite
standing in for D1 is the only thing that catches a mistake before
production. That's why `CONTRIBUTING.md` treats "tests are mandatory" as
load-bearing rather than a style preference, and why
`.github/workflows/deploy.yml`'s `deploy` job has a hard `needs: test`
dependency — a red suite cannot reach production. Don't remove that
dependency; don't add a way around it.

## Two layers

1. **`node --test` suite** (`tests/`) — offline, exercises real
   `functions/api/*.js` handler code against an in-memory SQLite built from
   `schema.sql`. This is what runs in CI and gates deploy.
2. **Production self-test** (`functions/api/selftest.js`, admin console →
   Admin → Self-test) — a live end-to-end check against the real deployment,
   self-cleaning (every test entity is prefixed and hard-deleted in a
   `finally` block regardless of outcome). Useful after a deploy or a
   migration, not a substitute for layer 1.

There is no automated browser/UI test suite. `tests/frontend/*` statically
parses `script.js`/`index.html` source for structural invariants (a called
function is defined, a chain has its try/catch) rather than executing the
DOM — see `CLAUDE.md`'s "Known pitfall" section for exactly why that pattern
exists and what it protects against. A manual verification checklist exists
at `.agents/workflows/verify-portal.md` for UI/CSS changes.

## What every new/changed endpoint needs (from `CONTRIBUTING.md` §2)

Happy path, permission-gate rejection, visibility-boundary enforcement where
applicable (draft/private/pending hidden from public reads), and
not-found/validation edges (400/404, never a silent no-op or a 500). Use the
existing harness (`tests/helpers/mock-d1.mjs`'s `freshDb()`/`makeContext()`)
— don't invent a new one.

## Proving a test actually catches a regression

For anything security- or money-relevant: temporarily break the behavior
(comment out a guard, flip a condition), run the specific test file, confirm
it fails, revert the break, confirm the suite is green again. Cheap, and the
difference between a real safety net and a test that merely exercises code
without asserting anything. `CONTRIBUTING.md` §5 has the full description.

## Extending the schema-contract tripwire

Any new critical table needs an entry in `tests/regression/schema-contract.test.mjs`'s
`REQUIRED` map, so a future migration that drops or corrupts it is caught
automatically rather than discovered in production. This applies to every
table listed as "planned" in
[`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md) once it's
actually built.

## Keeping the tracker current

[`../testing/COVERAGE-TRACKER.md`](../testing/COVERAGE-TRACKER.md) is the
living backlog — when you close a gap, check it off with the test file that
covers it; when you add a new endpoint, add its operations as new rows in
the same change. A backlog that silently grows without the addition being
visible defeats its purpose.
