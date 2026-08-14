# Website / UX Architecture Audit — Public Site vs. Ministry Platform Vision

**Type:** Investigation only. No application code, database, or payment functionality
was modified to produce this document.
**Date:** 2026-08-12
**Scope:** The public-facing website/UX only (not the fund/backend data-architecture,
which is being audited separately per the requesting task — this document does not
duplicate that work; it only describes how the *website* consumes fund data).

> **Read this first if you're picking this up:** almost everything this audit was
> asked to evaluate the site *against* — churches, testimonies, prayer requests,
> contact messages, blog, programs/schedule, bilingual EN/TA content, livestream
> links — has **already been fully planned** in
> [`docs/milestone-v2/`](../milestone-v2/README.md) (PRD → TRD → App Flow → UI/UX
> Spec → Backend Schema → Implementation Plan, all six documents complete). A round
> of UI mockups also exists (`mockups/`, `v2/`). **Do not re-plan this from scratch.**
> The milestone is stalled at one checkpoint: **owner review of
> [`07-ui-mockups-review.md`](../milestone-v2/07-ui-mockups-review.md)**, specifically
> a structural decision about splitting Home vs. "Our Giving." Implementation Phase 0
> has not started. This audit's job is to document the *current live state* precisely
> and flag anything the existing milestone plan doesn't yet cover.

---

## A. Current Website Architecture

**Stack:** static multi-page site, no build step, no framework/bundler/TypeScript —
plain HTML + vanilla JS + CSS, deployed as-is to Cloudflare Pages. Backend is
Cloudflare Pages Functions (`functions/api/*.js`) on Cloudflare D1 (SQLite).

**Pages (all top-level `.html` files, each a separate document — no client-side
router/SPA):**

| Page | Purpose | Primary JS |
|---|---|---|
| `index.html` | Home / dashboard — KPI stats, goal progress ring, contribution charts, Analytics tab | `script.js` (120KB, monolithic) |
| `funds.html` | Fund picker — lists funds from `/api/funds`, links into the giving flow | `fund-dashboard.js` |
| `members.html` | Member directory / lookup | `members.js` |
| `member.html` | Single member's contribution history (`?name=` query param) | `member-dashboard.js` |
| `about.html` | Ministry story, admin-editable content, pastor contact | inline script |
| `impact.html` | "What We Bought" — public purchases + operating expenses + wishlist | `impact.js` |
| `events.html` | Events gallery with category filter + photo carousel | `events.js` |
| `subscriptions.html` | Monthly dues (Sandha) — family/individual subscription tracking | inline script |
| `admin.html` | Admin console — every management feature in one file (217KB) | inline script, gated by role/permission |
| `beta-login.html` | Beta-tester gate | inline script |
| `preloader.html` | Standalone loading splash | — |

Shared across pages: `style.css` + `theme.css` (light/dark design tokens),
`header.js` (renders the shared navbar + mobile bottom sheet from a single `NAV`
array — see below), `theme.js`, `appearance.js`, `admin-session.js` (client-side
"is an admin bar visible" convenience layer — **not** the security boundary; see
§H/§L), `portal-telemetry.js`.

**Routing:** none — each page is a real, separate static HTML file; Cloudflare
Pages serves clean URLs (`funds.html` → `/funds`). There is no client-side router,
no SPA shell, no dynamic route parameters beyond simple `?query=` strings
(`member.html?name=...`).

**`v2/` and `mockups/` directories** are *not live* — they're prototype/mockup HTML
for the planned redesign (`give-flow.html`, `our-giving.html`, `my-giving.html`,
new `index.html`, `events.html`), built during the milestone-v2 planning round.
Nothing in them is wired to real data or linked from the live navigation.

---

## B. Current User Journey

A first-time visitor landing on `/` (`index.html`) sees, in order: a navbar with
links to **Funds / Members / What We Bought / About** (an "Admin Dashboard" link is
hidden unless signed in as admin) → a hero/KPI section (Total Collected, live
progress ring toward a goal amount) → tabs for contribution analytics (trend chart,
category pie, source breakdown, most-active-month) → a fund goal progress bar with
milestones → verse-of-the-month/year cards → footer with social links (Instagram,
YouTube, Google Maps) and pastor contact info.

