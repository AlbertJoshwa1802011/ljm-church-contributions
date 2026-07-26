## What changed and why

<!-- One or two sentences. Link a milestone doc (docs/milestone-v2/) if this is milestone work. -->

## Pre-merge checklist

Mirrors `docs/milestone-v2/SAFETY-AND-TESTS.md` §4 — full detail there, this is the summary:

- [ ] `npm test` is green locally.
- [ ] Every new/changed endpoint has tests: happy path + permission gate + visibility boundary (see `CONTRIBUTING.md` §2).
- [ ] No existing `functions/api/*` response shape changed.
- [ ] No existing column/table dropped/renamed — only additive migrations (`CREATE TABLE IF NOT EXISTS` / nullable `ADD COLUMN`).
- [ ] `tests/regression/schema-contract.test.mjs` updated if a new critical table was added.
- [ ] `docs/testing/COVERAGE-TRACKER.md` updated — new rows for new endpoints, checked-off rows for gaps closed.
- [ ] The giving/money path (`webhook.js`, `contributions` table, `razorpay-checkout.js`) is untouched — or, if unavoidable, extra tests + explicit sign-off are included below.
- [ ] If this touches security/permissions/money, a mutation-testing pass was done (break it, confirm the new test fails, revert) — see `CONTRIBUTING.md` §5.

If any box can't be checked, say why below — the change may still be fine, but it needs a reason, not a silent gap.

## Notes
