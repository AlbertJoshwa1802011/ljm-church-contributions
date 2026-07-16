# 01 · Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Light of Jesus Ministry — Worldwide Ministry App |
| **Milestone** | v2 — "Worldwide Ministry App" |
| **Document** | 1 of 6 (PRD) |
| **Version** | 1.0 (Draft) |
| **Date** | 2026-07-16 |
| **Status** | Draft — awaiting approval |
| **Next document** | [`02-TRD.md`](./02-TRD.md) — Technical Requirements |

---

## 1. Executive summary

Light of Jesus Ministry (LJM) will grow from a **fund-contribution portal** into a
full **worldwide, bilingual (English + Tamil) ministry app** — in the spirit of
[Jesus Calls](https://www.jesuscalls.org) and Jesus Redeems. It becomes the single,
trusted home where anyone in the world can discover the church, be inspired **every
day** by a promise word and by real testimonies and miracles, **give** in many ways,
**request prayer**, follow **live worship**, and easily **reach the team**.

We keep and extend the existing engine (Cloudflare Pages + D1 database + Razorpay
giving + Google Sign-In + admin console) but wrap it in a **completely new app feel
and flow**. Giving becomes one module inside a much larger ministry experience whose
primary job is to **build trust**.

---

## 2. Why we're building it (problem statement)

Today's app is, at heart, a **giving dashboard**: funds, contributions, members,
analytics, and an admin console. It serves the internal financial workflow well, but:

- **There is no worldwide public face for the ministry.** A seeker anywhere in the
  world who hears about LJM has no single, trustworthy place to understand who we
  are, what we believe, and what's happening.
- **Inspiration is missing.** People come to a ministry for daily encouragement — a
  promise word, testimonies of what God has done, miracles. Today none of that is
  surfaced to visitors.
- **Content is scattered or absent.** Events, programs, blog, youth ministry, prayer,
  live worship, contact — the things a church actually shares — are not there or are
  buried inside a finance tool.
- **Trust is not being built.** Global givers and seekers decide to engage based on
  transparency, story, and presence. A finance dashboard alone doesn't earn that.
- **Reaching the team is hard.** There's no clean way for a visitor to ask for
  prayer, contact the church, or get a warm, prompt acknowledgement.

**What this solves:**
- *For worldwide seekers/visitors:* a clear, inspiring, trustworthy window into LJM.
- *For members:* one place for schedules, promises, giving, and staying connected.
- *For donors (India + diaspora):* many easy, transparent ways to give.
- *For prayer-seekers:* a direct, cared-for path to prayer and contact.
- *For the pastor/team:* one console to publish everything and never miss a request.

---

## 3. Vision & goals

**Vision:** *Light of Jesus Ministry, available to the whole world — inspiring people
daily, inviting them into worship and prayer, and earning their trust.*

**Goals for this milestone:**
1. **Worldwide availability** — a public ministry presence anyone can find and
   understand, on any device, like Jesus Calls.
2. **A single trusted home for "what's happening at church"** — events, programs,
   good deeds, and beneficiaries, clearly shown.
3. **Inspire daily** — Today's Promise, Monthly Promise, Yearly Promise, testimonies,
   and miracles, all auto-surfaced.
4. **Make giving effortless and transparent** — many donation types, with visible
   proof of where money goes.
5. **Make prayer and contact effortless and cared-for** — request prayer, call us,
   or write to us, and always get a warm, prompt response.
6. **Build trust** as the overarching outcome that ties every feature together.

---

## 4. Success metrics (directional)

These are directional indicators, not committed targets — the TRD/analytics work will
firm them up.

- **Reach:** worldwide visits and unique visitors; number of countries reached.
- **Inspiration engagement:** views/shares of Today's/Monthly/Yearly promise;
  testimonies viewed and submitted.
- **Giving:** donation conversion rate; number and variety of donation types used;
  repeat giving.
- **Prayer & contact:** prayer requests submitted; contact messages received;
  **team response time** to prayer/contact requests.
- **Live worship:** viewers of the Sunday live podcast; clicks on the daily morning
  prayer link.
- **Trust/retention:** return-visit rate; time on inspirational content.

---

## 5. Target users (personas)

1. **Worldwide seeker / visitor** — has heard of LJM or is searching; wants to
   quickly understand the church, feel inspired, and know it's trustworthy.
2. **Local congregation member** — wants schedules, promises, giving, and to stay
   connected to their church (mother church or city center).
3. **Donor (India + diaspora)** — wants easy, transparent giving across causes.
4. **Youth** — looking for youth ministry programs, events, and media.
5. **Prayer-seeker** — in need; wants prayer, a callback, or someone to talk to.
6. **Pastor / admin / volunteer team** — publishes content and responds to requests
   from one console; must never miss a prayer or contact request.

---

## 6. Organization model — the two churches

LJM operates as an umbrella ministry over **two churches today**, and the app must
represent this clearly:

```
Light of Jesus Ministry (ministry umbrella)
├── Church of Light   — the MOTHER CHURCH
└── City Worship Center
```

**Requirements:**
- Ministry-wide content (promises, testimonies, blog, giving, about) is **shared**
  across the whole ministry.
- Church-specific content (**events, service times, programs/schedule, and
  optionally giving/causes**) must be **segregated and filterable by church**, so a
  visitor can view "Church of Light" or "City Worship Center" clearly.
- The design must allow **adding more churches/campuses later** without rework.
- The About and Contact sections must clearly present both churches (identity,
  location, service times).

---

## 7. Feature requirements

Priority uses MoSCoW: **M** = Must, **S** = Should, **C** = Could (this milestone).
"Reuse" notes point to the existing backend/data that the feature builds on.

### 7.1 Home / Landing — **M**
The inspirational front door, like Jesus Calls' homepage.
- **Today's Promise word**, **Monthly Promise**, and **Yearly Promise**, each
  **auto-rotating based on the current date/time** (no manual switching needed).
- Hero section conveying the ministry identity and warmth.
- **Primary quick actions: Give · Pray · Contact** — always one tap away.
- **Daily morning prayer** live link surfaced prominently.
- A snapshot of "what's happening" (next event/service, latest testimony, live status).
- *Reuse:* existing "Verse of the Month / Verse of the Year" curation and `bible.js`
  / Bible-verse tables as the foundation for the promises engine.

### 7.2 Promises engine — **M**
- Admin-curated **daily, monthly, and yearly promise** content, scheduled ahead of
  time and **auto-shipped by date** (today's promise appears automatically each day).
- **Bilingual** (English + Tamil) promise text; each promise may include a scripture
  reference and a short reflection.
- Graceful fallback if a given day has no specific promise assigned.
- *Reuse:* Bible verse dictionary + verse-of-month/year concept already in the app.

### 7.3 Testimonies & Miracles — **M**
- Public gallery of **testimonies** and **miracles** ("what God has done so far"),
  browsable and shareable.
- **Visitors can submit** a testimony; **admin moderates and publishes**.
- Support text plus optional photo/video/media reference; bilingual where provided.

### 7.4 Giving / Donations — **M**
- **Many donation types**: general offering, named funds, and special causes/appeals.
- **India-first, global-ready:** INR via Razorpay now; the experience is designed so
  **international / multi-currency giving (e.g. PayPal/Stripe) can be added in a later
  phase** without redesign. (Multi-currency is **out of scope for this milestone** —
  see §10.)
- **Transparency:** show "where the money goes" — impact, purchases, and expenses —
  to build donor trust.
- Optionally attributable to a specific church/cause.
- *Reuse:* existing Razorpay checkout, `funds`/`contributions`/`purchases`/`expenses`
  tables and APIs, and the impact/"What We Bought" module.

### 7.5 Prayer ("Pray") — **M**
- **Submit a prayer request** (name/contact optional, request text, bilingual).
- **Request a callback** and/or **contact us for prayer**; show a **call-us** number.
- On submission, the **team is notified** so someone can reach out and pray with the
  person, and the requester gets a warm acknowledgement.
- Admin can view and manage prayer requests (status: new / being prayed for / contacted).

### 7.6 Contact — **M**
- Contact form (name, email, message, optional church of interest).
- On submit: **an automatic acknowledgement is sent from a `noreply` address**
  — *"Thank you for contacting us — our team will reach you soon"* — **and the team is
  notified internally** so a person follows up and speaks with the enquirer.
- Show **address, phone, map, and social links** (Instagram, YouTube), per church.
- *Note:* the current backend has **no email capability** — this is a **new capability**
  the app must gain. This PRD states the requirement; the **TRD** selects the
  mechanism (e.g. an email API/service + team notification channel).

### 7.7 Events, Good Deeds & Beneficiaries — **M**
- What the church has done — **events, good deeds, and the people who've been
  helped/benefited** — with **photo galleries**.
- Filterable **per church**; upcoming vs. past.
- *Reuse:* the existing (partially built) events module — `events.html`, `events.js`,
  `/api/events` + `/api/events/photo`, `events`/`event_photos` tables, and R2 photo
  storage — completed and folded into the new experience.

### 7.8 Programs & Schedule — **S**
- Service times and weekly/recurring **programs**, plus upcoming special events,
  shown **per church**.
- Clear, glanceable schedule so visitors know when and where to join.

### 7.9 Blog — **S**
- Admin-authored **articles/updates** (teachings, news, reflections).
- Bilingual where provided; browsable list + article view.

### 7.10 Youth Ministry — **S**
- A dedicated **Youth Ministry** section: youth programs, events, and media.
- May reuse events/blog/programs building blocks scoped to youth.

### 7.11 Live Podcast / Livestream — **M**
- **Weekly Sunday church prayer** streamed **live**, and available as a recording
  afterward (a "podcast" archive).
- **Daily morning prayer** link (the ongoing morning prayer stream/call).
- *Note:* the **hosting mechanism** (e.g. embedded YouTube Live / podcast source) is
  an **open question for the TRD** (§12).

### 7.12 About — **M**
- The ministry story, vision, leadership, and a clear presentation of **both
  churches** (Church of Light — mother church; City Worship Center), with identity,
  location, and service times.
- *Reuse:* existing admin-editable `about.html` content as a starting point.

### 7.13 Language (English + Tamil) — **M**
- Key content — promises, testimonies, giving, prayer, contact, about — available in
  **English and Tamil**, with an easy language switch.
- *Reuse:* the app already registers a Tamil Bible version (TOV) alongside English (KJV).

### 7.14 Admin — **M**
- The existing **admin console** extends to manage **every new content type**:
  promises (daily/monthly/yearly schedule), testimonies & miracles (moderation),
  prayer requests (follow-up tracking), contact messages, blog, events/good-deeds,
  programs/schedule, youth ministry, podcast/livestream links — all **per church**
  where relevant.
- *Reuse:* existing roles/permissions, audit log, and admin navigation structure.

---

## 8. User journeys (narrative)

- **Seeker discovers LJM:** lands on Home → reads **Today's Promise** → watches a
  **testimony/miracle** → feels moved → taps **Pray** (submits a request) or **Give**
  or **Contact** → receives a warm acknowledgement → returns the next day for the new
  promise. *Outcome: trust + ongoing engagement.*
- **Member stays connected:** opens the app → checks **their church's** service times
  and **upcoming events** → **gives** to a current cause → shares a testimony.
- **Donor gives with confidence:** browses **causes** and **"where the money goes"**
  (impact/purchases/expenses) → gives via Razorpay → sees transparent follow-through.
- **Prayer-seeker in need:** taps **Pray** → submits request or taps **call us** →
  team is **notified** → someone **reaches out and prays** with them.
- **Team publishes & responds:** in the admin console, schedules next month's
  **promises**, **moderates** a submitted testimony, and **follows up** on new prayer
  and contact requests — nothing is missed.

---

## 9. Assumptions

- The current **Cloudflare Pages + D1 + Razorpay + Google Sign-In** stack and the
  **no-build static-site model** are retained and **extended, not rebuilt**.
- The **new app feel/flow** is a front-end reimagining; existing data and APIs remain
  the engine.
- **Email/notification** is a new capability to be introduced (mechanism decided in
  the TRD).
- Bilingual scope is **English + Tamil** for this milestone.

---

## 10. Non-goals / out of scope (this milestone)

- **Full multi-currency / international payment gateways** (PayPal/Stripe) — designed
  for, but not built now; a later phase.
- **Native mobile apps** (iOS/Android) — the web app is responsive; native is future.
- **Full internationalization** beyond English + Tamil (e.g. Hindi and others) — later.
- Any feature not requested in this brief.

---

## 11. Constraints

- No build step / no bundler / no framework transpile — plain HTML/CSS/vanilla JS +
  Cloudflare Pages Functions + D1 (per repo `CLAUDE.md`).
- Backend changes are **additive/extending** to preserve the working giving portal
  and admin console.
- Any new third-party dependency (email, livestream) must fit the Cloudflare Pages
  Functions runtime and be justified in the TRD.

---

## 12. Open questions (to resolve in the TRD)

1. **Email/notifications:** which service sends the `noreply` acknowledgement and the
   internal team notification (e.g. an email API compatible with Cloudflare Workers),
   and what channel notifies the team (email/other)?
2. **Livestream/podcast host:** embedded YouTube Live? A podcast host/RSS? Where does
   the daily morning prayer stream live?
3. **Promise rotation rules:** exact scheduling model — pre-assigned per date vs.
   rotating from a pool; behavior when a day is unassigned; timezone for "today".
4. **Testimony/prayer moderation policy:** what's shown publicly, what stays private,
   approval workflow.
5. **Multi-currency staging:** how the giving flow should be structured now so
   international payments drop in later without redesign.
6. **Per-church data model:** how "church" is represented and attached to events,
   programs, giving, and members.
7. **Language handling:** stored-per-record translations vs. a content/i18n approach.

---

## 13. Next steps — document chain

This PRD is document **1 of 6**. On approval, proceed **in order**:

1. ✅ **PRD** (this document) — what we build, why, what it solves
2. ⬜ **TRD** ([`02-TRD.md`](./02-TRD.md)) — tech stack, tools, APIs
3. ⬜ **App Flow** ([`03-app-flow.md`](./03-app-flow.md)) — every screen and navigation
4. ⬜ **UI/UX Design & Spec** ([`04-uiux-design-spec.md`](./04-uiux-design-spec.md)) — look, color, feel, components
5. ⬜ **Backend Schema** ([`05-backend-schema.md`](./05-backend-schema.md)) — database, relationships, API calls
6. ⬜ **Implementation Plan** ([`06-implementation-plan.md`](./06-implementation-plan.md)) — phased build, one phase at a time

**No implementation begins until all six documents exist and are approved.** See
[`README.md`](./README.md) for the live status tracker.