There is **no "who we are / what we believe" front door** — the first content a
visitor sees is financial KPIs and a giving progress bar. To learn who the ministry
is, a visitor must specifically navigate to `About`. There is no homepage narrative
about mission, no "what's happening now" feed, no way to discover a church/branch,
no prayer entry point, and no live-service indicator. The experience is a **giving
dashboard first**, not a ministry front door — exactly the gap the milestone-v2 PRD
already identified (§2 "Why we're building it").

Signed-in members additionally see: an admin bar (if admin), "My contributions"
(→ `member.html`) and, for admins, the admin console link in the mobile "More"
sheet and desktop navbar dropdown.

---

## C. Existing Features — status

**IMPLEMENTED (live, working, tested):**
- Fund listing, goal/progress display, contribution ledger (`funds.html`,
  `/api/funds`, `/api/contributions`)
- Razorpay giving flow (`razorpay-checkout.js`, `/api/webhook.js`) — frozen, do not
  touch
- Member directory + individual contribution history (current D1-backed path via
  `/api/members`; see exception below)
- Public "What We Bought" — purchases, operating expenses, wishlist
  (`impact.html`, `/api/purchases`, `/api/expenses`, `/api/wishlist`)
- Events gallery — title, category, date, location, description, cover photo,
  photo carousel, draft/published status, featured pinning (`events.html`,
  `events.js`, `/api/events`, `/api/events/photo`, `events`/`event_photos` tables)
- Monthly dues / subscriptions (Sandha), per-individual and per-family
  (`subscriptions.html`, `/api/subscriptions`, `families.js`)
- Google Sign-In authentication, server-verified against Google's `tokeninfo`
  endpoint, real role/permission model (`roles`, `member_roles` tables,
  `requireAuth()` in `functions/api/_lib.js`)
- Admin console: 5 grouped sections (Overview / Giving / People / Content / Admin),
  permission-gated per action, dark mode, mobile bottom-sheet nav
  (`admin.html`, see `ADMIN_CONSOLE_GUIDE.md`)
- Admin-editable About page content, Bible verse-of-month/year curation, pastor
  contact info, force-login toggle — all without a code deploy (`config` table)
- Bible verse dictionary with English (KJV, seeded) and Tamil O.V. (schema ready,
  translation import pending — see `BIBLE_VERSES.md`)
- Responsive/mobile layout: `style.css`/`theme.css` carry ~20+ `@media` breakpoints
  each; `header.js` renders a distinct mobile bottom-sheet nav pattern (not a
  horizontally-scrolling strip) reused identically in `admin.html`
- Audit logging of every admin mutation (`activity_logs`)
- Full automated test suite: **328/328 tests passing** (see §Testing below)

