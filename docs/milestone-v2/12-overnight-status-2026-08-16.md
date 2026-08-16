# 12 · Overnight status — 2026-08-16

| | |
|---|---|
| **Purpose** | An honest, repo-verified snapshot of where LJM V2 actually stands, what this session built, and what's left — written as a handoff for whoever (human or agent) picks this up next. |
| **Method** | Every claim below was checked against the actual repository, actual `npm test` output, and actual git history — not against prior handoff docs. Where a prior doc's claim couldn't be verified in this repo, that's called out explicitly rather than repeated. |

---

## 1. Correcting the starting assumptions

The task brief for this session referenced a **literal "11 feature blocks"** roadmap
and an existing **Playwright e2e suite (6/6 passing)**. Neither was found in this
repository:

- **No "11 blocks" document exists anywhere in git history, `docs/`, or any handoff
  file.** The closest real, approved artifact is
  [`01-PRD.md`](./01-PRD.md) §7, which defines **14 numbered feature requirements**
  (§7.1–§7.14: Home, Promises, Testimonies, Giving, Prayer, Contact, Events/Good
  Deeds, Programs/Schedule, Blog, Youth Ministry, Live Podcast, About, Language,
  Admin). This PRD — plus TRD, App Flow, UI/UX Spec, Backend Schema, and
  Implementation Plan (docs 02–06) — **is** the canonical, already-approved roadmap.
  Treat §7.1–§7.14 as the roadmap going forward; don't reintroduce an "11 blocks"
  framing that has no source in this repo.
- **No Playwright dependency, config, or test directory exists in this repo**
  (`package.json` has exactly one script: `node --test`). `11-v2-flow-implementation.md`
  describes Playwright verification runs performed *during* that session, but nothing
  was checked in — no `playwright.config`, no `tests/e2e/`, no `@playwright/test` in
  `package.json`. **There is currently zero browser-level test coverage in this repo.**
  This session's environment does have Chromium pre-installed for Playwright, so
  building real e2e infra is feasible — just not done yet (see §5).

Elsewhere the brief's assumptions were closer to reality: `npm test` really was green
before this session started, and the repo really is Cloudflare Pages + D1 + Razorpay +
Google Sign-In, with the file inventory (`webhook.js`, `contributions.js`, `roles.js`,
etc.) matching what's actually in `functions/api/`.

## 2. Actual state at session start (verified)

- `npm test`: **328/328 passing** (`git log` shows this suite grew from an 82-test
  baseline on 2026-07-17 through steady, well-documented hardening work — funds,
  events, families, subscriptions, bible verses, SQL-injection/CORS/DB-binding
  regression sweeps, and a Razorpay-webhook data-gap fix).
- **Core giving portal is mature and production-live**: members, funds, contributions,
  purchases, expenses, wishlist, families, subscriptions, roles/permissions, audit
  logging, Bible verse dictionary, events (with photo galleries), admin console
  (`admin.html`, 217KB, full CRUD for all of the above).
- **`docs/milestone-v2/` docs 01–06 are complete and (per the README) approved** — the
  full PRD → TRD → App Flow → UI/UX → Backend Schema → Implementation Plan chain for
  the "Worldwide Ministry App" milestone.
- **Doc 11 (`11-v2-flow-implementation.md`) is real, shipped work** — a feature-flagged
  ("beta cookie") **restyle of the *existing* dashboard/giving/events/contributions
  data** into a new `/v2/*.html` UI shell (Home, Our Giving, Events, My Giving, Give
  Flow), gated to an admin-managed tester allowlist. **This is not the same thing as
  the new PRD content types** (promises, testimonies, prayer, contact, blog, programs,
  churches) — it's a UI/UX modernization of what already existed. Verified: none of
  `promises`, `testimonies`, `prayer_requests`, `contact_messages`, `blog_posts`,
  `programs`, `churches` existed anywhere in `schema.sql`/`migrations/` before this
  session (confirmed by grep before starting any work).
