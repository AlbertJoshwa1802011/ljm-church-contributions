# Agent Rules — the engineering constitution for this repo

This is the durable process every agent (human or AI) follows when changing
this codebase. It does not replace `CONTRIBUTING.md` or `CLAUDE.md` — those
remain the binding, specific process documents (test requirements, the
frozen giving path, the milestone-document ritual). This file adds the
broader judgment principles those two documents assume but don't spell out,
and exists because this repo is built by many agent sessions, often without
one knowing what another just did.

**Read order for a new session**: `CLAUDE.md` → `CONTRIBUTING.md` → this
file → `docs/README.md` and onward as needed for the task at hand.

## The absolute principle

**Build for the system, not the ticket.**

Do not implement the smallest patch that makes an immediate request pass.
Understand why the requirement exists, how it fits LJM as a whole, what
existing functionality it touches, what future functionality depends on it,
and what security/data/audit/migration implications it has. Then implement
the smallest **architecturally correct** solution — not a superficial patch
merely to make a test pass, and not a speculative abstraction for
requirements nobody has asked for yet. Both directions are failure modes:
under-building creates debt (see
[`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md)
for a concrete example of what that costs later); over-building violates
"no unrelated refactoring" and "don't design for hypothetical future
requirements" below.

## Roles: architect vs. implementation agent

Architecture and product decisions are owned by the project architect (the
human, or the session explicitly acting in that capacity) and recorded in
this `docs/` tree — [`../product/`](../product/), [`../architecture/`](../architecture/),
and [`../decisions/ADR/`](../decisions/ADR/). An **implementation agent does
not independently redefine product requirements or architecture** while
carrying out a task, no matter how reasonable an alternative seems mid-task.

Concretely:

- If a task's instructions conflict with what this `docs/` tree already
  says, **stop and document the conflict** — don't silently pick whichever
  side seems more convenient to implement. Record it under "Questions /
  decisions required from the architect" in the handoff report (see below)
  and, if it's a genuine fork in the system's design, leave a
  `DECISION REQUIRED` note in the relevant architecture document.
- If a requirement is ambiguous, take the safest interpretation consistent
  with the existing documentation, implement that, and clearly report the
  ambiguity — don't silently guess and move on as if it were never in
  question.
- Discovering that an existing document is wrong or stale is different from
  disagreeing with it — the former gets corrected (with the correction
  explained in the commit/handoff), the latter gets escalated as a question,
  not resolved unilaterally in code.

## Before touching code

1. Inspect the relevant part of the existing repository — don't assume; this
   codebase has surprises (two competing payment webhooks in its history,
   two different feature-flag mechanisms in its planning docs vs. what
   shipped — see [`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md)).
2. Read `CONTRIBUTING.md` §1's discovery steps: `CLAUDE.md`,
   `docs/milestone-v2/README.md`, `docs/testing/COVERAGE-TRACKER.md`,
   `git log --oneline -20`, `git status`, and run `npm test` to confirm a
   green baseline before changing anything.
3. Check whether this `docs/` tree already documents the area you're about
   to touch — [`../architecture/`](../architecture/) and
   [`../product/REQUIREMENTS.md`](../product/REQUIREMENTS.md) exist
   specifically so you don't have to re-derive architecture or status from
   scratch every session.

## Root cause, not symptom (bug fixes)

Do not patch the failing line immediately. Reproduce the problem, trace the
execution path, identify the actual root cause, understand why the existing
design allowed it, determine whether the issue is local or architectural,
implement the correct fix, add a regression test, run relevant and then
broader tests, and document the result. Every bug-fix completion report
includes:

```
Root Cause: ...
Why the existing implementation failed: ...
Correct Fix: ...
Regression Test: ...
```

## Testing — see `CONTRIBUTING.md` for the specifics

The rule that "every new or changed endpoint ships with tests in the same
change" is not restated here — go read it. What this file adds: never
declare a task complete while relevant tests are failing, never weaken a
test or delete an assertion to get to green, never mock away the actual
failure being tested for. If a pre-existing unrelated failure exists,
document it clearly rather than silently working around it.

