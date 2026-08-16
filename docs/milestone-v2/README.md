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

## 👉 Next up — see [`STATUS-v2.md`](./STATUS-v2.md) for the live 14-requirement tracker

The mockup-review gate above has been passed — implementation is under way.
**[`11-v2-flow-implementation.md`](./11-v2-flow-implementation.md)** shipped Phase 0
(flag-gated routing + Home/Our-Giving/Give-flow/My-Giving/Events ported to `/v2/*`).
A later deep-implementation session shipped the Phase 0-5 content layer — churches,
promises, testimonies, prayer, contact, programs, blog, each with backend + admin +
public UI — plus a real i18n foundation. **[`STATUS-v2.md`](./STATUS-v2.md)** is the
current source of truth for what's actually done vs. remaining across all 14 PRD §7
requirements; read it before trusting any other status claim about this milestone,
including this file's older prose below.

Implementation continues **one phase at a time**, keeping `npm test` green throughout.

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
