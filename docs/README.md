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