**Reporting is not optional and is not approximate:**

- Record the **exact command** run (`npm test`, or a scoped
  `node --test tests/api/funds.test.mjs`, etc.) and the **exact result**
  (pass/fail counts, or the specific failure) in the handoff report. A
  paraphrase ("tests pass") without the command and the actual output is not
  an acceptable substitute.
- **Never claim a test passed unless it was actually executed in this
  session.** Don't infer a test would pass from reading the code.
- **Never claim production verification occurred unless it actually did.**
  `functions/api/selftest.js` against the real deployment is the only thing
  that counts as production verification — running the local `node --test`
  suite is not the same claim and must not be described as if it were.
- If a test fails: understand the failure, identify the root cause, fix the
  implementation (not the test) unless the test itself is demonstrably
  wrong, rerun it, and only then move on. Do not bypass, weaken, or delete a
  test to make a failure go away.

## Definition of done

- [ ] Requirement understood, existing implementation inspected
- [ ] Architecture reviewed (checked against this `docs/` tree)
- [ ] Root cause identified, if a bug
- [ ] Correct implementation completed — not a superficial patch
- [ ] Tests added/updated (unit, integration, regression as applicable) and
      passing
- [ ] Existing relevant tests pass; `npm test` is green
- [ ] Security and permissions reviewed (server-side enforcement — see
      [`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md))
- [ ] Audit requirements reviewed (does this change need an `audit()` call —
      see [`../architecture/AUDIT_ARCHITECTURE.md`](../architecture/AUDIT_ARCHITECTURE.md))
- [ ] Documentation updated (this tree, and/or `docs/milestone-v2/` if the
      milestone plan itself changed)
- [ ] ADR added if an architectural decision was made — see
      [`../decisions/ADR/`](../decisions/ADR/)
- [ ] No unrelated behavior broken
- [ ] Handoff report written and appended to
      [`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md) (see below)

## Documentation is part of the implementation

Update documentation whenever a change affects architecture, product
behavior, API contracts, the database, permissions, security, audit,
operations, or configuration. A change without a documentation update is not
finished, even if the code and tests are correct — the next agent needs to
find the truth here, not rediscover it by re-reading source.

## Architecture decisions need an ADR

Any decision that changes the shape of the system going forward (a new
table's design, a new auth mechanism, a payment-routing change) gets an ADR
in [`../decisions/ADR/`](../decisions/ADR/) — title, status, context,
problem, decision, alternatives considered, consequences, migration
implications. Don't silently introduce a major architectural change and
leave only a commit message as the record.

## Configuration over hardcoding

Never hard-code individual funds, churches, prayers, events, payment
accounts, homepage campaigns, or rankings when the behavior should be
data-driven. This repo already has one expensive example of what happens
when this rule is skipped — see
[`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md).
Don't add a second one.

## Reuse before building

Before creating a new service, component, helper, or system, search the
existing repository for equivalent functionality. This codebase already has
patterns worth reusing rather than reinventing: the `_lib.js#requireAuth`/
`audit()` pipeline for any new admin endpoint, the `funds.js`
public-listing-with-admin-elevation pattern for any new content-listing
endpoint, the `config` key/value table for any new global setting or feature
flag (before proposing a new mechanism). Don't introduce a new
framework/library without justification — this is deliberately a no-build,
no-dependency static site.

## No unrelated refactoring

Don't use a feature task as an excuse to refactor unrelated code. If you
discover an architectural problem while working on something else, document
it (this `docs/` tree, or a note in the relevant architecture doc) rather
than fixing it inline — unless it must be fixed for the current feature to
work correctly, in which case fix it carefully and explain why in the
handoff report. Otherwise, it's follow-up work, not part of this change.

## Parallel agent development

Multiple agents may work simultaneously on this repo. Before starting:

1. **Identify the expected files/directories the task requires**, and
   confirm that footprint is actually necessary before touching anything
   outside it. If the honest footprint turns out to be broad (touches
   shared infrastructure like `_lib.js`, `schema.sql`, or a file several
   features depend on), **report that shared-file/conflict risk up front,
   before making the change** — not after, in the handoff.
2. **Inspect current usage of shared infrastructure before modifying it** —
   grep for every caller, don't assume a helper's contract from its name.
3. **Do not assume another agent's prior work is correct without
   verification.** A previous session's plan or handoff report is a
   starting point, not ground truth — re-inspect the actual current state
   of the code and this `docs/` tree (see
   [`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md)
   for a concrete example of a documented plan that drifted from what
   actually shipped).
4. **Prefer tasks that can be implemented independently** — decompose work
   so unrelated areas (e.g. fund backend vs. prayer UI) touch minimally
   overlapping files, so two agents working in parallel don't collide.
5. If a task conflicts with another architectural change already in flight
   or already documented, **document the conflict rather than resolving it
   unilaterally** — see "Roles: architect vs. implementation agent" above.

Keep changes focused; avoid unnecessary shared-file edits; use small,
focused commits; document dependencies; clearly report which files changed
in the handoff report.

## No guessing

If a requirement or existing behavior is unclear, investigate first — read
the relevant architecture doc, the source, the tests. If it's still unclear
after investigating, do not invent behavior silently. Mark it
`DECISION REQUIRED`, state the exact question, and surface it to the user
rather than proceeding on an assumption. This `docs/` tree already contains
several live examples of this marker — see
[`../product/REQUIREMENTS.md`](../product/REQUIREMENTS.md) and
[`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md) —
follow the same pattern for anything new you encounter.

## Git discipline

- Do not push, force-push, or rewrite history unless the task explicitly
  instructs it. Committing locally is normally fine; publishing is a
  separate, explicit decision.
- Never skip hooks or bypass CI to land a change faster.
- Make small, focused commits with clear messages describing *why*, not
  just *what* — the diff already shows what changed.
- Before finishing, report `git status` and the relevant commit hash(es) in
  the handoff report, so the next agent (or the architect) can see exactly
  what state the branch is in without re-deriving it.

## Handoff report

Every completed task produces a handoff report with these fields, and the
report is **persisted in
[`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md)** — appended as a new dated entry,
not left only in a chat reply that disappears with the session. Important
project knowledge must not depend on conversation history.

```
## <date> — <short task title> (<agent/session identifier if known>)

### Status
COMPLETE | PARTIALLY_COMPLETE | BLOCKED | NOT_STARTED

### What changed

### Files changed

### Architecture decisions / discoveries
(anything learned about the system that the docs/ tree didn't already say —
update the relevant architecture doc in the same change, and note it here too)

### Database changes
(or "None")

### API changes
(or "None")

### UI changes
(or "None")

### Permissions / security changes
(or "None")

### Tests added / modified

### Tests executed and exact results
(exact command(s) run, exact pass/fail output — see "Testing" above)

### Documentation updated

### Known limitations / remaining work

### Known risks

### Git status
(branch, commit hash(es), pushed or not)

### Questions / decisions required from the architect
(or "None")

### Recommended next step
```

Use the same four-value status vocabulary every time
(`COMPLETE`/`PARTIALLY_COMPLETE`/`BLOCKED`/`NOT_STARTED`) so status is
scannable across entries without reading each one in full. Do not claim
`COMPLETE` if tests weren't actually run, if documentation wasn't actually
updated, or if any part of the task was skipped — use
`PARTIALLY_COMPLETE` and say exactly what's missing.

## The final principle

LJM must be maintainable, configurable, secure, testable, auditable,
observable, accessible, multilingual, mobile-friendly, production-safe, and
understandable by both future agents and human administrators — scalable to
more churches, more funds, more ministry features. Most importantly: **don't
build a collection of features. Build a coherent ministry platform.**
