# ADR 0001: Establish the permanent documentation foundation

**Status:** Accepted

**Date:** 2026-08-12

## Context

This repository is developed by multiple AI/coding agent sessions, often in
parallel, often without one session knowing what another just did. Prior to
this change, project knowledge was spread across: `CLAUDE.md` and
`CONTRIBUTING.md` (process rules), `docs/milestone-v2/` (a detailed,
milestone-specific product/technical plan for the current "worldwide
ministry app" rework), ~30 root-level markdown files of mixed
current/historical relevance (`ADMIN_CONSOLE_GUIDE.md`,
`THEME_AND_DESIGN_SYSTEM.md`, several `TECH_FUND_*`/`APPS_SCRIPT_*` files
documenting a pre-migration backend), and the source code itself. There was
no single place recording the *system's* architecture (as opposed to one
milestone's plan for extending it), no engineering constitution beyond the
process rules, and no ADR mechanism.

## Problem

Establish a docs/ tree that becomes the single source of truth for
architecture, product vision, and process — without duplicating or
contradicting `CONTRIBUTING.md`, `CLAUDE.md`, or the already-substantial
`docs/milestone-v2/` planning documents, and without inventing product
requirements that haven't actually been decided.

## Decision

Created `docs/{product,architecture,development,decisions/ADR,features,operations}/`
per the requesting task's specification. Key stances taken while writing it:

1. **Extend, don't duplicate, `docs/milestone-v2/`.** It already contains a
   complete PRD, TRD, App Flow, UI/UX spec, and backend schema for the
   "worldwide ministry app" vision — churches, prayer, testimonies,
   multilingual, etc. The new `docs/product/` and `docs/architecture/`
   documents cross-reference it as the authoritative source for that
   content rather than re-deriving it.
2. **Explicitly distinguish "planned" from "shipped."** Investigation found
   a real, material gap: `docs/milestone-v2/06-implementation-plan.md`
   describes phases and a `new_home_enabled` global feature flag that were
   never built; what actually shipped
   (`docs/milestone-v2/11-v2-flow-implementation.md`) is a different
   mechanism (per-user allowlist + signed cookie) that only restyles five
   existing pages — none of the new content tables (`churches`, `promises`,
   `testimonies`, `prayer_requests`, `contact_messages`, `blog_posts`,
   `programs`) exist in `schema.sql`. Every new document marks this
   distinction explicitly (see
   [`../../product/REQUIREMENTS.md`](../../product/REQUIREMENTS.md) and
   [`../../architecture/MIGRATION_PLAN.md`](../../architecture/MIGRATION_PLAN.md))
   rather than letting a skim of the six planning documents imply the
   feature set is live.
3. **Document known architectural debt rather than fixing it inline.** Three
   concrete, real issues were found during investigation: the Tech
   Fund/Christmas Fund hardcoding runs through the entire stack, not just
   the frontend ([`FUND_ARCHITECTURE.md`](../../architecture/FUND_ARCHITECTURE.md));
   `ALLOW_LEGACY_EMAIL_TOKEN` is live in production, not just a documented
   migration path ([`PERMISSION_ARCHITECTURE.md`](../../architecture/PERMISSION_ARCHITECTURE.md));
   Razorpay webhook-originated contributions are never audited
   ([`AUDIT_ARCHITECTURE.md`](../../architecture/AUDIT_ARCHITECTURE.md)).
   Per this repo's own "no unrelated refactoring" and "live system safety"
   rules, none of these were fixed as part of establishing documentation —
   they're recorded with enough context that a future agent can act on them
   deliberately, with tests, rather than rediscovering them from scratch or
   fixing them as an incidental side effect of unrelated work.
4. **No application code was modified.** This task was documentation-only, per
   its own instructions and per the live-system-safety principle now
   codified in [`../../development/AGENT_RULES.md`](../../development/AGENT_RULES.md).
5. **Genuinely undecided items are marked `DECISION REQUIRED`**, not
   invented — e.g. prayer *schedules* (recurring times) vs. prayer
   *requests* are different features and only the latter is specified
   anywhere; multi-Razorpay-account routing has no design yet; pastor/staff
   modeling per branch has no table proposed anywhere.

## Alternatives considered

- **Rewrite `docs/milestone-v2/` into the new structure.** Rejected — it's
  detailed, already reviewed, and actively referenced by
  `docs/milestone-v2/README.md`'s live status tracker. Moving or duplicating
  it would create drift risk and destroy its existing cross-links. Extending
  it via references was chosen instead.
- **Silently mark milestone-v2 as fully current.** Rejected — investigation
  showed real drift between the plan and what shipped; documenting that
  drift as fact is more useful than inheriting an inconsistency.
- **Fix the discovered debt items as part of this task.** Rejected per
  `CLAUDE.md`'s "no unrelated refactoring" and the live-payment-system
  safety rule — each is a nontrivial change to code, in one case the frozen
  giving path, and deserves its own reviewed, tested change.

## Consequences

Future agents have a durable place to check architecture and status before
building, reducing the odds of rebuilding something that already exists (the
dynamic-fund system) or re-hardcoding something that shouldn't be (the next
fund/church/event). The tradeoff: this tree now needs to be kept current
alongside `docs/milestone-v2/` as that milestone progresses — a stale
`docs/architecture/` document is worse than none, so updating it is part of
the Definition of Done for any change that touches what it describes (see
[`AGENT_RULES.md`](../../development/AGENT_RULES.md)).

## Migration implications

None — no schema or code changes. Purely additive documentation.
