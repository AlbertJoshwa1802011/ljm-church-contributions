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
    - [ ] Run admin → Self-Test in production (expect 17/17)
    - [ ] Verify /admin KPIs, members, charts populate
    - [ ] Create a real fund, assign members, verify audit log entries
