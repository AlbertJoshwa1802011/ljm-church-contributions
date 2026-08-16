# 12 · Phase 0–5 real implementation status (as of this session)

| | |
|---|---|
| **Branch** | `claude/ljm-v2-production-impl-amrdbz` |
| **Scope** | Backend + admin + public UI for Phases 0–5 of [`06-implementation-plan.md`](./06-implementation-plan.md): churches, promises, testimonies, prayer, contact, programs, blog, events church/beneficiary extension, watch & listen config, i18n scaffold |
| **Status** | Code complete, tested (361/361), pushed. **Not yet merged to `main`, not yet deployed to production, additive migrations dispatched to production D1 via the existing gated workflow** (see §4). |

This document supersedes the "beta-flow" framing in
[`11-v2-flow-implementation.md`](./11-v2-flow-implementation.md) as the current
source of truth for what's built. The beta-flow work (flag-gated ports of
Home/Our-Giving/Events/Give-Flow/My-Giving to `/v2/`) is **still live and
unmodified** — this phase adds the ministry-content features from the PRD
(promises, testimonies, prayer, contact, programs, blog, churches) as **new,
directly-reachable `/v2/*.html` pages**, not gated by the beta cookie, since
they have no old-flow collision to route around.

## 1. What actually exists in code now

**Backend** (`functions/api/*.js`, all reuse `requireAuth()`/`audit()`/`json()`
from `_lib.js` — no new auth mechanism):
- `churches.js` — the two-church directory + soft-delete/archive
- `promises.js` — daily/monthly/yearly promise words, IST "today" resolver with
  fallback-to-most-recent-published
- `testimonies.js` — public submit (lands `pending`) + admin moderate/publish
- `prayer.js` — public submit (never public read) + admin inbox/status
- `contact.js` — public submit + admin inbox/status; both prayer and contact
  persist to D1 **before** attempting email via the new `_mail.js` (Resend
  HTTP API) helper, which no-ops safely with `{sent:false}` when
  `RESEND_API_KEY` isn't configured — nothing is ever lost to a mail failure
- `programs.js` — service times/recurring programs, filterable by church
- `blog.js` — posts with slug lookup, draft/published, `ministryArea` tagging
  (reusable for Youth Ministry)
- `events.js` — additively extended with `church_id`/`beneficiariesCount`/
  `goodDeedSummaryEn`/`goodDeedSummaryTa` and a `?church=` filter; existing
  contract/behavior unchanged (see `tests/api/events.test.mjs`, still green)
- `settings.js` — additively extended with `sunday_live_url`/
  `daily_prayer_url`/`podcast_playlist_url` config keys

**Database** — migrations `0015`–`0022` (additive only: `CREATE TABLE IF NOT
EXISTS` / nullable `ADD COLUMN`), mirrored into `schema.sql` for the test
harness. See §4 for production application status.

**Admin console** (`admin.html`) — a new "Ministry" nav group: Churches
(add/edit/archive), Promises (add/delete, scope-aware form), Testimonies
(moderation queue: publish/reject/delete), Prayer requests (status inbox:
new→praying→contacted→closed), Contact messages (status inbox:
new→acknowledged→replied→closed), Programs (add/delete), Blog (add/publish/
unpublish/delete). Plus a Watch & Listen card in Settings for the three media
URLs.

**Public site** (`v2/*.html`) — six new pages, all real-data:
`prayer.html`, `contact.html`, `testimonies.html`, `programs.html`,
`blog.html`, `about.html` (About + Our Churches), `watch.html`. Home
(`v2/index.html`)'s promise card now calls `/api/promises?when=today` first,
falling back to the previous curated verse set only if nothing's published
yet; added a real "latest testimony" teaser (hidden until a testimony is
actually published). Nav updated across all `/v2/*.html` pages to link to the
new sections instead of `#` placeholders.

**i18n scaffold** (`v2/i18n.js`) — a small client-side EN/Tamil dictionary +
`localStorage` toggle, wired via `data-i18n` attributes into every v2 page's
nav/CTAs, using the design system's previously-unused `.lang-toggle` CSS.
Bilingual API rows render via `LJM_I18N.bi(row, 'field')`. This is the
**architecture + core navigation**, not full content translation — Tamil
translation of admin-authored paragraphs is an ongoing content task for the
pastor/team via the admin console's `*Ta` fields, not a code task.

## 2. What is explicitly NOT done yet

- **Youth Ministry hub, Live Podcast page** (Phase 5's media hub beyond the
  Watch & Listen page) — `blog.js`'s `ministryArea='youth'` and `programs.js`
  same field exist and work, but there's no dedicated `/v2/youth.html`
  landing page yet.
- **Full Tamil content** — the dictionary + toggle work; actual `*_ta`
  content for promises/testimonies/blog/programs/churches is empty until an
  admin fills it in.
- **Browser/Playwright E2E suite** — not added this session (P6 in the
  overnight brief, below shipping the features themselves). Verified instead
  via: 361/361 `npm test` (real handler code against the real `schema.sql`
  via the `node:sqlite` mock-D1 harness), a real `wrangler pages dev` run
  confirming every new `/v2/*.html` page serves real 200 HTML through the
  actual Cloudflare Pages Functions routing, and a JS-syntax check of every
  new `<script>` block.
- **Cutover (Phase 7)** — the beta-flow's `new_home_enabled`-style flag flip
  was never in scope for the new pages (they're directly reachable, not
  flag-gated) — no cutover needed for them specifically.

## 3. Payment-path guarantee

Every file in the frozen list (`webhook.js`, `verify.js`, `contributions.js`,
`purchases.js`, `razorpay-checkout.js`, `_lib.js`, `auth.js`, `roles.js`) is
byte-for-byte unchanged from `origin/main` — verified via `git diff --stat`
before every commit in this session.

## 4. Migration production status

Migrations `0015`–`0022` are additive-only and covered by
`tests/regression/schema-contract.test.mjs`. Per the milestone brief's
explicit authorization ("safe V2 additive migrations, production
application is allowed... if the repository workflow supports it and the
migration has been thoroughly validated"), they were dispatched to the real
production D1 (`ljm-contributions-db`) via the existing
`.github/workflows/apply-d1-migration.yml` `workflow_dispatch` — the same
gated mechanism the repo already uses for every migration — run against this
branch's ref. See the session's final report for the actual run outcomes.

**Code deploy to `main` was deliberately NOT performed** — that requires a
push to `main` (which auto-deploys via `deploy.yml`), a materially different
and higher-blast-radius action than a single additive `workflow_dispatch`
migration run, and the owner was asleep with no way to confirm in real time.
The branch is fully tested and ready; merging/pushing `main` is the explicit
next manual step (see the session report's "Recommended next step").
