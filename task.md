# Next-Gen Upgrade Tasks

- [x] Database Setup
    - [x] Create `schema.sql` database schema for Cloudflare D1
    - [x] Add instructions for database creation and D1 bindings
- [x] Backend Cloudflare Workers API
    - [x] Create `/functions/api/contributions.js` endpoint
    - [x] Create `/functions/api/webhook.js` Razorpay receiver with sync to Google Sheets
    - [x] Create `/functions/api/auth.js` Google Token verification API
- [ ] Frontend Mobile UI/UX & Google Sign-In
    - [ ] Redesign page navigation with bottom tabs for mobile-first feel
    - [ ] Integrate Google Sign-in button SDK
    - [ ] Connect `script.js` to `/functions` API endpoints
- [ ] Verification and Deployment
    - [ ] Verify D1 migrations locally with Wrangler pages dev
    - [ ] Update CI/CD configurations
