# Milestone v2 — Status Tracker (14-Requirement Matrix)

| | |
|---|---|
| **Last updated** | 2026-08-16, by a deep-implementation session (Phases 0-5) |
| **Source of truth for scope** | [`01-PRD.md`](./01-PRD.md) §7 (14 canonical requirements) |
| **Branch** | `claude/ljm-v2-product-completion-gtmw76` |

> **Read this before trusting any other status claim about this milestone.**
> A prior session's report claimed migrations 0015-0020, churches, promises,
> testimonies, prayer, contact, programs, and blog were already implemented
> with 407 passing tests. **None of that was true of the actual repository**
> at the start of this session — `main` had only migrations through `0014`,
> zero of the seven new content APIs existed, and `npm test` reported 148
> passing tests. Only `docs/milestone-v2/11-v2-flow-implementation.md`'s
> Phase 0 work (beta-flag routing + porting Home/Our-Giving/Give-flow/
> My-Giving/Events to `/v2/*.html`) had actually landed. Verify claims
> against `git log` and `npm test`, not prose.

---

## How "done" is being judged here

Not by file count or test count. Each requirement below is scored across six
axes — **backend, database, admin UI, public UI, i18n, tests** — and the
overall percentage is a rough blend weighted toward "can a real visitor and a
real admin actually use this," not "does an endpoint exist."

Legend: `COMPLETE` · `PARTIAL` · `NOT STARTED` · `BLOCKED`

---

## 1. Home

**Status: PARTIAL (~70%)**

- Backend: `COMPLETE` — reads real `/api/promises?when=today`,
  `/api/testimonies`, `/api/events`, `/api/contributions`, `/api/settings`.