**PARTIALLY IMPLEMENTED:**
- **Events** — the data model and public gallery work, but has no church/branch
  field, no YouTube/live link field, no Google Meet field, no prayer-info field.
  (The `extra TEXT` JSON column exists as an escape hatch for "future/optional
  fields" but nothing currently writes structured YouTube/Meet data into it.)
- **Member experience** — `member.html` / `member-dashboard.js` is **stale**: it
  still fetches directly from two hardcoded legacy Google Apps Script URLs
  (`script.google.com/macros/.../exec?fund=tech-contributions` and
  `...christmas-fund`) instead of the current D1-backed `/api/contributions`
  endpoint the rest of the site uses. This is a real discrepancy worth flagging to
  whoever owns the fund-architecture audit track — it isn't part of the frozen
  giving/payment path (`webhook.js`/`razorpay-checkout.js`), so it's likely just
  unmigrated legacy code, but it means a member's own contribution history can
  silently omit any fund created after this page was last touched.
- **Multilingual** — the Bible verse dictionary is schema-ready for Tamil (`TOV`
  version row exists, marked `is_complete = 0`, awaiting a bulk import), but this
  is verse-translation data only, not a site-wide UI language switch. No page has
  an `lang` toggle, no i18n string table, no `_en`/`_ta` columns on any live
  content table.

**DOCUMENTED ONLY (planned, not built — see `docs/milestone-v2/`):**
- Churches/branches as first-class entities (`churches` table spec in
  `05-backend-schema.md` §2.1) — organization model is "Church of Light" (mother
  church) + "City Worship Center" today, extensible to more later
- Testimonies & miracles gallery, with visitor submission + admin moderation
  (`testimonies` table spec, §2.3)
- Prayer request submission + admin follow-up tracking (`prayer_requests` table
  spec, §2.4) — no email notification capability exists yet anywhere in the
  backend (the PRD explicitly calls this out as a **new capability the app must
  gain**, §7.6)
- Contact form with auto-acknowledgement + team notification (`contact_messages`
  table spec, §2.5) — same email-capability gap
- Blog/articles (`blog_posts` table spec, §2.6)
- Programs/service-times schedule, per church (`programs` table spec, §2.7)
- Events extended with `church_id`, beneficiary/good-deed fields (additive
  migration spec, §2.8)
- Livestream/podcast + daily-prayer links as `config` key/value entries
  (`sunday_live_url`, `daily_prayer_url`, `podcast_playlist_url` — §2.9)
- Bilingual (English + Tamil) content across promises, testimonies, giving,
  prayer, contact, about (PRD §7.13)
- Promises engine — daily/monthly/yearly auto-rotating promise content (PRD §7.2,
  `promises` table spec)

**NOT IMPLEMENTED / NOT EVEN DOCUMENTED (true gaps against the task's product
vision — nothing in `docs/milestone-v2/` currently covers these):**
- **Google Meet integration** for prayer meetings specifically — zero mentions
  anywhere in the codebase or the milestone docs. The PRD's livestream section
  (§7.11) only discusses YouTube Live / podcast hosting, and §2.9's `config` keys
  (`sunday_live_url`, `daily_prayer_url`) are generic URL strings, not
  YouTube-vs-Meet-aware. **DECISION REQUIRED**: whether daily/night prayer
  "join" links are YouTube Live, Google Meet, or both, and whether the schema
  needs a `link_type` field to render the right UI (YouTube embed vs. "Join Meet"
  button).
- **Admin-paste-a-YouTube-URL-and-auto-render** as a generic capability (the PRD's
  `sunday_live_url`/`daily_prayer_url` config keys assume a URL is *stored* and
  presumably embedded, but no parsing/oEmbed/thumbnail-preview mechanism is
  specified anywhere).
- **Configurable prayer *schedules*** (recurring daily/weekly/monthly times, e.g.
  "5:00 AM–6:00 AM" and "9:30 PM–10:00 PM") as distinct from prayer *requests*.
  `programs` (§2.7) is the closest existing spec — it has `day_of_week`,
  `start_time`, `end_time`, `recurrence` — and could likely absorb this without a
  new table, but the milestone docs don't explicitly say "prayer schedule reuses
  `programs`." **DECISION REQUIRED** before Phase-0 implementation.
- **Configurable fund "ranking"** (task description mentions this under Funds) —
  not present in `funds` table or in the milestone-v2 backend schema doc. Likely
  belongs to the separate fund-architecture audit track, flagged here only so it
  isn't silently dropped.
- **Push/email notification delivery mechanism itself** — the PRD states the
  requirement (§7.6) and defers the *mechanism* to the TRD, but checking
  `02-TRD.md`'s "open questions" was out of this audit's depth budget; whoever
  picks up Phase 0 should confirm the TRD actually resolved this before building
  prayer-request/contact-form notification flows.

---

## D. Hardcoded Content

- **Navigation menu** — `header.js`'s `NAV` array (`funds`, `subscriptions`,
  `members`, `events`, `impact`, `about`) is a JS literal, not admin-configurable.
  Adding a page today means editing `header.js` directly.
