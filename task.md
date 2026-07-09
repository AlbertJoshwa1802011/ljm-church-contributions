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
- [ ] Phase 3 — Sandha (monthly membership dues): pastor sets single amount; add believers + contacts; mark paid; "who paid / who's pending this month"; member's personal Sandha status + greeting on dashboard
- [ ] Phase 4 — Email reminders: template editor + reminder composer in admin; send via existing Apps Script (receipt mailer already exists there)
- [ ] Richer stats + landscape dashboard layout (desktop), reframed mobile

## Deploy notes
- [ ] Apply migrations on remote D1: `0002_dynamic_funds_audit.sql`, `0003_expenses.sql`
- [ ] Production admins sign in with Google (verified) — no env flag needed. `ALLOW_LEGACY_EMAIL_TOKEN` is only for the local dev-login button.