- Public UI: `PARTIAL` — hero, today/month/year promise rotator (real data,
  falls back to a static verse only if the API is unreachable), Give·Pray·
  Connect action cards (all now link to real pages), Giving-at-a-glance,
  upcoming events, and a new latest-testimony teaser are all live. **Missing**
  from the PRD's S1 anatomy: an explicit "next event/service, church-aware"
  distinction (events show, but aren't filtered by church) and a visible
  live/offline status strip for Sunday Live (Watch & Listen is a separate
  page, not surfaced on Home itself).
- i18n: `PARTIAL` — nav, hero copy, action cards, promise labels tagged;
  Giving-at-a-glance and events-grid copy is still English-only.
- Admin: N/A (composed from other admin-managed content).
- Tests: existing Home-adjacent tests unaffected; no new Home-specific test
  (the promise/testimony fetch logic is exercised indirectly via the
  `promises.test.mjs`/`testimonies.test.mjs` API tests it calls).

**Remaining:** church-aware event filtering on Home, live-status strip,
i18n for glance/events copy.

---

## 2. Promises

**Status: COMPLETE (backend+admin+public) — 95%**

- Backend: `COMPLETE` — `functions/api/promises.js`, IST-aware today-resolver
  with per-scope fallback to the latest published row, full CRUD.
- Database: `COMPLETE` — `migrations/0016_promises.sql` + `schema.sql`.
- Admin UI: `COMPLETE` — scope-aware form (date/month/year fields
  show/hide), list with publish state, edit/delete.
- Public UI: `COMPLETE` — `v2/promises.html` (today/month/year cards +
  archive list), wired into Home's hero card.
- i18n: `COMPLETE` for this page (labels + `pick(textEn, textTa)` for
  content — Tamil renders whenever an admin fills in `text_ta`).
- Tests: `promises.test.mjs` — today-resolver exact-match vs fallback,
  visibility (published vs draft), permission gate, delete.

**Remaining:** nothing structural; content population (actually writing
daily/monthly/yearly promises in admin) is an ongoing editorial task, not a
code gap.

---

## 3. Testimonies

**Status: COMPLETE (backend+admin+public) — 95%**

- Backend: `COMPLETE` — public submit (always `pending`), admin
  moderate/publish/reject/edit/delete, admin-direct-add at any status.
- Database: `COMPLETE` — `migrations/0017_testimonies.sql`.
- Admin UI: `COMPLETE` — moderation queue with inline publish/reject,
  full edit form.
- Public UI: `COMPLETE` — `v2/testimonies.html` (kind filter, submission
  form), Home teaser slot.
- i18n: `COMPLETE` for this page's chrome; content bilingual via
  `pick(bodyEn, bodyTa)`.
- Tests: `testimonies.test.mjs` — pending-not-public, moderation gate,
  admin-direct-publish, validation, delete.

**Remaining:** nothing structural.

---

## 4. Giving

**Status: COMPLETE — untouched, frozen by design — 100% (pre-existing)**

Out of scope for this session by the milestone's own non-negotiable rule.
Verified untouched: `git diff` against the pre-session base shows zero
changes to `webhook.js`, `contributions.js`, `razorpay-checkout.js`, or the
`contributions`/`funds` schema. Regression suite (`webhook.test.mjs`,
`contributions.test.mjs`, `funds.test.mjs`, `schema-contract.test.mjs`) still
green.

---

## 5. Prayer

**Status: COMPLETE (backend+admin+public) — 90%**

- Backend: `COMPLETE` — `functions/api/prayer.js`, persist-first-then-email
  via `_mail.js`, never public, status workflow (new/praying/contacted/closed).
- Database: `COMPLETE` — `migrations/0018_prayer_requests.sql`.
- Admin UI: `COMPLETE` — private inbox, status-filter, inline status dropdown.
- Public UI: `COMPLETE` — `v2/pray.html` form, linked from Home/nav/footer/
  mobile action bar everywhere.
- Email: `PARTIAL` — `_mail.js` is written and tested against the "no
  provider configured" path (soft no-op, submission still persists); the
  Resend integration itself has never been exercised against a live API key
  because no `RESEND_API_KEY`/`TEAM_NOTIFY_EMAIL` exists in this
  environment. **Production dependency**, not a code gap — see §"Production
  remaining" below.
- Tests: `prayer.test.mjs` — persistence-despite-no-mail-provider, never
  publicly readable, status flow, validation.

**Remaining:** set `RESEND_API_KEY`/`MAIL_FROM`/`TEAM_NOTIFY_EMAIL` in
production and confirm one real send (human/production verification only).

---

## 6. Contact

**Status: COMPLETE (backend+admin+public) — 90%**

Same shape and same email caveat as Prayer. `functions/api/contact.js`,
`migrations/0019_contact_messages.sql`, admin inbox, `v2/contact.html` (also
renders live church cards from `/api/churches`). `contact.test.mjs` covers
validation, persistence-despite-no-mail, inbox gating, status update.

---

## 7. Events, Good Deeds & Beneficiaries

**Status: PARTIAL (~55%)**

- Backend: `COMPLETE` — `migrations/0021_events_church_scope.sql` adds
  `church_id`, `beneficiaries_count`, `good_deed_summary_en/ta` (nullable,
  additive, existing `events.js` contract unchanged).
- Admin UI: `NOT STARTED` for the new columns — the existing Events admin
  section (already in `admin.html` pre-session) does not yet expose
  church/beneficiary fields on the create/edit form.
- Public UI: `PARTIAL` — `v2/events.html` (already existed pre-session)
  shows events but does not filter by church or surface good-deed/
  beneficiary info; Home's events grid is the same.
- Tests: no new test added for the church-scope columns themselves (no
  behavior change to guard beyond what `events.test.mjs` already covers,
  since the new columns are unused by any handler yet).

**Remaining:** admin form fields for church/beneficiaries, public
church-filter + good-deed display — same shape of work already done for
Programs (§8), so it's a bounded, well-understood next step.

---

## 8. Programs & Schedule

**Status: COMPLETE (backend+admin+public) — 90%**

- Backend: `COMPLETE` — `functions/api/programs.js`, church + ministry-area
  filtering.
- Database: `COMPLETE` — `migrations/0020_programs.sql`.
- Admin UI: `COMPLETE` — church picker (live from `/api/churches`),
  day-of-week/time/recurrence fields.
- Public UI: `COMPLETE` — `v2/programs.html` (church filter chips), reused
  by `v2/youth.html` for the youth-scoped view.
- Tests: `programs.test.mjs` — active-only visibility, church filter,
  validation, permission gate.

---

## 9. Blog

**Status: COMPLETE (backend+admin+public) — 90%**

- Backend: `COMPLETE` — `functions/api/blog.js`, slug uniqueness, draft/
  published, `ministry_area` for youth reuse.
- Database: `COMPLETE` — `migrations/0022_blog.sql`.
- Admin UI: `COMPLETE` — full CRUD with category/ministry-area/status.
- Public UI: `COMPLETE` — `v2/blog.html` (list + `?slug=` post view).
- Tests: `blog.test.mjs` — draft-hidden, slug lookup 404 for drafts,
  ministry filter, duplicate-slug rejection, permission gate.

**Remaining:** no rich-text/media embedding beyond a single `cover_url` and
plain-text body — acceptable for launch per PRD's **S** (should-have) scope,
but worth a follow-up if the pastor wants formatted posts.

---

## 10. Youth Ministry

**Status: PARTIAL (~65%)**

- Backend: `COMPLETE` (by design) — reuses Programs + Blog scoped by
  `ministry_area='youth'`, exactly as `05-backend-schema.md` specifies. No
  bespoke table.
- Public UI: `COMPLETE` for the hub itself — `v2/youth.html` pulls
  youth-scoped programs and posts.
- Admin UI: `PARTIAL` — there is no dedicated "Youth" admin section, but an
  admin can already tag any Program or Blog post with `ministryArea: "youth"`
  through the existing Programs/Blog admin forms (the `ministryArea` text
  field is generic, not youth-specific). This satisfies the letter of the
  reuse design but a pastor-facing UI would benefit from a documented
  convention or a small "youth" quick-filter in those two admin sections.
- Events integration: `NOT STARTED` — Youth Ministry doesn't yet pull from
  Events (only Programs + Blog), even though the PRD lists "youth programs,
  events, media."

**Remaining:** youth-tagged events on the hub; a small UX affordance in the
Programs/Blog admin sections for tagging content as youth (even just a
checkbox that sets `ministryArea='youth'`) instead of a free-text field.

---

## 11. Live Podcast / Livestream

**Status: PARTIAL (~55%)**

- Backend: `COMPLETE` — `settings.js` extended with `sunday_live_url`,
  `daily_prayer_url`, `podcast_playlist_url`, `sunday_live_status`
  (`live`/`offline`), all in the existing `config` table (per
  `05-backend-schema.md` §2.9 — explicitly "no new table").
- Public UI: `COMPLETE` — `v2/watch.html` embeds whatever URL is configured
  (YouTube URLs auto-normalized to embed form), shows a graceful "offline"
  card per stream when unset, and a live/offline badge on Sunday Live.
- Admin UI: `NOT STARTED` — there is no admin form field yet for editing
  `sunday_live_url`/`daily_prayer_url`/`podcast_playlist_url`/
  `sunday_live_status`. They're writable via `PUT /api/settings` (same
  pattern as the Verse-of-the-Month editor) but no UI calls it yet.
