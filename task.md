# Next-Gen Upgrade Tasks

- [x] Database Setup
    - [x] Create `schema.sql` database schema for Cloudflare D1
    - [x] Add instructions for database creation and D1 bindings
- [x] Backend Cloudflare Workers API
    - [x] Create `/functions/api/contributions.js` endpoint
    - [x] Create `/functions/api/webhook.js` Razorpay receiver with sync to Google Sheets
    - [x] Create `/functions/api/auth.js` Google Token verification API
- [x] Super Admin Role Configuration
    - [x] Add `roles` and `member_roles` tables to `schema.sql`
    - [x] Create `/functions/api/roles.js` CRUD endpoint for role mapping
    - [x] Update backend APIs to verify permissions dynamically from SQL tables
    - [x] Add Roles configuration dashboard in `admin.html`
- [x] Google-Level UI/UX Redesign
    - [x] Apply premium Material Design stylesheet additions to `style.css`
    - [x] Build responsive bottom navigation bar and float action tabs
    - [x] Implement wishlist card grid on home page
    - [x] Design slide-up modal sheets for contributor detail popups
- [x] Verification and Deployment
    - [x] Verify D1 migrations locally with Wrangler pages dev
    - [x] Link DB binding `DB` in Cloudflare Pages settings
    - [x] Execute remote schema.sql migration on live D1
    - [x] Trigger `/api/migrate` to transfer all historical logs (196 contributions, 33 members, 5 purchases)

# Dynamic Funds, Audit Logs & Admin Revamp

- [x] Database
    - [x] `migrations/0002_dynamic_funds_audit.sql` — funds, fund_members, activity_logs tables + member profile columns + indexes + seeds
    - [x] Apply migration locally and verify
    - [ ] Apply migration on remote D1 (`npx wrangler d1 execute ljm-contributions-db --remote --file=./migrations/0002_dynamic_funds_audit.sql`)
    - [ ] Prod data cleanup: backup, dedupe NULL-proof_id duplicate contributions, backfill first_join_date
- [x] Backend
    - [x] `functions/api/_lib.js` — shared Google ID-token auth + permission lookup + audit helper
    - [x] `functions/api/funds.js` — funds CRUD (admin create/update, super-admin delete, member assignment, members-only visibility)
    - [x] `functions/api/logs.js` — view-event ingestion (beacon) + audit-log viewer API
    - [x] `functions/api/members.js` — fast member directory with computed stats
    - [x] `functions/api/settings.js` — force_login flag + goal editing
    - [x] `functions/api/selftest.js` — production-safe end-to-end test suite (17 cases, auto-cleanup)
    - [x] Audit logging wired into purchases/wishlist/roles mutations
    - [x] contributions.js: spent uses fund_contribution; goal read from funds table
- [x] Frontend
    - [x] `admin.html` complete revamp — Claude-style light theme, sidebar, 10 sections, Google Sign-In gate, Bearer-token API calls (fixes empty admin dashboard bug)
    - [x] `portal-telemetry.js` — view beacons on all public pages + phased forced-login overlay
    - [x] `funds.html` — dynamic fund cards from /api/funds
    - [x] `script.js` — any fund slug renders through the standard dashboard via /api/funds?slug=
- [ ] After deploy
    - [ ] Run admin → Self-Test in production (expect 27/27)
    - [ ] Verify /admin KPIs, members, charts populate
    - [ ] Create a real fund, assign members, verify audit log entries

# Post-Migration Safety Check (see POST_MIGRATION_SAFETY_REPORT.md)

- [x] `functions/api/verify.js` — read-only data-integrity audit + live reconciliation against Google Sheets (`GET /api/verify`)
- [x] Self-test expanded 17 → 27 cases (fail-closed auth, webhook, migrate, roles validation, integrity verify)
- [x] Fail-closed fixes: migrate secret required, webhook duplicate-race 200, roles permission whitelist, super_admin lock, legacy email token disabled (re-enable via ALLOW_LEGACY_EMAIL_TOKEN=true), members-only funds visible to machine admin token
- [ ] After deploy: run `GET /api/verify` in production and resolve any fail/warn items
- [ ] Set `MIGRATION_SECRET` in Cloudflare Pages env (or leave unset — endpoint now stays disabled without it)
- [ ] Dedupe NULL-proof_id duplicate contributions surfaced by /api/verify; backfill first_join_date

# Portal Redesign & New Features (branch: claude/post-migration-safety-check)

## Done & verified
- [x] Dark/light theme (`theme.css`/`theme.js`) auto-following system, toggle in header, all public pages
- [x] Dark-mode legibility pass across every page + modals; admin mobile nav fixed; about-page bottom nav restored
- [x] Rebrand → "Light of Jesus Ministry" (titles, header, footers)
- [x] New shared header (`header.js`) — logo mark, serif wordmark, nav, fund switcher (scales to any funds, mobile dropdown), theme toggle; preserves Google sign-in hooks
- [x] Dashboard reorg: Recent Activity feed, A–Z contributors directory, dedicated enhanced-stats container
- [x] Verse of the Month / Year cards (dashboard + admin editor; `/api/settings` batch)
- [x] Church expenses + planning: `expenses` table (0003), `/api/expenses` CRUD, `manage_expenses` perm, admin ledger, public impact-page section; self-test 29/29

