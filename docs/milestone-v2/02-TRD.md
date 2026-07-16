# 02 · Technical Requirements Document (TRD)

| | |
|---|---|
| **Product** | Light of Jesus Ministry — Worldwide Ministry App |
| **Milestone** | v2 — "Worldwide Ministry App" |
| **Document** | 2 of 6 (TRD) |
| **Version** | 1.0 (Draft) |
| **Date** | 2026-07-16 |
| **Status** | Draft — awaiting approval |
| **Source of truth** | [`01-PRD.md`](./01-PRD.md) |
| **Next document** | [`03-app-flow.md`](./03-app-flow.md) — App Flow |

> **Purpose.** This document decides the **tech stack, tools, and APIs** for the
> milestone, and — most importantly — the **guarantees that protect our live,
> real-time contribution data** so none of the new work can break what already
> works.

---

## 1. Guiding principle: extend, never endanger

We have **real production contribution data** flowing through the app right now
(Razorpay payments → D1 → Google Sheets). The #1 technical requirement of this
milestone is: **the existing giving engine and its data are untouchable.** Every
decision below is made to add the new ministry experience *around* the current
system without altering the money path or the data it has already recorded.

---

## 2. Current stack (as-is review)

| Layer | Today | Verdict |
|---|---|---|
| **Frontend** | Multi-page static site, plain HTML/CSS/vanilla JS, **no build step**, shared `*.js`/`*.css` at root (`header.js`, `theme.js`, `script.js`, …) | **Keep.** No-build model is a hard repo constraint and the safest way to preserve existing pages. |
| **Backend** | Cloudflare **Pages Functions**, one file per route under `functions/api/*.js`; shared helpers in `_lib.js` | **Keep & extend.** New features = new route files; existing routes unchanged. |
| **Database** | Cloudflare **D1** (SQLite), binding `DB` → `ljm-contributions-db`; base `schema.sql` + numbered `migrations/00xx_*.sql` | **Keep.** Add new tables via new migrations only. |
| **Payments** | **Razorpay** checkout (`razorpay-checkout.js`) → `functions/api/webhook.js`, HMAC-verified, idempotent via `contributions.proof_id UNIQUE`, then async Google Sheets sync | **Keep, frozen.** No behavioral change this milestone (see §4). |
| **Auth** | Google Identity Services (client) → server-verified via Google `tokeninfo` in `_lib.js`; roles/permissions from `member_roles`→`roles`; 3 hardcoded super-admins; machine `ADMIN_API_TOKEN` | **Keep & reuse** for all new admin/content endpoints. |
| **Media storage** | **R2** bucket `EVENT_PHOTOS` bound (falls back to base64 in D1) | **Keep & reuse** for testimonies/blog/event media. |
| **Deploy** | GitHub Actions → Cloudflare Pages on **push to `main`** (`deploy.yml`); migrations applied **manually** via `workflow_dispatch` (`deploy-migrations.yml` / `apply-d1-migration.yml`) | **Keep.** Note the auto-deploy risk — handled in §5. |
| **Tests** | `npm test` = `node --test` + Node `node:sqlite` mock-D1; `tests/api/*` hit handlers, `tests/frontend/*` parse source | **Keep & grow.** New endpoints get tests; giving path gets a regression guard. |