- **No i18n/language-switching mechanism exists** in `script.js`/`header.js`/`theme.js`
  (confirmed by grep) — PRD §7.13's English+Tamil requirement is unbuilt, though the
  Bible-verse dictionary already carries a Tamil version (TOV) as a content precedent.
- **R2 is configured in `wrangler.jsonc`** (`EVENT_PHOTOS` binding, bucket
  `ljm-event-photos`) for event photos, with a base64-in-D1 fallback when unbound.
  Whether the bucket is actually provisioned in the live Cloudflare account **could
  not be verified from this environment** (no production access) — per `EVENTS_SETUP.md`
  this is a manual one-time Cloudflare dashboard step.

## 3. What this session built

Executed **Implementation Plan Phases 0–5, backend only** — i.e. every new PRD
content type's database table, API endpoint (with permission gates matching the
existing `roles`/`member_roles` system — `manage_content` and `manage_funds` were
*already* present in the seeded `super_admin` permission set, so no new permission
scope was needed), and a full test suite per `CONTRIBUTING.md`'s mandate (happy path +
permission gate + visibility boundary + validation edges for every endpoint):

| Migration | Table(s) | Endpoint | PRD ref | Tests |
|---|---|---|---|---|
| `0015_churches.sql` | `churches` | `churches.js` | §6 (two-church model) | `churches.test.mjs` |
| — | — | `_mail.js` (Resend helper, opt-in) | §7.6 dependency | `_mail.test.mjs` |
| `0016_promises.sql` | `promises` | `promises.js` (today-resolver) | §7.1–7.2 | `promises.test.mjs` |
| `0017_testimonies.sql` | `testimonies` | `testimonies.js` | §7.3 | `testimonies.test.mjs` |
| `0018_prayer_contact.sql` | `prayer_requests`, `contact_messages` | `prayer.js`, `contact.js` | §7.5–7.6 | `prayer.test.mjs`, `contact.test.mjs` |
| `0019_programs_and_event_church.sql` | `programs` + `events` ALTER (nullable church/beneficiary columns) | `programs.js`, extended `events.js` | §7.7–7.8 | `programs.test.mjs`, extended `events.test.mjs` |
| `0020_blog.sql` | `blog_posts` | `blog.js` | §7.9–7.10 | `blog.test.mjs` |

