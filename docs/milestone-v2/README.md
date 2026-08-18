# Milestone v2 — Worldwide Ministry App

**Goal:** Rework Light of Jesus Ministry from a *fund-contribution portal* into a
full **worldwide ministry app** — modeled on sites like
[jesuscalls.org](https://www.jesuscalls.org) and Jesus Redeems — so anyone in the
world can clearly see who the church is, what's happening, be inspired daily
(promises, testimonies, miracles), give in many ways, request prayer, and reach the
team. The site's core job is to **build trust**.

We **extend the existing backend** (Cloudflare Pages + D1 + Razorpay + Google
Sign-In) but deliver a **completely new app feel and flow**. India-first,
global-ready. Bilingual: **English + Tamil**.

> ### 🔒 Read first: [`SAFETY-AND-TESTS.md`](./SAFETY-AND-TESTS.md)
> We have **real, live contribution data**. The overriding rule is **zero breakage of
> existing functionality**. A regression **test net is already in place and passing
> (82 tests)** and is a merge gate — the giving/money path is frozen, schema changes
> are additive-only, and the new UI ships behind a feature flag. Every phase must keep
> the suite green.

---

## The 6-document milestone workflow (strict order)

Every major milestone is planned through these six documents **in order**, one at a
time — each builds on the previous. **Do not begin implementation until all six
exist and are approved.**

| # | Document | What it defines | Status |
|---|----------|-----------------|--------|
| 1 | [`01-PRD.md`](./01-PRD.md) | **Product Requirements** — what we build, why, and what it solves | ✅ **Done** |
| 2 | [`02-TRD.md`](./02-TRD.md) | **Technical Requirements** — tech stack, tools, APIs | ✅ **Done** |
| 3 | [`03-app-flow.md`](./03-app-flow.md) | **App Flow** — every screen and the navigation between them | ✅ **Done** |
| 4 | [`04-uiux-design-spec.md`](./04-uiux-design-spec.md) | **UI/UX Design & Spec** — look, color, feel, components, design language | ✅ **Done** |
| 5 | [`05-backend-schema.md`](./05-backend-schema.md) | **Backend Schema** — database, table relationships, API calls | ✅ **Done** |
| 6 | [`06-implementation-plan.md`](./06-implementation-plan.md) | **Implementation Plan** — phased build, executed one phase at a time | ✅ **Done** |

**Supporting:** [`SAFETY-AND-TESTS.md`](./SAFETY-AND-TESTS.md) — the zero-breakage
guarantee + regression test net (applies to all phases).

**Round 1 UI/UX mockups (awaiting owner review):**
[`07-ui-mockups-review.md`](./07-ui-mockups-review.md) — static HTML previews of the
redesigned Home, Our Giving (the full stats report), and Give flow +
confirmation, in [`mockups/`](../../mockups/). User-facing pages only, nothing wired
to real data, admin console untouched. **Contains one structural decision that needs
the owner's sign-off before implementation planning continues** — see §3 of that doc.

---

## 👉 Current status — see [`15-major-milestone-status.md`](./15-major-milestone-status.md)

**All six planning documents are complete.** The flag-gated beta-flow port
([`11-v2-flow-implementation.md`](./11-v2-flow-implementation.md)) shipped Home,
Our Giving, Events, Give Flow, and My Giving. Follow-up sessions implemented the
PRD's ministry-content features — Churches, Promises, Testimonies, Prayer, Contact,
Programs (with real recurrence + Google Meet), Blog, Youth Ministry, Watch &
Listen, and a persisted Playwright E2E suite — with full backend + admin support.
The most recent session closed the two largest remaining gaps: full i18n
across Our Giving/My Giving/Home/Events/Give Flow/Watch & Listen, and a
complete Events & VBS admin console section (the backend/DB/public page were
already done, but there was no admin UI for it at all — a real gap this
session's own audit found).

[`15-major-milestone-status.md`](./15-major-milestone-status.md) is the
current authoritative source of truth: the 11-block roadmap mapping, what's
real vs. scaffolded per block, confirmed-fixed bugs, security/migration
audit results, and the branch reconciliation record.
[`14-milestone-completion-status.md`](./14-milestone-completion-status.md),
[`12-phase-0-5-implementation-status.md`](./12-phase-0-5-implementation-status.md),
and [`13-overnight-completion-status.md`](./13-overnight-completion-status.md)
are all now superseded/stale.

**Not yet done:** merging to `main` (the branch that auto-deploys, requires
owner authorization), applying migration `0024`/`0025`'s content seed to
production D1, and About/Churches/Testimonies/Blog page-content Tamil
translation (see the current status doc's Remaining Work section).

Before coding any phase:
- Read [`SAFETY-AND-TESTS.md`](./SAFETY-AND-TESTS.md) (the zero-breakage rules + test
  net) and [`05-backend-schema.md`](./05-backend-schema.md) (additive tables + API
  contracts).
- Ship each phase behind the feature flag with its own tests; extend
  `schema-contract.test.mjs` for each new table; do not touch the frozen giving path.

> **Non-negotiable throughout:** we have **real, live contribution data**. Nothing in
> this milestone may alter the giving path or its data — enforced by the regression
> suite (82 tests, and growing per phase) that must stay green.

---

_See the root [`CLAUDE.md`](../../CLAUDE.md) → "Milestone workflow" for the standing
process rule this milestone follows._
