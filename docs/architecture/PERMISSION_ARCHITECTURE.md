# Permission Architecture

## Model: Role → Permission → enforcement, server-side only

Matches the constitution's requirement directly: authorization is
permission-string-based, not role-name-based, and every check happens in the
API layer — hiding a UI section is not treated as security anywhere in this
codebase (correctly; `admin.html` renders every nav section regardless of the
signed-in user's actual scopes and relies on each API call to reject
unauthorized writes).

### Source of truth

- `roles` table: `role_name PRIMARY KEY`, `permissions` (JSON array of scope
  strings, e.g. `["edit_purchases","manage_funds"]`).
- `member_roles` table: `email PRIMARY KEY` → `role_name` (FK, `ON DELETE
  CASCADE`).
- `functions/api/roles.js`'s `VALID_PERMISSIONS` constant is the **canonical
  enumeration** of every scope the system understands:
  `edit_purchases`, `edit_wishlist`, `manage_roles`, `view_members`,
  `manage_funds`, `delete_funds`, `view_audit`, `manage_expenses`,
  `manage_subscriptions`, `manage_members`, `manage_content`, `manage_events`,
  `edit_contributions`. A `manage_roles` holder cannot grant `"*"` or invent
  a new scope — `save_role` rejects anything outside this list.
- `HARDCODED_SUPER_ADMINS` (`functions/api/_lib.js`) — three literal emails
  that always resolve to `["*"]`, independent of the `roles`/`member_roles`
  tables. This is a deliberate bootstrap safety net (the app can never lock
  itself out even if the roles data is wiped) and is checked *before* any DB
  query — mirrors the constitution's "highest-privilege role must have
  complete administrative access" requirement.
- Built-in `super_admin` role is immutable via the API (`save_role` rejects
  `roleName === 'super_admin'`), and the three hardcoded emails cannot be
  unlinked from it via `roles.js`'s `unlink_email` action.

### Enforcement pipeline

1. `requireAuth(context, permission)` resolves a credential from
   `Authorization: Bearer` header or `?token=` query param.
2. Three credential shapes: an exact match to `env.ADMIN_API_TOKEN` (machine
   token → `["*"]`), a 3-segment JWT-shaped string (verified against
   Google's `tokeninfo` endpoint), or a plain string containing `@` (the
   legacy fallback — see "Known weakness" below).
3. `getPermissions(email, db)` looks up the caller's scopes via
   `HARDCODED_SUPER_ADMINS` → `member_roles` → `roles`.
4. Access rule: `permissions.includes("*")` OR the specific requested
   `permission` is present OR (no specific permission was requested) any
   non-empty permission set passes. That last clause is used by
   `functions/api/search.js`, which calls `requireAuth(context, null)` for
   an outer gate and then checks each result category against its own
   dedicated scope individually — "a caller never sees a result here they
   couldn't already see by opening that section directly."

Every `functions/api/*.js` endpoint that mutates data calls `requireAuth`
with its own specific scope. There is no central authorization middleware —
`functions/_middleware.js` only handles beta-flow routing (see
`SYSTEM_ARCHITECTURE.md`); each endpoint is independently responsible for its
own gate. This means a new endpoint that forgets to call `requireAuth` is
open by default — **every new/changed endpoint's tests must include an
unauthorized-caller-is-rejected case**, per `CONTRIBUTING.md` §2.

## Known weakness

`wrangler.jsonc`'s `vars` sets `ALLOW_LEGACY_EMAIL_TOKEN: "true"` in the
**live deployed configuration**, not just as a documented migration path.
With this enabled, `requireAuth` accepts a bare string containing `@` as a
credential — unverified, no cryptographic proof of identity — provided that
string also happens to resolve to a role via `member_roles`. This is real:
anyone who knows or guesses an admin's email address, and where that email
holds a role, can authenticate as them without a real Google token.

`appearance.js` already defends against the sharpest edge of this (its `PUT`
requires `viewer.verified === true`, explicitly to stop one member
overwriting another's saved preference via this fallback) — that's the
pattern to follow if similar overwrite-risk endpoints are added.

`DECISION REQUIRED`: turning this off entirely is the architecturally correct
end state, but is a live-system-safety change (`CONTRIBUTING.md` §3-adjacent
territory even though it's not the money path itself — admin actions are
gated by the same mechanism) and needs its own reviewed change with a
rollout plan for anyone currently depending on the legacy token, not a
silent flip as a side effect of unrelated work. Flagging it here so it's
visible rather than rediscovered.

## Special case: manual contribution entry

`functions/api/contributions.js`'s manual add/edit/delete does **not** use
the permission-scope system for its extra gate, despite `edit_contributions`
already being registered in `VALID_PERMISSIONS`. It calls `requireAuth`
with no specific permission (so any recognized role-holder or the machine
token passes that layer), then additionally requires the caller's email to
be the machine token or a single hardcoded email
(`MANUAL_ENTRY_ALLOWLIST = ["albertjoshrock101@gmail.com"]`). A `TODO`
comment in the source already flags this as needing migration to the
`edit_contributions` scope. This is inside the frozen giving path, so — same
rule as everywhere else in that path — fixing it needs a deliberate,
reviewed, tested change, not an incidental one.

## Admin console auth (two layers, don't confuse them)

- **`admin.html`'s own gate** is what actually protects the console: Google
  Identity Services sign-in → the resulting token is validated by calling
  `/api/roles` (unlocks if the account has `manage_roles`, otherwise probes
  a couple of lesser-scoped endpoints to detect a partial role). A dev-only
  bypass exists on `localhost`/`file:` origins for local development.
- **`admin-session.js` (`window.LJMAdmin`)** is a separate, lighter
  convenience layer: a floating quick-nav bar shown on *public* pages when a
  signed-in admin is browsing them, so they can jump to admin pages. It signs
  its own 30-minute session token with an HMAC secret that is **hard-coded
  and public in client JS** — this is tamper-evidence for a UI convenience
  feature only, not real security, and should never be treated as an
  authorization boundary. It does not gate any data access itself.

Individual admin-console sections are gated purely at the API layer per
request, not by hiding DOM sections based on the signed-in user's specific
scopes — this matches the constitution's "hiding a menu item is NOT
security" principle exactly, so this is working as intended, not a gap.
