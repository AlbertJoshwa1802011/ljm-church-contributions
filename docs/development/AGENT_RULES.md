# Agent Development Rules — Quality Gates

| | |
|---|---|
| **Purpose** | The mandatory quality-gate checklist for any coding agent session in this repo — what "done" has to mean before a task is reported complete or handed off. |
| **Relationship to other docs** | [`CLAUDE.md`](../../CLAUDE.md) covers repo pitfalls and the milestone-planning ritual. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) covers the baseline engineering process (tests mandatory, money path frozen, additive migrations, CI as a deploy gate). **This file does not restate either — it's the gate an agent checks itself against before calling anything finished.** Read all three before touching code. |
| **Handoffs** | Every session ends with an entry appended to [`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md) — see §11. |

---

## 1. Understand before you change

Do not edit code you haven't read. Before touching a file:

- Read the *current* implementation of the code path end to end — not just the
  diff hunk you intend to change. Trace its callers, its callees, its existing
  tests, and (if it touches persisted data) the relevant `schema.sql` tables.
- Read any existing tests for that path (`tests/api/*`, `tests/frontend/*`,
  `tests/regression/*`) — they encode intent that a docstring won't.
- Check `docs/testing/COVERAGE-TRACKER.md` for known gaps in the area, and
  `AGENT_HANDOFFS.md` + `git log --oneline -20` for in-flight or very recent
  work on the same files, per `CONTRIBUTING.md` §1.
- If you cannot explain, in a sentence or two, what the current code does and
  *why* it's structured that way, you are not ready to change it — keep
  reading first.

This is a gate, not a formality: skipping it is how a fix duplicates existing
logic, reverts an intentional workaround, or reintroduces a bug a past agent
already closed.

## 2. Feature test matrix — mandatory per feature/endpoint

`CONTRIBUTING.md` §2 requires tests for every new/changed endpoint. This
section makes the *shape* of that coverage explicit and non-optional. For
every operation you add or change, work through this matrix and be able to
say, for each row, which test (by file/name) covers it or why it doesn't
apply:

| Dimension | What it proves |
|---|---|
| **Happy path** | The feature does what it's supposed to, with valid input. |
| **Negative path** | Invalid input or invalid state is rejected cleanly (400s, not a 500 or a silent no-op). |
| **Authorization** | An unauthorized/anonymous caller is rejected (`makeContext({ authToken: null })` → `success:false`), and a caller with the wrong permission (but *some* role) is still rejected where the endpoint requires a specific scope. |
| **Regression** | Existing behavior on the touched file is unchanged — add a characterization test first if the path had none, so a future change can't silently break it. |
| **Boundary** | Edge values: empty/zero/negative amounts, max-length strings, pagination limits, empty result sets, first/last page. |
| **Persistence** | The data actually round-trips through the database correctly (correct table, correct columns, correct types) — not just that the endpoint returns 200. |
| **Error case** | Failure of an external dependency (network fetch, missing DB binding) or malformed stored data is handled, not just the clean-input path. |

A matrix row that's "not applicable" (e.g. a read-only endpoint has no
persistence-write case) is fine to skip — but say so, don't silently omit it.
Use the existing harness (`tests/helpers/mock-d1.mjs`, `freshDb()` +
`makeContext()`) — see [`TESTING.md`](../../TESTING.md).

## 3. UI verification requirement

There is no automated browser/E2E harness in this suite — `tests/frontend/*`
statically parses source, it never executes the DOM (see `CLAUDE.md`'s "Known
pitfall" section and `TESTING.md`'s "Manual UI verification"). For any
UI-affecting change (`script.js`, `*.html`, `style.css`/`theme.css`,
`admin.html`):

- **If a browser is available in your environment** (a browser subagent,
  Playwright, or manual walkthrough access): run
  `.agents/workflows/verify-portal.md`'s checklist — viewports, console
  errors, dark mode, the actual rendered feature — and record exactly what
  you checked in your handoff.
- **If no browser is available**: say so explicitly. Write
  `UI verification: NOT PERFORMED (no browser available in this environment)`
  in the handoff. **Never** describe UI work as "verified," "tested," or
  "complete" when it was only reasoned about from source, not rendered. A
  grep-based structural test (e.g. "the function is defined and called")
  proves the code doesn't have a typo'd reference — it does not prove the
  feature renders or behaves correctly on screen. Those are different claims;
  keep them distinct in your report.

## 4. Database migration verification

Per `CONTRIBUTING.md` §4, migrations are additive-only and applied manually
against production. Before considering a migration done:

- Run it against `freshDb()`'s in-memory SQLite (or a scratch copy of
  `schema.sql`) and confirm it applies cleanly from a fresh baseline.
- Confirm it's additive: `CREATE TABLE IF NOT EXISTS` / nullable, defaulted
  `ALTER TABLE ... ADD COLUMN` only — no drop/rename/retype of anything
  existing.
- Add any new critical table/column to the `REQUIRED` map in
  `tests/regression/schema-contract.test.mjs`.
- State explicitly, in the handoff, whether the migration was actually
  **dispatched against production D1** or is still **pending human
  dispatch**. These are not the same status — "migration file written and
  tested locally" is not "production schema updated." Never conflate them.

## 5. Production verification is a distinct claim

`npm test` passing proves the change works against the in-memory SQLite mock
(`tests/helpers/mock-d1.mjs`). It does **not** prove it works against a real
Cloudflare Pages deployment and real D1. Keep three claims separate and never
collapse them into one "done":

1. **Implementation complete** — the code is written.
2. **Tests passing (offline harness)** — `npm test` is green locally.
3. **Production-verified** — actually exercised against the live deployment
   (the `functions/api/selftest.js` tab, or an explicit manual production
   check with evidence of what was checked and its result).

Do not write "verified in production," "deployed and working," or similar
unless you did #3. If you only did #1–#2, say exactly that.

## 6. Money/payment-path enhanced verification

`CONTRIBUTING.md` §3 freezes the giving/money path
(`functions/api/webhook.js`, the `contributions` table incl. `proof_id
UNIQUE`, `functions/api/contributions.js`'s read model, and
`razorpay-checkout.js`). Any touch to these — even one judged unavoidable —
requires, beyond the standard test matrix (§2):

- An explicit, deliberate sign-off statement in the handoff: what changed,
  why it couldn't be avoided, and what could break if it's wrong.
- Extra tests specifically targeting the money-critical invariants: paise→₹
  conversion, IST timestamps, idempotency (`proof_id UNIQUE`), fund
  attribution.
- A mutation-testing pass (§7) on every changed guard/invariant, not just the
  new happy-path test.
- An explicit list, in the handoff, of exactly which money-path files were
  touched and why — never a change to this area without that call-out.

## 7. Mutation-testing requirement

`CONTRIBUTING.md` §5 already requires this for security/money-relevant
changes; this rule makes the scope explicit: **any change to an
authorization check, permission gate, input-validation guard, or
idempotency/uniqueness guarantee** — not only the money path — needs a
mutation-testing pass before it's considered proven:

1. Temporarily break the behavior (comment out the guard, flip a condition,
   remove the validation).
2. Run the specific test file and confirm it now **fails**.
3. Revert the break.
4. Confirm `git diff` on the source file is empty and the suite is green
   again.

A test that passes today but was never shown to fail against a broken
implementation is not proven — it may be asserting nothing meaningful. State
in the handoff which guards were mutation-tested and that step 2 actually
failed as expected.

## 8. Discovery classification

Agents routinely find things while working that aren't the task they were
asked to do (a latent bug, a missing guard, a stale doc). Classify every such
discovery before reporting it, using this scale:

| Label | Meaning |
|---|---|
| **BLOCKER** | Prevents the current task from being completed or safely shipped. Must be resolved or explicitly escalated before finishing. |
| **HIGH RISK** | Doesn't block this task, but is a real, currently-exploitable correctness/security/money-path problem. Flag prominently in the handoff; fix now if small, otherwise open a tracked item. |
| **REGRESSION** | Something that used to work and no longer does, introduced by a prior change. Note which commit/PR if identifiable. |
| **PRE-EXISTING BUG** | Wrong behavior that predates this session's work and isn't caused by it (e.g. the `auth.js` `.meta.changes` bug recorded in `COVERAGE-TRACKER.md`). Fix alongside if cheap and in-scope; otherwise record it. |
| **TECH DEBT** | Works correctly today but is fragile, undocumented, or hard to extend. Record it; don't let it block the current task. |
| **INFORMATIONAL** | Worth noting for the next agent/human, not actionable on its own (e.g. "this doc didn't exist yet, so I created it"). |

Record test-coverage-shaped discoveries in `docs/testing/COVERAGE-TRACKER.md`
(its existing "Bug found and fixed while writing this test" entries are the
established pattern). Record everything else — classified — in your
`AGENT_HANDOFFS.md` entry (§11).

## 9. No false COMPLETE status

Never report a task, PR, or handoff as `COMPLETE` / `DONE` while any
acceptance criterion is unverified. If implementation is done but UI
verification wasn't performed (§3), or tests pass offline but production
wasn't checked (§5), say exactly that — use explicit partial-status language:

- `IMPLEMENTATION COMPLETE — offline tests passing — UI verification NOT PERFORMED`
- `IMPLEMENTATION COMPLETE — offline tests passing — production verification NOT PERFORMED`

A status that overstates what was actually checked is worse than no status at
all — it tells the next agent or the human reviewer it's safe to stop
checking, when it isn't.

## 10. Parallel-agent branch and document synchronization

Multiple agent sessions work in this repo concurrently, often without one
knowing what another just did (`CONTRIBUTING.md` §1). On top of that section:

- Before starting, check `git log --oneline -20`, `git status`,
  `docs/testing/COVERAGE-TRACKER.md`, and `AGENT_HANDOFFS.md` for work already
  in flight on the area you're about to touch.
- Shared living documents (`COVERAGE-TRACKER.md`, `AGENT_HANDOFFS.md`,
  `docs/milestone-v2/README.md`'s status tracker) are **append/edit-in-place,
  never overwrite**: add new rows/entries, check off existing ones, don't
  delete or rewrite another agent's entry to "clean up." A checked-off row or
  a past handoff entry is a historical record, not clutter.
- If your work and another in-flight branch touch the same schema/migration
  numbering or the same endpoint, resolve it the way `8d7434c` did (see `git
  log`): merge/rebase and reconcile explicitly, call it out in your commit
  message, rather than silently overwriting the other branch's work.

## 11. Mandatory final handoff

Every agent session that changes anything in this repo ends by appending an
entry to [`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md) — not editing or replacing
a previous entry, appending a new one — containing, at minimum:

- Task/session summary, branch name, date.
- The **exact** test command(s) run (e.g. `npm test`) and the **exact**
  result (pass/fail counts, not "tests pass").
- What was explicitly **not** verified (UI, production — per §3/§5) rather
  than silently omitted.
- Any discoveries, classified per §8.
- Current status using the explicit vocabulary from §9 — never a bare
  "COMPLETE" if any criterion above is unverified.

## 12. Never merge or push another agent's branch without explicit instruction

Agents must not merge, force-push, rewrite history on, or push commits to a
branch another agent session created or owns, unless the user has explicitly
instructed that specific action for that specific branch in the current
task. Discovering another agent's in-progress branch is information to read
and work around (§10), not permission to act on it. This applies even when
merging would be "obviously" the right next step — surface it to the user
and let them decide, or wait for explicit instruction.