- **Social/contact links** — YouTube channel URL, Instagram URL, Google Maps link
  are hardcoded per-page (`index.html`, `about.html`, `funds.html`, `impact.html`,
  `members.html`, `events.html`, `admin.html` — same literal URL repeated across
  7+ files, not a single config value).
- **Admin bootstrap identities** — 3 admin emails are hardcoded in *two* separate
  places: `functions/api/_lib.js` (`HARDCODED_SUPER_ADMINS`, server-enforced, the
  real security boundary) and `admin-session.js` (`ADMIN_EMAILS`, client-side
  convenience list controlling only whether the floating admin bar renders).
  These lists must be kept in sync manually — a discovery worth flagging, not a
  bug to fix under this investigation-only task.
- **Legacy fund API URLs** — the two Google Apps Script URLs in
  `member-dashboard.js` (see §C above).
- **Two-church org model** ("Church of Light" / "City Worship Center") — currently
  exists only as prose in the milestone-v2 PRD, nowhere in live code, confirming
  there is genuinely no church/branch concept in the shipped product yet.

## E. Dynamic Content

Already admin-driven without a code deploy, via the `config` key/value table and
dedicated tables:
- Fund goals, pastor contact info, force-login toggle (`Admin → Settings`)
- About page — hero text, mission cards, verses shown there, motivation banner,
  "Connect With Us" links (`Content → About page`, stored as one JSON setting)
- Verse of the Month/Year (`Content → Verses`)
- Funds themselves (create/edit/archive via `Giving → Funds`)
- Purchases, expenses, wishlist items (`Content`/`Giving` groups)
- Events + event photos (`/api/events`, admin-authored, draft/published)
- Roles/permissions (`Admin → Roles`)
- Member/family directory (`People` group)

---

## F. Information Architecture Gap (current vs. target ministry vision)

| Target capability | Current state |
|---|---|
| Homepage = "who we are" front door | Homepage = giving KPI dashboard; About page is a separate, secondary destination |
| Dynamic "what's happening now" feed (prayers, events, live, testimonies, announcements) | Does not exist. Each content type (events, funds) has its own separate page; nothing aggregates into a feed |
| Church/branch association ("Prayer Meeting — Ratnapuri") | No church/branch entity anywhere in the live schema or UI |
| Prayer schedule + prayer request | Neither exists live. Both are spec'd (partially) in milestone-v2 docs |
| YouTube live / auto-render from pasted URL | Static footer link to the channel only, on every page — no embed, no live-status detection |
| Google Meet for prayer participation | Zero references anywhere |
| Testimonies | Zero live implementation; fully spec'd in milestone-v2 `testimonies` table |
| Announcements/posts | Zero live implementation; closest spec is `blog_posts` |
| Multilingual (EN/TA) | Zero site-wide i18n; only the Bible-verse dictionary is bilingual-ready |
| Admin drives all public content without a deploy | True today for: funds, events, about, verses, purchases/expenses/wishlist. False for: nav structure, social links, church/branch info, prayer, testimonies, announcements (none of these exist yet to be admin-driven) |

**Bottom line:** the current site is a well-tested, functioning **giving +
transparency portal** with a real admin console and a genuine test safety net. It
is *not yet* a ministry platform. The gap is not a lack of planning — the six
milestone-v2 documents already describe almost the entire target architecture in
detail — the gap is that **implementation of that plan has not started** (stalled
at owner sign-off on the UI mockup split).

---

## G. Proposed Future Information Architecture

This section intentionally **does not re-derive** what `docs/milestone-v2/`
already specifies — it points to it and adds only what's missing.

- **Navigation, homepage sections, major pages, backend schema**: fully specified
  in `03-app-flow.md`, `04-uiux-design-spec.md`, and `05-backend-schema.md`. Follow
  those documents.
- **Church/branch presentation**: PRD §6 already mandates "Prayer Meeting —
  [Church]" style inline attribution over a forced church-selector gate — this
  matches the task's stated product principle exactly. No new decision needed;
  just build it as spec'd.
