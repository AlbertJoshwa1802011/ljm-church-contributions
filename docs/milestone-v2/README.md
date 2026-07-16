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

---

## The 6-document milestone workflow (strict order)

Every major milestone is planned through these six documents **in order**, one at a
time — each builds on the previous. **Do not begin implementation until all six
exist and are approved.**

| # | Document | What it defines | Status |
|---|----------|-----------------|--------|
| 1 | [`01-PRD.md`](./01-PRD.md) | **Product Requirements** — what we build, why, and what it solves | ✅ **Done** |
| 2 | [`02-TRD.md`](./02-TRD.md) | **Technical Requirements** — tech stack, tools, APIs | ✅ **Done** |
| 3 | [`03-app-flow.md`](./03-app-flow.md) | **App Flow** — every screen and the navigation between them | ⬜ Pending |
| 4 | [`04-uiux-design-spec.md`](./04-uiux-design-spec.md) | **UI/UX Design & Spec** — look, color, feel, components, design language | ⬜ Pending |
| 5 | [`05-backend-schema.md`](./05-backend-schema.md) | **Backend Schema** — database, table relationships, API calls | ⬜ Pending |
| 6 | [`06-implementation-plan.md`](./06-implementation-plan.md) | **Implementation Plan** — phased build, executed one phase at a time | ⬜ Pending |

---

## 👉 Next up for the next agent

**The PRD (`01-PRD.md`) and TRD (`02-TRD.md`) are complete.** The next step is to
produce **`03-app-flow.md` (App Flow)** — map **every screen and the navigation
between them**, for the whole app.

When writing `03-app-flow.md`:
- Read `01-PRD.md` (what/why) and `02-TRD.md` (stack + the **frozen giving path**)
  first. The app flow must respect the data-safety rules in TRD §4–§5 — the giving
  screens call the existing endpoints unchanged, and the new experience ships behind
  a feature flag.
- Cover the two-church segregation, the Home promises/quick-actions, and every
  feature area from the PRD (testimonies, giving, pray, contact, events, programs,
  blog, youth, live podcast, about) plus the admin console additions.
- When done, flip this table's row 3 to ✅ and update this "Next up" section to point
  at `04-uiux-design-spec.md`.

Then continue down the table until all six are done. **No code until step 6 is
approved.**

> **Non-negotiable throughout:** we have **real, live contribution data**. Nothing in
> this milestone may alter the giving path or its data — see `02-TRD.md` §4 (giving
> path frozen) and §5 (additive-only, feature-flagged rollout).

---

_See the root [`CLAUDE.md`](../../CLAUDE.md) → "Milestone workflow" for the standing
process rule this milestone follows._
