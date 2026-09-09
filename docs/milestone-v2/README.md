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

**v2 Liquid Glass (visual only):** [`13-liquid-glass-v2.md`](./13-liquid-glass-v2.md)
— Apple-style glass materials + WhatsApp-style bottom tab bar on `/v2/*`. Does
not change the frozen giving path.

**Round 1 UI/UX mockups (awaiting owner review):**
[`07-ui-mockups-review.md`](./07-ui-mockups-review.md) — static HTML previews of the
redesigned Home, Our Giving (the full stats report), and Give flow +
confirmation, in [`mockups/`](../../mockups/). User-facing pages only, nothing wired
to real data, admin console untouched. **Contains one structural decision that needs
the owner's sign-off before implementation planning continues** — see §3 of that doc.

---

## 👉 Current status — Phases 0–5 implemented, awaiting production cutover

**All six planning documents are complete.** The flag-gated beta-flow port
([`11-v2-flow-implementation.md`](./11-v2-flow-implementation.md)) shipped Home,
Our Giving, Events, Give Flow, and My Giving. A follow-up session implemented the
PRD's ministry-content features — Churches, Promises, Testimonies, Prayer, Contact,
Programs, Blog, Watch & Listen, and the i18n scaffold — as new, directly-reachable
`/v2/*.html` pages with full backend + admin support. See
[`12-phase-0-5-implementation-status.md`](./12-phase-0-5-implementation-status.md)
for the honest current state: what's built, what isn't, and the production
migration/deploy status.

**Not yet done:** merging `claude/ljm-v2-production-impl-amrdbz` to `main` (the
branch that auto-deploys), a Youth Ministry hub page, full Tamil content, and a
Playwright E2E suite.

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
