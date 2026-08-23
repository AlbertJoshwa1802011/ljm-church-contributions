# 13 · Reviewer login: `albertjoshrock101@gmail.com`

| | |
|---|---|
| **Purpose** | Let the milestone owner (`albertjoshrock101@gmail.com`) sign in conveniently and review the V2 flow as a real user, without weakening auth. |
| **Code changes required** | **None.** Investigation (below) found the requested identity is already fully wired through existing, tested, real-Google-auth-gated mechanisms — nothing to add or modify. |

## What was investigated

1. **Google sign-in / token verification** (`functions/api/_lib.js`
   `verifyGoogleToken`, reused by `auth.js`, `beta-activate.js`, `requireAuth`) —
   unchanged, still requires a real Google ID token verified against Google's
   `tokeninfo` endpoint (and `aud` match when `GOOGLE_CLIENT_ID` is set). There is
   no email-string bypass in production (`ALLOW_LEGACY_EMAIL_TOKEN` is an
   explicit opt-in env var, unset in production).
2. **Admin/role model** — `HARDCODED_SUPER_ADMINS` in `_lib.js` already includes
   `albertjoshrock101@gmail.com`. On real Google sign-in, `getPermissions()`
   grants that email the wildcard `*` scope — this predates this task and was
   not changed by it.
3. **V2 routing** — `functions/_middleware.js` only intercepts five root-style
   paths (`/`, `/index.html`, `/our-giving.html`, `/events.html`,
   `/give-flow.html`, `/my-giving.html`) and routes them to `/v2/*.html`
   **only** when the request carries a valid, unexpired signed `ljm_beta`
   cookie. Every other `/v2/*.html` page (home ministry pages: prayer,
   contact, testimonies, programs, blog, about, watch) is directly reachable
   with no cookie at all.
4. **The beta allowlist already contains this exact email.**
   `migrations/0013_beta_access.sql` (mirrored in `schema.sql`) seeds:
   ```sql
   INSERT OR IGNORE INTO beta_testers (email, added_by, note)
   VALUES ('albertjoshrock101@gmail.com', 'migration-0013', 'Initial requester, seeded at rollout');
   ```
   This is asserted by existing regression tests
   (`tests/api/beta-testers.test.mjs`: *"GET with admin auth lists the
   migration-seeded tester"*) and was already on `main` before this task
   started — not added by it.
5. **`beta-login.html`** — the existing, standalone "Preview the new site"
   page. Real Google Sign-In (GIS) button → POSTs the real ID token to
   `/api/beta-activate` → `verifyGoogleToken` (real Google verification) →
   looks the verified email up in `beta_testers` → on match, mints a signed
   `ljm_beta` HttpOnly cookie → redirects to `/`. No shortcut, no fabricated
   token, no fake session — the same real Google OAuth handshake as every
   other sign-in path in this app.

## Net result

`albertjoshrock101@gmail.com` was **already**, before this task, both:
- a real, admin-permissioned account (`HARDCODED_SUPER_ADMINS`), and
- pre-seeded into the `beta_testers` allowlist that unlocks the convenient
  root-domain (`/`) V2 experience,

with both facts already covered by the existing, currently-green test suite.
This is exactly the safe outcome the task asked for (Phase 3 "Option D": if
production auth already supports the email, don't add a bypass — just
confirm the data model already reflects it) — confirmed, not implemented.

## Manual verification steps for the reviewer

1. Open the deployed site's `/beta-login.html` in a browser (not linked from
   the public site by design — go there directly).
2. Click **Sign in with Google** and choose the `albertjoshrock101@gmail.com`
   Google account. This is a real Google OAuth prompt — there is no way to
   "select" this identity without actually owning and authenticating with
   that Google account.
3. On success you're redirected to `/`, which now serves the V2 Home page
   (the signed `ljm_beta` cookie is set for this browser only, 24h expiry).
4. From there, use the same "Sign in with Google" control inside the V2 UI
   (`/v2/auth.js`, calls the real, unchanged `/api/auth`) to establish your
   in-app identity — same Google account, same real handshake. Because the
   email is a hardcoded super admin, the app recognizes you as an admin and
   the admin console (`/admin.html`) remains reachable as always.
5. If, for any reason, the production D1 database does not yet have the
   migration-0013 seed row applied (code and data deploy on different gated
   paths — see `CONTRIBUTING.md` §4), `albertjoshrock101@gmail.com` can
   self-add via `/admin.html` → **Beta Access** panel, since that account
   already has `manage_roles` permission independent of the beta allowlist.
   No one else can do this — the panel itself is `requireAuth(..., "manage_roles")`-gated.

**Nothing here can be triggered by a browser simply "claiming" this email.**
Every step requires a real Google ID token that Google itself issued for
that exact account.
