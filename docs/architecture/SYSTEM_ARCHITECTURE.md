# System Architecture

Status: describes the system as it exists today (verified against source, not
aspirational) plus the target shape for known gaps. Where the target isn't
decided, it's marked `DECISION REQUIRED`.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Static HTML/CSS/vanilla JS, no build step, no framework, no bundler | `index.html`, `admin.html`, `members.html`, `funds.html`, `impact.html`, `subscriptions.html`, `about.html`, `member.html`, `events.html` at repo root; a parallel `v2/` tree for the beta redesign |
| Backend | Cloudflare Pages Functions | One file per route under `functions/api/*.js`; filename + exported `onRequestGet`/`onRequestPost`/`onRequestPut`/`onRequestDelete` convention. No router, no framework — Cloudflare's file-based routing is the only routing layer. |
| Database | Cloudflare D1 (SQLite) | Single database, binding `DB`. Baseline in `schema.sql`, incremental changes in `migrations/000N_*.sql`. No multi-tenant scoping (see [`CHURCH_ARCHITECTURE.md`](./CHURCH_ARCHITECTURE.md)). |
| Object storage | Cloudflare R2 | Binding `EVENT_PHOTOS`, used only by `functions/api/events.js` for event photo galleries. Falls back to storing base64 data URLs directly in D1 if unbound. |
| Payments | Razorpay Checkout (client) + webhook (server) | See [`PAYMENT_ARCHITECTURE.md`](./PAYMENT_ARCHITECTURE.md). Single global Razorpay account/key today. |
| Auth | Google Identity Services (client) + Google `tokeninfo` verification (server) | See [`PERMISSION_ARCHITECTURE.md`](./PERMISSION_ARCHITECTURE.md). |
| Deploy | GitHub Actions → Cloudflare Pages | `.github/workflows/deploy.yml`, on every push to `main`. `deploy` job has `needs: test` — a red suite cannot reach production. |
| Migrations | Manual `workflow_dispatch` | `.github/workflows/deploy-migrations.yml` / `apply-d1-migration.yml` run `wrangler d1 execute --remote` against production D1. No automated review — see [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md). |
| Tests | Node's built-in `node --test` + `node:sqlite` | No external test framework/dependencies. `tests/api/*` exercise real handler code against an in-memory SQLite standing in for D1; `tests/frontend/*` statically parse `script.js`/`index.html`. |

There is deliberately no compiler, type checker, or linter in this stack —
`node --test` is the only safety net. This is why `CONTRIBUTING.md`'s
"tests are mandatory" rule is non-negotiable rather than a style preference.

## Request lifecycle

1. Browser requests a static asset or `/api/*` route from Cloudflare Pages.
2. `functions/_middleware.js` runs first on **every** request. Today its only
   job is the beta-flow routing shim (see "The v2 beta flow" below); it does
   **not** perform authentication — every `functions/api/*.js` file gates
   itself independently.
3. Static HTML/CSS/JS is served as-is (no server-side templating).
4. `/api/*` requests hit their matching file in `functions/api/`. Each file:
   - Resolves identity via `_lib.js#resolveViewer` (member self-service, no
     permission required) or `_lib.js#requireAuth` (permission-gated).
   - Reads/writes D1 via parameterized `db.prepare(...).bind(...)` calls
     (no raw string interpolation into SQL anywhere in the codebase).
   - Optionally writes an `activity_logs` row via `_lib.js#audit()`
     (fire-and-forget — an audit failure never blocks the real operation).
5. Payment completion is **not** part of this request/response cycle — see
   [`PAYMENT_ARCHITECTURE.md`](./PAYMENT_ARCHITECTURE.md); it's an
   out-of-band webhook delivered by Razorpay's servers, not the browser.

## Shared backend infrastructure (`functions/api/_lib.js`)

Underscore-prefixed files are not routable — they're shared modules imported
by the real endpoints.

- `verifyGoogleToken()` — verifies a Google ID token by calling Google's
  `tokeninfo` HTTP endpoint (no offline JWK/signature verification).
- `resolveViewer()` — "who is this browser," no permission required. Used by
  member self-service endpoints (`appearance.js`, the members-only fund
  visibility check in `funds.js`).
- `getPermissions()` / `requireAuth()` — the admin/permission-gated pipeline.
  See [`PERMISSION_ARCHITECTURE.md`](./PERMISSION_ARCHITECTURE.md).
