# Development Workflow

This is a thin index over process that's already fully specified elsewhere —
it exists so an agent knows where to look, not to restate the rules a second
time (a restated rule drifts from the original; a pointer doesn't).

## Starting a session

Follow `CONTRIBUTING.md` §1 exactly: read `CLAUDE.md`, read
`docs/milestone-v2/README.md` for current milestone status, skim
`docs/testing/COVERAGE-TRACKER.md` for open items in your area, run
`git log --oneline -20` and `git status` to see what actually landed (not
what a stale handoff doc claims), and run `npm test` to confirm a green
baseline before changing anything.

## Branching, commits, PRs

- Small, focused commits. One logical change per commit where practical.
- Every PR uses `.github/pull_request_template.md`, whose checklist mirrors
  `docs/milestone-v2/SAFETY-AND-TESTS.md` §4 — that document is the one
  source of truth for the PR checklist; this file doesn't restate it either.
- See [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) for what happens after
  merge.

## Milestone-scale work: the six-document ritual

For any major feature/milestone (not a routine bugfix), `CLAUDE.md`'s
"Milestone workflow" section applies: PRD → TRD → App Flow → UI/UX Spec →
Backend Schema → Implementation Plan, in order, before implementation
begins. `docs/milestone-v2/` is the live, current example — read it before
starting a new milestone's documents, both to see the pattern and because
the *next* milestone-scale LJM feature (churches, prayer, testimonies, etc.)
is very likely a continuation of that same milestone rather than a new one.
See [`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md)
for the current state of that plan versus what's actually shipped — read
that gap before assuming the six documents are still accurate in every
detail.

## Routine (non-milestone) changes

A routine bugfix or small feature doesn't need the six-document ritual, but
still needs: the discovery steps above, tests per `CONTRIBUTING.md` §2, and
a documentation update if it touches anything listed in
[`AGENT_RULES.md`](./AGENT_RULES.md#documentation-is-part-of-the-implementation).
Use judgment on the line between "routine" and "milestone-scale" — a change
that adds a new table, a new permission scope, or a new page is closer to
milestone-scale even if it's not a whole new feature domain.

## Database changes

Additive-only, manually applied to production. Full rules in
`CONTRIBUTING.md` §4 and [`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md).

## Live-system safety

The giving/money path is frozen (`CONTRIBUTING.md` §3). Never make risky
changes to production-facing functionality without understanding current
behavior, having tests, having a migration/rollback plan where applicable,
and validating the change. This applies with extra weight to anything in
[`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md)'s
frozen surface.