## Remaining roadmap (in order)
- [ ] Phase 2 — Welcome/login page: "Welcome to Light of Jesus Ministry", Google sign-in + "Continue as guest"; unify auth across pages; user→believer mapping on first sign-in; editable email in user settings
- [ ] Phase 3 — Subscriptions (monthly membership dues): pastor sets single amount; add believers + contacts; mark paid; "who paid / who's pending this month"; member's personal Subscriptions status + greeting on dashboard
- [ ] Phase 4 — Email reminders: template editor + reminder composer in admin; send via existing Apps Script (receipt mailer already exists there)
- [ ] Richer stats + landscape dashboard layout (desktop), reframed mobile

## Deploy notes
- [ ] Apply migrations on remote D1: `0002_dynamic_funds_audit.sql`, `0003_expenses.sql`
- [ ] Production admins sign in with Google (verified) — no env flag needed. `ALLOW_LEGACY_EMAIL_TOKEN` is only for the local dev-login button.

# Admin Console Redesign, Families, and Bible Verses (branch: claude/church-admin-console-redesign-oiopko)

## Done
- [x] Design system: reworked dark palette (warm near-black elevation scale instead of pure black, desaturated accent, new `--info` token), purged the legacy purple/indigo gradient from every file that still had it, extended real dark-mode support to `admin.html` (previously permanently light, forked its own tokens)
- [x] Admin console nav: replaced the flat 13-item list (duplicated into a sidebar + a horizontally-scrolling mobile strip) with a grouped, two-level model (Overview/Giving/People/Content/Admin) — accordion sidebar on desktop, 5 group buttons + slide-up sheet on mobile
- [x] Sticky section headers (`.page-head` in admin, `.dashboard-tabs` on the public dashboard) instead of scrolling out of view; unified the public header's conflicting 768px/820px mobile breakpoints into one
- [x] Pastor contact: added an email field end-to-end, made phone/email tappable `tel:`/`mailto:` links, fixed the mobile top bar + "More" sheet so signed-in mobile users can actually reach pastor contact info (previously hidden below 580px with no fallback)
- [x] Rewrote `payment-modal.css` (previously a standalone hardcoded-light Material purple/pink stylesheet) to use the shared design tokens, fixing dark-mode contrast on the contribution modal
- [x] `purchases` table gains `created_by` — purchase records are now attributed to the admin who added them, shown in the admin table (`migrations/0005_purchase_attribution.sql`)
- [x] Families/households: new `families` table + `family_id`/`relation`/`date_of_birth` on `members` (`migrations/0006_families.sql`); `functions/api/families.js`; admin "Families" tab (People group) — non-destructive to existing individual member/contribution/Subscriptions history
- [x] Subscriptions reworked to per-family billing (paid once by the family head, not once per member) once a member is grouped into a family; members not yet grouped keep working exactly as before (`migrations/0007_sandha_family.sql`, rewritten `functions/api/subscriptions.js`, admin Subscriptions tab + public `subscriptions.html` both show family and individual status)
- [x] Wishlist admin section relocated (Content group) and restyled as priority-colored cards
- [x] About page CMS: `about_content` JSON setting + admin editor with dynamic add/remove rows (hero, mission cards, verses, motivation banner + CTAs, connect links); `about.html` now renders from settings instead of static HTML
- [x] Bible verse data dictionary: `bible_versions`/`bible_verses` tables (`migrations/0008_bible_verses.sql`, `migrations/0009_bible_kjv_seed.sql`), `functions/api/bible.js` (browse/search/import), admin Verses tab now searches-and-picks instead of freeform typing; Verse of the Month/Year cards added to `member.html` (previously only on the public dashboard)
- [x] First automated test suite: `node --test` + `node:sqlite` harness (`tests/`) running the real `functions/api/*.js` handlers against an in-memory DB seeded from `schema.sql` — 31 cases across families, subscriptions, settings, bible, purchases, wishlist, roles; CI workflow (`.github/workflows/test.yml`) runs it on every push/PR
- [x] New docs: `README.md` (root — previously missing entirely), `TESTING.md`, `FAMILIES_AND_SANDHA.md`, `BIBLE_VERSES.md`, `THEME_AND_DESIGN_SYSTEM.md`, `ADMIN_CONSOLE_GUIDE.md`

## After deploy
- [ ] Apply migrations on remote D1 in order: `0005_purchase_attribution.sql`, `0006_families.sql`, `0007_sandha_family.sql`, `0008_bible_verses.sql`, `0009_bible_kjv_seed.sql`
- [ ] Run admin → Self-Test in production
- [ ] Group existing members into families via the new Families tab at the church's own pace (nothing breaks for members left ungrouped)
- [ ] Decide on completing the Bible verse data (full KJV and/or Tamil O.V.) via `POST /api/bible {action:"import"}` — see BIBLE_VERSES.md
- [ ] Review the About page editor once live and adjust copy as needed — it currently mirrors the original hardcoded About page exactly
