# LJM Documentation — start here

This is the single source of truth for the Light of Jesus Ministry (LJM)
platform: what it is, how it's built, and the process every agent (human or
AI) follows to change it. Multiple agents work on this repo, often without
one knowing what another just did — this tree exists so none of them have to
guess.

## Read in this order

1. **[`CLAUDE.md`](../CLAUDE.md)** (repo root) — the standing pitfalls list and
   the milestone-planning ritual. Read first, every session.
2. **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** (repo root) — the mandatory
   engineering process: tests required for every endpoint change, the
   giving/money path is frozen, CI blocks a red suite from deploying,
   migrations are additive-only. This is not optional.
3. **This tree** (`docs/`) — the permanent architecture, product, and process
   documentation described below.
4. **[`docs/milestone-v2/README.md`](./milestone-v2/README.md)** — the
   *current, active milestone*: reworking LJM from a fund-contribution portal
   into a full worldwide ministry app. Its six planning documents (PRD → TRD →
   App Flow → UI/UX → Backend Schema → Implementation Plan) are the
   authoritative source for *where the product is going*. **This foundation
   tree does not duplicate that plan — it extends it, cross-references it, and
   distinguishes what milestone-v2 has *planned* from what has actually
   *shipped*** (see [`architecture/MIGRATION_PLAN.md`](./architecture/MIGRATION_PLAN.md)
   and [`product/REQUIREMENTS.md`](./product/REQUIREMENTS.md) for that
   planned-vs-shipped distinction — it matters, because the gap is larger than
   a skim of the six documents suggests).

## How this tree is organized

| Directory | What it holds |
|---|---|
| [`product/`](./product/) | What LJM is, who it serves, what the public site and admin console must do |
| [`architecture/`](./architecture/) | How the system is actually built today, and the target architecture for each subsystem |
| [`development/`](./development/) | The engineering constitution and workflow every agent follows |
| [`decisions/ADR/`](./decisions/ADR/) | Architecture Decision Records — why we chose what we chose |
| [`features/`](./features/) | One-page-per-feature index: status, owner docs, key files |
| [`operations/`](./operations/) | Logging, monitoring, and troubleshooting the live system |

## Where to document what — a lookup, not a suggestion

If you're not sure where something belongs, use this table before creating a
new file. Don't create a second document for something that already has a
home below — extend the existing one.

| I need to record... | It goes in |
|---|---|
| A product requirement or its status (live/planned/undecided) | [`product/REQUIREMENTS.md`](./product/REQUIREMENTS.md) (detail) / [`product/PRODUCT_VISION.md`](./product/PRODUCT_VISION.md) (why) |
| How a subsystem is built, or should be | The matching file in [`architecture/`](./architecture/) — see that directory for the current list (system, data model, church, fund, payment, permission, audit, notification, migration) |
| An architecture decision and its alternatives | A new file in [`decisions/ADR/`](./decisions/ADR/), using [`decisions/ADR/0000-template.md`](./decisions/ADR/0000-template.md) |
| What a specific feature does, its status, and its key files | [`features/README.md`](./features/README.md) |
| A process/engineering rule every agent must follow | [`development/AGENT_RULES.md`](./development/AGENT_RULES.md) — the engineering constitution |
| How day-to-day development, testing, review, or release actually works | [`development/DEVELOPMENT_WORKFLOW.md`](./development/DEVELOPMENT_WORKFLOW.md), [`development/TESTING_STRATEGY.md`](./development/TESTING_STRATEGY.md), [`development/CODE_REVIEW_RULES.md`](./development/CODE_REVIEW_RULES.md), [`development/RELEASE_PROCESS.md`](./development/RELEASE_PROCESS.md) |
| Logging, monitoring, or a troubleshooting procedure | [`operations/`](./operations/) |
| **The current milestone's live implementation status** (which phase is done, what's next) | [`milestone-v2/README.md`](./milestone-v2/README.md) (the active milestone's tracker) and [`testing/COVERAGE-TRACKER.md`](./testing/COVERAGE-TRACKER.md) (test-coverage backlog) |
| **A completed task's handoff report** (what changed, tests run, discoveries, remaining work) | [`development/AGENT_HANDOFFS.md`](./development/AGENT_HANDOFFS.md) — append a new entry, every time, per [`development/AGENT_RULES.md`](./development/AGENT_RULES.md#handoff-report) |

## Multi-agent development contract

This repository is built by multiple agents, sometimes in parallel, and is
meant to be understandable without depending on any one conversation's
history. [`development/AGENT_RULES.md`](./development/AGENT_RULES.md) is the
binding contract for how that works in practice: architecture/product
decisions belong to the project architect and are recorded in this tree, not
redefined mid-task by an implementation agent; every task ends with a
handoff report appended to
[`development/AGENT_HANDOFFS.md`](./development/AGENT_HANDOFFS.md); tests
must be actually executed and reported with exact commands and results,
never assumed or claimed; and shared-file/conflict risk gets reported before
a broad change is made, not after. Read that file in full before starting
implementation work, not just this summary.

## The one rule that overrides convenience

**Build for the system, not the ticket.** This repo runs LJM's live
giving/contribution portal — real money and real congregation data flow
through it today. Do not implement the smallest patch that makes an
immediate request pass; understand why a requirement exists, how it fits the
platform, and what it affects, then implement the smallest *architecturally
correct* solution. See [`development/AGENT_RULES.md`](./development/AGENT_RULES.md)
for the full constitution this repo is held to.

## Marking the unknown

Where a requirement or design decision genuinely hasn't been made yet, these
documents say so explicitly with the marker **`DECISION REQUIRED`** rather
than inventing an answer. If you're an agent picking up a `DECISION REQUIRED`
item, resolve it with the user before building — don't guess.