**Test suite: 328 → 407 passing (+79), zero failures, zero regressions.** Every
migration is additive-only (`CREATE TABLE IF NOT EXISTS` / nullable `ADD COLUMN`,
consistent with `CONTRIBUTING.md` §4). `schema-contract.test.mjs` was extended for
every new table. The `events.js` extension was verified non-breaking with an explicit
"fields default to null for existing callers" regression test. One permission gate
(`contact.js`'s `PUT`) was mutation-tested per `CONTRIBUTING.md` §5 — deliberately
broken, confirmed the test catches it, reverted, confirmed clean — proving the new
tests are load-bearing, not decorative.

**Design decisions worth flagging explicitly:**
- Migration numbers **0012–0014 were already taken** on `main` (contribution
  attribution, beta access, webhook backfill) by the time this session started, so
  the new migrations are numbered `0015`–`0020` rather than the `0012`+ the schema
  doc originally sketched. `05-backend-schema.md`/`06-implementation-plan.md` still
  reference the old numbers in prose — not corrected in this pass, flagging so a
  future reader isn't confused by the mismatch between the doc text and the actual
  filenames.
- `churches.js` DELETE **archives, never hard-deletes** (a church scopes real
  events/programs) — same pattern as `funds.js`'s soft-delete.
- Public submission endpoints (`testimonies.js` POST, `prayer.js` POST, `contact.js`
  POST) **ignore any caller-supplied `status`/moderation field** — a visitor can never
  self-publish. Verified by test.
- `_mail.js` follows the exact "opt-in, persist-first" pattern `webhook.js` already
  established for the Google-Sheets forward: unset `RESEND_API_KEY` → documented
  no-op, never a network call, never a thrown error. `prayer.js`/`contact.js` always
  write the D1 row *before* attempting email, and a stubbed-to-fail `fetch` was used
  in tests to prove a mail outage can never lose a submission.

## 4. What is genuinely still missing (not built this session)

Everything **frontend and operational** for the six new content types:

- **No public-facing screens** render any of promises/testimonies/prayer/contact/
  programs/blog/churches yet — these are API-only right now. `03-app-flow.md`'s
  screen inventory (S4, S5, S8, S10, S11, etc.) is unbuilt for this content.
- **No admin-console UI** for any of the six new content types — `admin.html` was not
  touched this session. The Implementation Plan's "admin from day one" ground rule
  is not yet satisfied; today the only way to manage this content is direct API calls.
- **i18n scaffold** (Phase 0's `t()` helper + language toggle) — not started. Every
  new table already has `*_en`/`*_ta` columns ready for it.
- **Feature-flag plumbing** for these new public screens — not started (the existing
  beta-cookie mechanism from doc 11 only gates the old-content v2 UI restyle).
- **Media/livestream config keys** (`sunday_live_url`, `daily_prayer_url`,
  `podcast_playlist_url`) — not registered; PRD §7.11 (Live Podcast) has no code yet.
- **Browser/e2e test infrastructure** — genuinely absent (see §1). Chromium is
  available in this environment; building it is feasible follow-up work.
- **Production**: migrations `0015`–`0020` have **not** been applied to the live D1
  (this session never touched production, per the standing safety rules). `_mail.js`
  needs `RESEND_API_KEY` and `TEAM_NOTIFY_EMAIL` set in the Cloudflare Pages
  environment before Prayer/Contact acknowledgements will actually send — until then
  the endpoints work correctly and safely, they just don't email anyone (by design,
  not by bug).

## 5. Recommended next steps, in priority order

1. **Admin UI for the six new content types** — the highest-leverage next slice,
   since none of this is manageable by the pastor/team without it yet. Follow
   `admin.html`'s existing `NAV_GROUPS`/section-loader pattern (same one `roles.js`/
   `settings.js` panels use). Extend `tests/frontend/contribution-member-picker.test.mjs`'s
   static-parse pattern for each new panel per `CONTRIBUTING.md` §7's "known pitfall"
   (grep-confirm every called function is defined; wrap chained renders in
   `try/catch`).
2. **Public screens for Promises + Testimonies** (PRD §7.1–7.3) — these are the
   "inspire daily" core of the whole milestone's stated vision; highest product value
   per visitor.
3. **Prayer + Contact public forms** (§7.5–7.6) — pair with actually setting
   `RESEND_API_KEY`/`TEAM_NOTIFY_EMAIL` in a real (non-production-touching) test, then
   documenting the production env-var step for the owner.
4. **i18n scaffold** — do this before writing much more public-facing markup, since
   retrofitting translation into already-built screens is more work than building it
   in from the start.
5. **Playwright e2e**, scoped exactly per the original brief's guidance: Chromium-only,
   headless, local-only, screenshots on failure only — cover the golden paths (public
   giving, admin login, the new public screens once built) rather than trying to
   cover everything at once.
6. **Apply migrations `0015`–`0020` to production D1** — only after an owner review of
   the raw SQL (per `CONTRIBUTING.md` §4's "one more slow read after a break" rule)
   and only when the owner is ready to open write access to these new features
   (right now they're additive and inert — no live traffic depends on them yet, so
   there's no urgency).

## 6. What was deliberately *not* done this session

- **No changes to the frozen money path** (`webhook.js`, `contributions.js`,
  `razorpay-checkout.js`, `verify.js`, `auth.js`, `roles.js`, `purchases.js`,
  `_lib.js`) beyond adding new permission-gated reads that reuse `_lib.js` exactly as
  every other endpoint does — no behavior of the existing exports changed.
- **No production actions of any kind** — no migrations applied, no Cloudflare config
  touched, no real Razorpay transactions, no deploys.
- **No admin.html changes** — deferred to the next slice (see §5) rather than rushed
  in without browser verification capacity budgeted for this pass.
