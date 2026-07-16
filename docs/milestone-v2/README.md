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
| 3 | [`03-app-flow.md`](./03-app-flow.md) | **App Flow** — every screen and the navigation between them | ✅ **Done** |
| 4 | [`04-uiux-design-spec.md`](./04-uiux-design-spec.md) | **UI/UX Design & Spec** — look, color, feel, components, design language | ✅ **Done** |
| 5 | [`05-backend-schema.md`](./05-backend-schema.md) | **Backend Schema** — database, table relationships, API calls | ⬜ Pending |
| 6 | [`06-implementation-plan.md`](./06-implementation-plan.md) | **Implementation Plan** — phased build, executed one phase at a time | ⬜ Pending |

---

## 👉 Next up for the next agent

**Docs 1–4 (PRD, TRD, App Flow, UI/UX Spec) are complete.** The next step is to
produce **`05-backend-schema.md` (Backend Schema)** — the database tables,
relationships, and API calls that back the screens.

When writing `05-backend-schema.md`:
- Read `02-TRD.md` (§4 frozen giving path, §5 additive-only migrations, §6 endpoint
  list), `03-app-flow.md` (§8 screen→endpoint map), and `04-uiux-design-spec.md`
  (bilingual `*_en`/`*_ta` content). The schema must be **additive-only** — new tables
  via migrations `0012+`, `CREATE TABLE IF NOT EXISTS`, nullable `church_id`; the
  existing `contributions`/`members`/`funds`/etc. tables are **untouched**.
- Define: `churches`, `promises`, `testimonies`, `prayer_requests`,
  `contact_messages`, `blog_posts`, `programs` — columns, relationships, indexes,
  and the request/response shape of each new `functions/api/*` endpoint.
- When done, flip this table's row 5 to ✅ and update this "Next up" section to point
  at `06-implementation-plan.md`.

Then finish `06-implementation-plan.md`. **No code until step 6 is approved.**

> **Non-negotiable throughout:** we have **real, live contribution data**. Nothing in
> this milestone may alter the giving path or its data — see `02-TRD.md` §4 (giving
> path frozen) and §5 (additive-only, feature-flagged rollout).

---

_See the root [`CLAUDE.md`](../../CLAUDE.md) → "Milestone workflow" for the standing
process rule this milestone follows._