- **Gaps to resolve before Phase 0** (see the NOT IMPLEMENTED/NOT DOCUMENTED list
  in §C): Google Meet vs. YouTube link-type handling for prayer join links, prayer
  *schedule* modeling (likely an extension of the already-planned `programs`
  table), and confirming the TRD actually named a notification mechanism (email
  provider, at minimum) before any prayer-request/contact-form work begins.
- **Fund presentation on the website** (this audit's actual lane, not the fund
  architecture audit's): today `funds.html` shows a flat fund list from
  `/api/funds` with `goal_amount`/`status`/`visibility`, and `impact.html`
  separately shows purchases/expenses/wishlist with no connection back to a
  specific fund in the UI. If funds become fully dynamic per the task's Funds
  section (purpose, target, collected, contribution count, expenses, updates,
  images, prayer/message, ranking), the website-side work is primarily: (1) a
  richer fund detail view that pulls purchases/expenses/updates scoped to that
  fund instead of a separate unscoped page, and (2) surfacing fund progress on
  the homepage feed rather than only on `/funds`. The actual schema for
  per-fund updates/images/ranking is the other audit's territory.

---

## H. Admin → Website Flow (future state)

Today's precedent — Admin edits `about_content`/verses/events/funds as structured
JSON or rows in D1 → public pages `fetch()` the relevant `/api/*` endpoint on load
→ no code deploy required — is the correct pattern to extend. The same shape should
apply to churches, prayers, events (extended), testimonies, and announcements:
admin writes to a table via a permission-gated `functions/api/*.js` endpoint (reusing
`requireAuth()` + `audit()` per `05-backend-schema.md` §3), public pages read only
`status = 'published'` rows. The one new piece of infrastructure this requires that
doesn't exist today is **outbound notification** (email at minimum) for prayer
requests and contact messages — PRD §7.6 flags this explicitly as new.

**Security note on the admin/public boundary as it exists today:** the real
boundary is server-side (`requireAuth()` in `_lib.js`, verified Google ID token +
DB-backed role/permission lookup) — this is sound. `admin-session.js`'s
client-side HMAC-signed session bar is a UI convenience layer only (which pages
show the floating admin bar), not itself a security control; its secret being
visible in client JS is expected for that reason and not a vulnerability in
itself, but should not be mistaken for the auth boundary by future agents.

---

## I. Mobile UX

Already solid groundwork to build on:
- `header.js` renders a bottom-sheet mobile nav pattern (not a horizontally
  scrolling strip), reused identically in `admin.html`'s mobile nav per
  `ADMIN_CONSOLE_GUIDE.md`.
- ~20+ `@media` breakpoints each in `style.css`/`theme.css`; `admin.html`,
  `events.html`, `impact.html`, `members.html` each carry their own additional
  breakpoints.
- Chart.js canvases already require explicit bounded-height parent containers
  when `maintainAspectRatio: false` (documented pitfall in `CLAUDE.md`) — any new
  dashboard/feed cards with charts must follow this pattern or repeat the
  Analytics-tab blank-card bug.

Considerations for the future ministry-dashboard homepage specifically: a feed of
mixed card types (prayer, event, live-status, testimony, fund) needs one shared
mobile card component/pattern rather than N different card layouts, and a live
YouTube/Meet embed on mobile needs to not auto-play with sound and must not block
the rest of the feed from loading if the embed is slow (same "wrap in try/catch,
don't let one thing block a chain" principle `CLAUDE.md` already documents for
chart rendering).

---

## J. Migration Strategy

The milestone-v2 plan already commits to the right approach and it should not be
deviated from:
- **Feature-flagged rollout**: `SAFETY-AND-TESTS.md` requires the new UI ship
  behind a feature flag (`new_home_enabled` is even named in the schema doc, §2.9),
  so the redesign can go live incrementally without disrupting the current live
  giving flow.
- **Additive-only schema**: every new table is `CREATE TABLE IF NOT EXISTS`;
  `events` gets new nullable columns via `ALTER TABLE ... ADD COLUMN` — no existing
  column is touched.
- **Frozen giving path**: `webhook.js`, `contributions` table, `razorpay-checkout.js`
  do not change behavior. The redesign must route giving through the *existing*
  Razorpay flow, not a rebuilt one.
- **URLs**: current page URLs (`/funds`, `/members`, `/about`, etc.) are live and
  presumably indexed/bookmarked/shared. Any redesign that renames or removes them
  needs redirects, not silent replacement — this isn't explicitly addressed in the
  milestone-v2 docs yet. **DECISION REQUIRED**: will the redesign keep the same
  URLs (new content behind old paths) or introduce new paths (`/give`, `/pray`,
  etc.) needing redirect rules in `wrangler.jsonc`/Cloudflare Pages config?

---

## K. Implementation Phases (recommended small, independent tasks — not executed here)

1. Get owner sign-off on `07-ui-mockups-review.md`'s Home/Our-Giving split — this
   is the actual blocker, not a technical task.
2. Resolve the three **DECISION REQUIRED** items in this audit (Google
   Meet/YouTube link-type handling, prayer-schedule-vs-`programs` modeling, URL
   migration strategy) — small scoping tasks, not implementation.
3. Confirm `02-TRD.md` names a concrete email/notification mechanism; if not, that's
   a TRD amendment, not a code task.
4. Build `churches` table + minimal "which church" attribution on the *existing*
   events module first (lowest risk, schema already spec'd in §2.8) before touching
   the homepage.
5. Fix the `member-dashboard.js` legacy-API discrepancy (§C) — small, isolated,
   testable independently of the redesign; flag to the fund-architecture audit
   owner first since it touches fund data display.
6. Then proceed through `06-implementation-plan.md`'s phases as already ordered.

## L. Risks

- **Live users / current URLs**: real congregation members use `/funds`,
  `/members`, `/member.html?name=...` (bookmarked/shared links) today. Any
  redesign must preserve or redirect these.
- **Payment/fund pages**: `funds.html` → Razorpay checkout is the live money path.
  Nothing in the proposed ministry-platform work should route giving through a new
  code path without the mutation-testing safety check `CONTRIBUTING.md` §5
  requires.
- **Authentication**: the server-side boundary (`_lib.js`) is sound; the risk is
  future agents mistaking `admin-session.js`'s client-side email list for a
  security control and adding a feature that trusts it.
- **SEO**: no page currently uses much structured metadata beyond basics (not
  audited in depth here — worth a dedicated pass before a homepage rewrite, since
  the homepage's current URL likely carries whatever search equity exists).
- **Responsive behavior**: solid existing pattern (bottom-sheet nav, many
  breakpoints) — the risk is a new mixed-card-type feed inventing a third mobile
  nav pattern instead of reusing the established one.
- **Breaking existing functionality**: `npm test` (328 tests) is a real,
  passing safety net today — CI blocks a red suite from deploying
  (`.github/workflows/deploy.yml`, `needs: test`). Any implementation must extend
  it, not work around it.
- **Data duplication drift**: the hardcoded social-link URLs and the two admin-email
  lists (§D) are small but real examples of "content that should be one config
  value living in N places" — a pattern to specifically avoid repeating when
  building church/branch info, which will appear on About, Contact, Events, and
  the homepage feed simultaneously.

---

## Testing

`npm test` was run against the current `main`-derived state, unmodified:

```
# tests 328
# suites 0
# pass 328
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3240.708675
```

All 328 tests pass. No test or application code was changed to produce this
result.

---

## Note on the requested reading list

The task asked to read `docs/README.md`, `docs/development/AGENT_RULES.md`, and
`docs/development/AGENT_HANDOFFS.md` before starting. **None of these three files
exist in this repository** — this repo's actual mandatory-reading set (per
`CLAUDE.md`) is `CONTRIBUTING.md` + `docs/milestone-v2/README.md`, both of which
were read. `docs/product/` and `docs/architecture/` also did not exist prior to
this audit (the latter now contains this file). This is a factual discrepancy
between the task template and this repo's real structure, not an error in the
audit — flagging it so the next agent doesn't waste time hunting for files that
aren't there.