- Tests: none added specifically (the settings keys ride on the existing
  `settings.js` write-path, already covered by `settings.test.mjs`'s
  whitelist/validation tests structurally, but no test asserts these
  specific keys round-trip).

**Remaining:** a small admin "Media / Livestream" settings panel (4 fields +
a live/offline toggle) — this is the single highest-value remaining gap,
since right now a pastor cannot self-serve turning "live" on without a
direct API call.

---

## 12. About

**Status: NOT STARTED (this session) — pre-existing About page only**

The pre-existing `about.html`/`ABOUT_PAGE.md` JSON-blob editor (built before
this milestone) is untouched and still works. This session did **not**
extend it with the "Our Churches" section the PRD's S2 calls for (Church of
Light / City Worship Center identity, location, service times, pulled from
the now-real `/api/churches`). The `/api/churches` backend + admin CRUD
(§14 below) are ready for this; only the About-page composition work itself
is outstanding.

**Remaining:** add an "Our Churches" section to `about.html` that renders
`/api/churches` (church cards: name, address, service times, map link).

---

## 13. Language (English + Tamil)

**Status: PARTIAL (~55%)** — the architecture is real, coverage is partial.

- Architecture: `COMPLETE` — `v2/i18n.js`: one dictionary, `t()`/`pick()`
  helpers, `localStorage`-persisted choice, `data-i18n`/
  `data-i18n-placeholder` attribute binding, a `ljm:langchange` event so
  dynamic content re-renders on toggle. This directly replaces dead CSS: the
  `.lang-toggle`/`.church-switch` classes existed in `shared.css` **before
  this session** but were never referenced by any HTML or JS anywhere in the
  repo — the toggle looked planned but did not exist. It now does, on every
  v2 page.