- `audit()` — writes to `activity_logs`. See
  [`AUDIT_ARCHITECTURE.md`](./AUDIT_ARCHITECTURE.md) for what is and isn't
  covered.
- `json()` — standard JSON `Response` builder used by nearly every endpoint.

## The v2 beta flow (current rollout mechanism)

This is a **currently-live** routing mechanism, distinct from — and simpler
than — the `new_home_enabled` global feature flag that `docs/milestone-v2/`'s
planning documents (02-TRD, 03-app-flow, 05-backend-schema,
06-implementation-plan, SAFETY-AND-TESTS) describe. That global flag was
**never built**. What actually shipped instead (`docs/milestone-v2/11-v2-flow-implementation.md`,
verified against source) is a per-user allowlist:

1. An admin adds an email to `beta_testers` (Admin console → Admin → Beta
   Access, backed by `functions/api/beta-testers.js`, `manage_roles` scope).
2. That person visits `/beta-login.html` (not linked from the public site —
   shared directly), signs in with Google, and `functions/api/beta-activate.js`
   checks the allowlist and, if present, mints a signed `ljm_beta` HttpOnly
   cookie (`functions/api/_beta.js`, 24h TTL, HMAC-SHA256).
3. `functions/_middleware.js` intercepts exactly 6 paths (`/`, `/index.html`,
   `/our-giving.html`, `/events.html`, `/give-flow.html`, `/my-giving.html`)
   and, only if the `ljm_beta` cookie verifies, rewrites the request to the
   matching file under `/v2/`. Every other path — including `/admin.html` and
   all of `/api/*` — is never touched.
4. The `v2/` pages are a **visual/UX restyle of five existing data surfaces**
   (dashboard, giving stats, events, the give flow, "my giving"). They call
   the exact same `/api/*` endpoints as the old pages and share the same
   sign-in session (`v2/auth.js` reuses `sessionStorage.ljmUserIdToken`
   deliberately, documented inline as "NOT a new auth mechanism").

**Important for anyone building the next milestone-v2 phase**: none of the
new content types the PRD/TRD describe (churches, promises, testimonies,
prayer requests, contact messages, blog posts, programs) exist in `schema.sql`
or `functions/api/` yet. Only the routing/beta-access mechanism and the
five-page restyle have shipped. See
[`architecture/MIGRATION_PLAN.md`](./MIGRATION_PLAN.md) for the full
planned-vs-shipped table.

## Known architectural debt (carried forward, not fixed by this doc)

These are documented here because they affect how future features should be
built — fixing them is out of scope for a documentation-foundation task and
each needs its own reviewed change:

- **`ALLOW_LEGACY_EMAIL_TOKEN: "true"`** is live in `wrangler.jsonc`'s `vars`.
  Any endpoint using `requireAuth` accepts an unverified plain-email string as
  a credential when this is enabled, provided that email also resolves to a
  role. This is a real trust-boundary weakening in the current deployment,
  not just a migration-path relic. See
  [`PERMISSION_ARCHITECTURE.md`](./PERMISSION_ARCHITECTURE.md#known-weakness).
- **Member identity is name-keyed, not ID-keyed**, in several places
  (`contributions.member_name`, joins in `members.js`) — renaming a member
  breaks the historical join. Noted in `POST_MIGRATION_SAFETY_REPORT.md` as a
  known open issue.
- **No foreign-key enforcement** — SQLite's `foreign_keys` pragma isn't
  relied upon anywhere; referential integrity is either enforced procedurally
  in application code or spot-checked after the fact by `functions/api/verify.js`.
- **Two hard-coded "system funds"** (`tech-contributions`, `christmas-fund`)
  are woven through the frontend, the backend, and the payment path far more
  deeply than a cosmetic default — see
  [`FUND_ARCHITECTURE.md`](./FUND_ARCHITECTURE.md).

## What does not exist yet

- No multi-church/branch/tenant concept anywhere in the schema or API layer
  (confirmed by grep — zero `church_id`/`branch_id`/`tenant` references). See
  [`CHURCH_ARCHITECTURE.md`](./CHURCH_ARCHITECTURE.md) — `DECISION REQUIRED`
  on rollout order.
- No application-level multilingual/i18n scaffolding (the only "language"
  concept in the schema is Bible-translation metadata in `bible_versions`).
- No transactional email/notification capability of any kind.
- No prayer request, testimony, or embedded-video (YouTube-player) feature —
  only unwired UI copy in the `v2/` redesign and `mockups/`.
