# Church / Branch Architecture

**Status: `DECISION REQUIRED` — not built.** This document records what's
planned, what exists, and the open questions that need an owner decision
before implementation starts. Nothing here should be read as "in progress."

## What exists today

Nothing. Confirmed by grep across `functions/` and `schema.sql`: zero
`church_id`, `branch_id`, `tenant`, or `organization_id` references anywhere.
Every table (`members`, `contributions`, `funds`, `events`, etc.) is global —
there is exactly one implicit "church" in the data model.

The only place a second church appears at all is **static footer copy** in
the `v2/` beta redesign (`v2/index.html`) and its `mockups/home.html` source:
two named locations, "Church of Light — Mother Church" and "City Worship
Center," both in Coimbatore, Tamil Nadu, with service times. This is
marketing text with no functional backing — no selector, no filter, no data
field on any content type references it.

## What's planned

`docs/milestone-v2/01-PRD.md` §6 ("Organization model") and
`docs/milestone-v2/05-backend-schema.md` §2.1 fully specify a target design:

```
LJM (ministry umbrella)
 ├── Church of Light — the mother church
 └── City Worship Center
      └── (design must allow adding more churches/campuses later
           without rework)
```

- A `churches` table: `slug`, bilingual `name_en`/`name_ta`, `is_mother_church`
  flag, address/service-times per language, `status`, `sort_order`.
- Ministry-wide content (promises, testimonies, blog, giving, about) stays
  shared across all churches.
- Church-specific content (events, service times, programs/schedule,
  optionally giving/causes) is segregated/filterable by church via a
  **nullable** `church_id` foreign key added to the relevant existing tables
  (e.g. `events.church_id`).
- A church switcher in the UI (All / Church of Light / City Worship Center)
  filters church-scoped screens only; ministry-wide screens ignore it.
  `docs/milestone-v2/03-app-flow.md` §5 has the full navigation spec.
- Church selection must **not** be mandatory for a visitor merely browsing
  the public homepage — per the constitution this foundation task is built
  from: "Church selection should NOT be mandatory for users merely browsing
  the public homepage."

This matches the constitution's principle directly: LJM is the mother
ministry, churches/branches are children of it, and the architecture must
support an arbitrary number of them without hard-coding names into the
frontend (the same anti-pattern already causing debt in
[`FUND_ARCHITECTURE.md`](./FUND_ARCHITECTURE.md) — don't repeat it here).

## Open questions (`DECISION REQUIRED`)

These are not yet answered anywhere in the codebase or the milestone-v2
documents, and an implementing agent should not guess at them:

1. **Pastor/assistant-pastor modeling** — the constitution describes
   per-branch assistant pastors and a shared head pastor at the LJM level.
   No `pastors` or `staff` table is planned in `05-backend-schema.md`. Is
   this a new table, or is it initially just free-text fields on `churches`?
2. **Shared YouTube channel** — the constitution says the YouTube channel may
   be shared at the LJM level. `02-TRD.md` proposes livestream URLs as
   `config` keys (single global values), which doesn't yet accommodate a
   per-church stream if one is ever needed. Confirm this is intentionally
   LJM-wide for now.
3. **Fund-to-church relationship** — `01-PRD.md` §7.4 marks giving/causes
   "optionally" church-attributed. Does a fund belong to zero-or-one church,
   or can it span multiple? This affects whether `funds.church_id` is
   nullable-single or needs a join table like `fund_members`.
4. **Migration/rollout order** — should `churches` ship before or alongside
   the content types that reference it (events, programs, promises)? See
   [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md) for the dependency ordering
   `06-implementation-plan.md` proposes (Phase 0 includes `churches`, before
   Phase 4's events/programs church-scoping).

## Rule for any agent building this

Per the constitution: never hard-code "Church of Light" or "City Worship
Center" as literals in frontend logic (mirroring the Tech Fund / Christmas
Fund mistake documented in `FUND_ARCHITECTURE.md`). The `churches` table must
be the only source of truth for which churches exist; the frontend renders
whatever the admin has configured. Seed rows for the two known churches are
fine (that's what `05-backend-schema.md` already proposes); hard-coded
conditionals keyed to their slugs are not.