- Coverage: `PARTIAL` —
  - **Fully bilingual:** nav + shared chrome (all v2 pages), all four
    brand-new content pages (Promises, Testimonies, Pray, Contact) — both
    static UI strings and CMS content (via `pick()`).
  - **Not yet tagged:** most body copy on the pages that existed before
    this session (`give-flow.html`, `my-giving.html`, `our-giving.html`,
    `events.html`'s content strings) — only their nav/header/footer chrome
    picked up `data-i18n` via the shared patch. Programs/Blog/Watch/Youth
    pages (built this session) also only tag chrome, not their dynamic
    result copy (acceptable — that copy is CMS content already bilingual-
    capable via `pick()` once an admin fills in `*_ta` fields).
  - **Not started:** the legacy (non-`/v2/`) site — `index.html`,
    `admin.html`, etc. — has no language toggle and isn't in scope for this
    milestone's flag-gated flow.
- Tests: none automated (no DOM test harness in this suite per
  `tests/frontend/*`'s static-parse-only approach — see CLAUDE.md). Verified
  manually via `new Function()` syntax checks on every touched file, not via
  a rendered browser.

**Remaining:** tag the pre-existing pages' body copy; consider a
`tests/frontend/i18n.test.mjs` that statically asserts every `data-i18n` key
used in the HTML exists in `v2/i18n.js`'s `DICT.en` (cheap regression guard,
same spirit as the analytics-chart test).

---

## 14. Admin

**Status: PARTIAL (~75%)**

- New sections: `COMPLETE` — Churches, Promises, Testimonies (moderation),
  Prayer (inbox), Contact (inbox), Programs, Blog all added to `admin.html`
  under a new "Ministry" nav group, following the existing
  form+table+`mini-btn` pattern (not a second architecture).
- Auth: `COMPLETE` — every mutation gated by `manage_content` (or
  `manage_funds` for Churches, matching the backend-schema spec), reusing
  `requireAuth`/`audit` exactly as existing sections do. `PERMISSION_SCOPES`
  already listed `manage_content` pre-session, so no role-editor change was
  needed.
- Gaps: `PARTIAL` —
  - Events admin section (pre-existing) not extended for the new
    church/beneficiary columns (§7).
  - No Media/Livestream settings panel (§11).
  - No "Our Churches" tie-in on the About editor (§12).
- Tests: admin.html has no automated test harness at all (true before this
  session too — `tests/frontend/*` only covers `script.js`, not
  `admin.html`). Verified by static syntax check (`new Function()` on every
  inline `<script>` block) and an automated cross-check that every new
  element `id` referenced by JS exists in the markup — not a substitute for
  a real click-through, which requires a browser (see §"Browser
  verification" below).

---

## Overall progress: ~72%

**How this was calculated:** each requirement above got a rough 0-100 score
across backend/db/admin/public/i18n/tests, weighted so a requirement with a
real API but no UI caps around 40-50%, and a requirement with real UI but a
production dependency (email) caps around 90%. The 14 scores were then
averaged, *not* weighted by requirement priority (M vs S) — Giving counts the
same as Blog. This is a subjective estimate, not a formula; treat the
per-requirement detail above as the real source of truth, this number as a
one-line summary for a skim-reader.

| # | Requirement | Status | ~% |
|---|---|---|---|
| 1 | Home | PARTIAL | 70 |
| 2 | Promises | COMPLETE | 95 |
| 3 | Testimonies | COMPLETE | 95 |
| 4 | Giving | COMPLETE (frozen, pre-existing) | 100 |
| 5 | Prayer | COMPLETE | 90 |
| 6 | Contact | COMPLETE | 90 |
| 7 | Events (church-scope) | PARTIAL | 55 |
| 8 | Programs | COMPLETE | 90 |
| 9 | Blog | COMPLETE | 90 |
| 10 | Youth Ministry | PARTIAL | 65 |
| 11 | Live Podcast | PARTIAL | 55 |
| 12 | About (Our Churches) | NOT STARTED | 15 |
| 13 | Language | PARTIAL | 55 |
| 14 | Admin | PARTIAL | 75 |

---

## Production remaining (separate from code-complete)

**CODE COMPLETE, needs production configuration:**
- Apply migrations `0015`-`0022` to the real D1 database via
  `apply-d1-migration.yml` (dry-run + backup first, per
  `SAFETY-AND-TESTS.md`) — **not done this session**, per the "never touch
  production" constraint.
- Set `RESEND_API_KEY`, `MAIL_FROM`, `TEAM_NOTIFY_EMAIL` in Cloudflare Pages
  env vars for Prayer/Contact email to actually send (currently a verified
  no-op without them).
- Populate `sunday_live_url`/`daily_prayer_url`/`podcast_playlist_url` via
  `PUT /api/settings` (no admin UI for this yet — see §11).

**HUMAN VERIFICATION REQUIRED:**
- A real browser click-through of every new page (no Playwright/E2E
  infrastructure exists in this repo — verified via `ls node_modules/.bin/
  playwright` → not found, and no `@playwright/test` in `package.json`).
  Everything in this session was verified via `npm test` (behavioral, real
  SQLite, real handler code) and static analysis (script syntax, tag
  balance, id-reference cross-check) — **not** an actual rendered page in a
  real browser. Treat visual/interaction correctness as unverified until
  someone (human or a future E2E-equipped session) loads these pages.
- Bilingual review of the Tamil strings in `v2/i18n.js` by a native speaker —
  they were written by the implementing agent, not reviewed by a Tamil
  speaker.

---

## Remaining roadmap, in priority order

1. **Media/Livestream admin panel** (§11) — smallest gap with the highest
   pastor-facing value; a pastor cannot self-serve going "live" without it.
2. **Events church-scope admin fields + public church filter** (§7) — same
   shape of work as Programs, already proven out.
3. **About page "Our Churches" section** (§12) — `/api/churches` is ready;
   this is pure composition work.
4. **Browser E2E harness** (`@playwright/test`, Chromium-only, headless,
   local Wrangler Pages dev + local D1) — needed before any confident
   "production-ready" claim; see PHASE 17-19 of the original mission brief
   for the intended scope (home loads, nav works, each new form submits,
   admin CRUD round-trips, mobile viewport, language switch).
5. **i18n coverage expansion** to the pre-existing v2 pages' body copy.
6. **Youth admin UX** — a checkbox/quick-filter instead of free-text
   `ministryArea`, plus pulling youth-tagged events into the hub.
7. **Production dispatch**: migrations, mail env vars, media URLs — once a
   human has reviewed the above and is ready to move this milestone toward
   cutover (`06-implementation-plan.md` Phase 7).

---

## Risks

**HIGH:** None identified that touch the frozen giving path — verified via
`git diff` against the pre-session base (zero lines changed in
`webhook.js`/`contributions.js`/`razorpay-checkout.js`) and a full green
`npm test` run (367/367) including `schema-contract.test.mjs`'s tripwires.

**MEDIUM:**
- No browser has ever actually rendered any of the 9 new/touched pages in
  this session — static checks (script syntax, tag balance, id
  cross-reference) catch a lot of what CLAUDE.md's "undefined function"
  pitfall warns about, but not CSS layout bugs, broken responsive behavior,
  or a genuinely broken interaction flow.
- Prayer/Contact email is unverified end-to-end (no `RESEND_API_KEY` in any
  environment reachable from this session).

**LOW:**
- Tamil translations are agent-written, unreviewed by a native speaker —
  likely fine but not guaranteed idiomatic.
- The `youth` `ministryArea` tag is a free-text convention, not an enum —
  a typo (`Youth` vs `youth`) would silently exclude content from the hub.
  Consider a `CHECK` constraint or a fixed dropdown in a follow-up.

---

## Session summary (this session)

**Implemented:** 7 new backend content types end-to-end (churches, promises,
testimonies, prayer, contact, programs, blog) — migrations, D1 schema, API
handlers, admin UI sections, 9 new/updated public pages, a real i18n
foundation, and the beta-flow routing to reach all of it.

**Migrations added:** `0015`-`0022` (8 files), all additive, all
`CREATE TABLE IF NOT EXISTS` / nullable `ADD COLUMN`, none applied to
production.

**Tests added:** `churches.test.mjs`, `promises.test.mjs`,
`testimonies.test.mjs`, `prayer.test.mjs`, `contact.test.mjs`,
`programs.test.mjs`, `blog.test.mjs` (new), `_middleware.test.mjs` and
`schema-contract.test.mjs` (extended). Suite grew from 148 → 367 passing
tests, zero regressions.

**Browser E2E:** not built this session (no infrastructure existed;
documented as the top remaining roadmap item, not silently skipped).

**Documentation:** this file (new); `06-implementation-plan.md`'s phase
checkboxes should be marked against this file's per-requirement detail
rather than duplicated here.
