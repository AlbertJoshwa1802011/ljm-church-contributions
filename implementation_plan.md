# Next-Gen Upgrade: Cloudflare D1 Database, Mobile-First UI/UX & Google Sign-In

This plan outlines a major architectural migration to upgrade the tech stack from Google Apps Script to a native Cloudflare infrastructure (Cloudflare D1 SQL Database & Workers Functions) for maximum speed and scalability, alongside a premium Mobile-First UI/UX redesign and seamless Google Sign-In integration.

## User Review Required

> [!IMPORTANT]
> **Cloudflare D1 SQL Setup**: You will need to create a Cloudflare D1 Database in your Cloudflare dashboard (it takes 1 click) and bind it to your Pages project. We will provide the exact `schema.sql` file and CLI commands to run.
> 
> **Google Developer Console Credentials**: To enable Google Sign-In, you will need to create a Client ID in the Google Cloud Console and add your Cloudflare domain as an authorized JavaScript origin.

## Open Questions

> [!NOTE]
> **1. Real-Time Google Sheet Sync (Recommended)**: Should we configure the new Cloudflare Worker to automatically stream new contributions back to your existing Google Sheet? 
> * **Pros**: You retain your Google Sheet as a live human-readable backup, but your website loads instantly from the Cloudflare SQL database.
> 
> **2. Authentication Policy**: Google Sign-In will be completely optional (non-intrusive). If logged in, users can view their personalized contribution history and profile instantly. Do we want to auto-link contributions based on their Google account email address?

## Proposed Changes

We will restructure the application by creating a `/functions` backend directory (running natively on Cloudflare Pages Workers) and refactoring the frontend to use the new endpoints.

---

### Database Layer (Cloudflare D1 SQL)

#### [NEW] [schema.sql](file:///Users/albert-18677/Documents/church-contributions/schema.sql)
Creates the relational tables for robust transactional capabilities:
* `members`: Stores member records, emails (for Google Sign-In mapping), and verification statuses.
* `contributions`: Stores transaction details, payment methods, timestamps, and Razorpay IDs.
* `purchases`: Stores item descriptions, funds utilized, amounts, and dates (replacing the "What We Bought" spreadsheet logic).
* `config`: Stores target goals dynamically.

---

### Backend API (Cloudflare Pages Functions)

#### [NEW] [/functions/api/contributions.js](file:///Users/albert-18677/Documents/church-contributions/functions/api/contributions.js)
Serves fast JSON payloads for the dashboard (contributions, goals, spent aggregates).

#### [NEW] [/functions/api/webhook.js](file:///Users/albert-18677/Documents/church-contributions/functions/api/webhook.js)
Listens to Razorpay payment captured events, performs verification, and commits them to D1 database.

#### [NEW] [/functions/api/auth.js](file:///Users/albert-18677/Documents/church-contributions/functions/api/auth.js)
Validates Google Identity Services JWT tokens on the server side to verify logged-in users.

---

### Frontend Layer (Stunning Mobile-First UI/UX)

#### [MODIFY] [index.html](file:///Users/albert-18677/Documents/church-contributions/index.html)
* Upgrade typography to Inter/Outfit fonts.
* Add native bottom navigation bar for mobile app feel.
* Add Google Sign-in one-tap container.
* Revamp card layouts with modern glassmorphism styles.

#### [MODIFY] [script.js](file:///Users/albert-18677/Documents/church-contributions/script.js)
* Refactor fetch methods to connect to `/api/contributions` rather than Google Apps Script.
* Implement Google Sign-In button render and credentials handler.
* Add smooth swipe animations and improved touch targets.

## Verification Plan

### Automated Tests
* We will use `wrangler dev` to spin up a local emulation of the Cloudflare Pages backend with D1 SQL locally:
  ```bash
  npx wrangler pages dev . --d1=DATABASE_BINDING_NAME
  ```

### Manual Verification
* Test checkout flows using Razorpay sandbox.
* Test Google Sign-in popup on mobile and desktop browsers.
