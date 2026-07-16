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
| 2 | [`02-TRD.md`](./02-TRD.md) | **Technical Requirements** — tech stack, tools, APIs | ⬜ Pending |
| 3 | [`03-app-flow.md`](./03-app-flow.md) | **App Flow** — every screen and the navigation between them | ⬜ Pending |
| 4 | [`04-uiux-design-spec.md`](./04-uiux-design-spec.md) | **UI/UX Design & Spec** — look, color, feel, components, design language | ⬜ Pending |
| 5 | [`05-backend-schema.md`](./05-backend-schema.md) | **Backend Schema** — database, table relationships, API calls | ⬜ Pending |
| 6 | [`06-implementation-plan.md`](./06-implementation-plan.md) | **Implementation Plan** — phased build, executed one phase at a time | ⬜ Pending |

---

## 👉 Next up for the next agent

**The PRD (`01-PRD.md`) is complete.** The next step is to produce **`02-TRD.md`
(Technical Requirements Document)**, using `01-PRD.md` as the single source of truth
for scope and requirements.

When writing `02-TRD.md`:
- Read `01-PRD.md` in full first, especially the **Open questions** section — the TRD
  is where those get resolved (email provider, livestream/podcast host, promise
  rotation rules, moderation, multi-currency staging, etc.).
- Honor the confirmed constraints: extend (don't rebuild) the current Cloudflare
  Pages Functions + D1 backend; keep the no-build static-site model; India-first &
  global-ready giving; English + Tamil.
- When done, flip this table's row 2 to ✅ and update this "Next up" section to point
  at `03-app-flow.md`.

Then continue down the table until all six are done. **No code until step 6 is
approved.**

---

_See the root [`CLAUDE.md`](../../CLAUDE.md) → "Milestone workflow" for the standing
process rule this milestone follows._