**Conclusion — recommended stack for this milestone: keep the current stack and
extend it.** It already gives us a **global edge deploy (Cloudflare = worldwide
availability, exactly the PRD's goal)**, near-zero ops cost, no vendor lock-in
churn, and a working, battle-tested giving engine. Rebuilding or introducing a
framework/build step would put the live money path and existing pages at risk for
no proportional benefit. We add only what the new features genuinely require
(email, streaming embeds, i18n, a few new tables).

---

## 3. New capabilities to introduce (and the tool chosen)

| Need (from PRD) | Decision | Why |
|---|---|---|
| **Transactional email** — `noreply` acknowledgement to enquirers + internal team notification (Contact & Prayer) | **Resend** (HTTP API called from Pages Functions via `fetch`) | Works from the Workers runtime with a plain HTTPS call (no SMTP), simple domain verification, free tier fits volume. *Alternatives: Brevo/Postmark/SendGrid — all HTTP-API and acceptable.* **Open decision to confirm with owner.** |
| **Team notification** of new prayer/contact requests | Same email service → a **team distribution email**; every request is also **persisted in D1** so nothing depends on email delivery | Durable record first, notification second — a failed email never loses a request. |
| **Live worship + podcast archive** — Sunday live prayer, daily morning prayer | **Embedded YouTube Live + a YouTube playlist** for the archive; the live/stream URLs stored in `config` and editable from admin | LJM already has a YouTube presence; zero hosting cost, global CDN, handles live + VOD. *Open: confirm channel; podcast RSS optional later.* |
| **English + Tamil** content | **Bilingual DB columns** (`*_en` / `*_ta`) for admin-authored content + a small **client-side i18n dictionary** (JSON) for static UI labels; language toggle stored in `localStorage`/member prefs | Fits the no-build model; app already ships English (KJV) + Tamil (TOV) Bible data, proving the bilingual pattern. |
| **Two-church segregation** | A new **`churches`** table + a nullable **`church_id`** on church-scoped content tables; ministry-wide content leaves `church_id` null | Additive, backward-compatible; supports adding campuses later. |

---

## 4. The giving path is FROZEN (data-safety guarantee)

These files/behaviors **do not change** in this milestone. Any redesigned giving UI
must call the **same endpoints with the same request/response shapes**:

- `functions/api/webhook.js` — Razorpay `payment.captured` handler. **No changes** to
  signature verification, the `proof_id` idempotency check/insert, member upsert, or
  the Google Sheets `waitUntil` sync.
- `contributions` table schema (`id, member_name, amount, date, category, notes,
  proof_id UNIQUE, email, phone, fund, created_at`) — **no column added, renamed, or
  dropped**; `proof_id UNIQUE` (the idempotency guarantee) is preserved exactly.
- `functions/api/contributions.js` (read model + edge cache), `razorpay-checkout.js`,
  and the `funds`/`purchases`/`expenses`/subscriptions/`families` tables & routes —
  **response contracts preserved**; the new front-end consumes them read-only /
  unchanged.
- Environment secrets stay as-is: `GOOGLE_CLIENT_ID`, `RAZORPAY_WEBHOOK_SECRET`,
  `GOOGLE_SHEETS_WEBAPP_URL`, `ADMIN_API_TOKEN`, `ALLOW_LEGACY_EMAIL_TOKEN`.

**Regression guard:** add a test asserting the webhook still inserts once per
`proof_id` and rejects bad signatures, so future changes can't silently regress it.

---

## 5. Continuity & rollout strategy (because deploy is auto on `main`)

Pushing to `main` deploys to production immediately, so the new experience must
never ship half-built over the working site. Rules:

1. **Additive-only database.** New features get **new tables via new migrations
   (`0012+`)** written with `CREATE TABLE IF NOT EXISTS` / additive `ALTER … ADD
   COLUMN` (nullable, defaulted). **Never** `DROP`/rename/alter existing columns.
   Migrations remain **manual & gated** (`workflow_dispatch`), forward-only, and are
   dry-run against a copy before remote apply. A pre-change backup is taken (the repo
   already keeps `backup-*.sql`).
2. **Feature-flag the new experience.** Reuse the existing `config`/`settings.js` flag
   mechanism (same pattern as `force_login`) — e.g. `new_home_enabled` — so the new
   home/flow can be built and merged **dark**, then switched on when ready. Existing
   pages (`index.html`, `admin.html`, …) keep serving until the flip.
3. **New routes, not rewrites.** New UI ships as **new pages/components and new
   `functions/api/*` files**. Existing endpoints keep their exact contracts so the
   current front-end never breaks mid-migration.
4. **Tests stay green.** `npm test` must pass on every push (enforced by `test.yml`);
   new endpoints add `tests/api/*` tests using the existing `mock-d1` harness; new
   `script.js` function calls follow the repo's "grep-the-definition + per-call
   try/catch" rule from `CLAUDE.md`.
5. **Rollback plan.** UI issues → flip the feature flag off (data untouched). Code
   issues → revert the commit and let Pages redeploy. Because new tables are isolated,
   backing a feature out never touches contribution data.

---

## 6. New API endpoints (all follow existing `_lib.js` auth + `audit()` patterns)

Public GET (published content only) + admin-gated mutations via `requireAuth(context,
'<permission>')`, mirroring `funds.js`/`events.js`:

| Route (new file) | Purpose | Admin permission |
|---|---|---|
| `functions/api/promises.js` | Daily/monthly/yearly promise schedule; public "today" resolver | `manage_content` |
| `functions/api/testimonies.js` | List published; public submit; admin moderate/publish | `manage_content` |
| `functions/api/prayer.js` | Public submit prayer request; admin list/track status; triggers email + team notify | `manage_content` |
| `functions/api/contact.js` | Public submit; sends `noreply` ack + team notify; admin inbox | `manage_content` |
| `functions/api/blog.js` | Public list/detail; admin CRUD | `manage_content` |
| `functions/api/programs.js` | Service times / recurring programs, per church | `manage_content` |
| `functions/api/churches.js` | Church directory (Church of Light, City Worship Center) | `manage_funds` (config-level) |
| *(extend)* `functions/api/events.js` | Complete the events module; add `church_id` scoping | `manage_events` |
| *(extend)* `functions/api/settings.js` | Add feature flags + livestream/podcast URLs | `manage_funds` |

New tables sketched here for the TRD only; the **authoritative** schema (columns,
relationships, indexes) is defined in [`05-backend-schema.md`](./05-backend-schema.md):
`churches`, `promises`, `testimonies`, `prayer_requests`, `contact_messages`,
`blog_posts`, `programs` — each bilingual (`*_en`/`*_ta`) and church-scoped
(`church_id` nullable) where relevant.

---

## 7. Non-functional requirements

- **Worldwide performance:** serve from Cloudflare's edge; keep edge caching for
  public read endpoints (as `contributions.js` already does); lazy-load media.
- **Security/privacy:** reuse Google-verified auth for all admin/content writes; keep
  the `ADMIN_API_TOKEN` machine path; prayer/contact submissions store minimal PII and
  are visible only to permitted admins; audit every mutation via `audit()`.
- **Accessibility & responsiveness:** mobile-first; retain the light/dark token system
  (`theme.css`) — the UI/UX spec (doc 4) details this.
- **Cost:** stay within Cloudflare Pages/D1/R2 + email free tiers; no new paid infra
  required for this milestone.
- **Compatibility:** no build step, no framework, Node ≥22 for tests only.

---

## 8. Resolutions to the PRD's open questions

| PRD open question | TRD resolution |
|---|---|
| Email/notifications mechanism | **Resend HTTP API** from Pages Functions; team notified via distribution email; request persisted in D1 first (owner to confirm provider). |
| Livestream/podcast host | **YouTube Live embed + playlist archive**; URLs in `config`, admin-editable. |
| Promise rotation rules | Promises **pre-assigned per date**; monthly/yearly by current month/year; **fallback** to a default when a day is unassigned; "today" resolved in a fixed ministry timezone (**IST**, confirm). |
| Testimony/prayer moderation | Submissions land **unpublished**; admin approves before public display; prayer/contact are never public. |
| Multi-currency staging | Giving UI abstracts the gateway so **Razorpay stays default now**; an international gateway (Stripe/PayPal) can be added as a sibling later without touching `contributions`/`webhook.js`. |
| Per-church data model | `churches` table + nullable `church_id` FK on church-scoped tables; null = ministry-wide. |
| Language handling | Bilingual DB columns for content + client-side i18n dictionary for UI labels. |

---

## 9. Next steps — document chain

TRD complete. Proceed to **[`03-app-flow.md`](./03-app-flow.md)** — map every screen
and the navigation between them, consistent with this stack and the frozen giving
path. **No implementation until all six documents are approved.** See
[`README.md`](./README.md) for the live tracker.
