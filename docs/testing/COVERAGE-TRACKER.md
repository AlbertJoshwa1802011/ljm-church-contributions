# Test Coverage Tracker

| | |
|---|---|
| **Purpose** | The living, in-repo backlog of every known test-coverage gap in `functions/api/*`, prioritized. Any agent/developer picks up exactly where the last one left off — check items off in this file as you close them. |
| **Mandate** | See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — tests are **mandatory** for new/changed endpoints; closing existing gaps below is ongoing, prioritized work. |
| **Baseline** | Audited 2026-07-17. Suite was 82 tests before this tracker existed. |
| **Rule** | When you close an item, check it off **and** note the test file/name that covers it. Never remove a row — a checked row is the record that it's covered; an unchecked row is the record that it still needs work. If you add a new endpoint, add its rows here too (don't let the tracker go stale). |

---

## P0 — security/permission gaps (highest blast radius, close first)

- [x] `roles.js` DELETE `delete_role` — happy path + `super_admin` protection — `tests/api/roles.test.mjs`
- [x] `roles.js` DELETE `unlink_email` — happy path + hardcoded-super-admin protection — `tests/api/roles.test.mjs`
- [x] `roles.js` DELETE unknown action / missing `manage_roles` permission — `tests/api/roles.test.mjs`
- [x] `funds.js` GET `?slug=` detail (legacy-shape payload, `assignedMembers`) — `tests/api/funds.test.mjs`
- [x] `funds.js` members-only visibility gate (assigned member allowed, anonymous 403, `manage_funds` override) — `tests/api/funds.test.mjs`
- [x] `funds.js` POST `add_member`/`remove_member` — `tests/api/funds.test.mjs`
- [x] `funds.js` POST create: reserved slug rejected, duplicate slug → 409 — `tests/api/funds.test.mjs`
- [x] `funds.js` PUT nonexistent fund → 404, no editable fields → 400 — `tests/api/funds.test.mjs`
- [x] `funds.js` DELETE requires `delete_funds` (distinct from `manage_funds`) — `tests/api/funds.test.mjs`
- [x] `settings.js` PUT requires `manage_funds` permission — `tests/api/settings.test.mjs`
- [x] `settings.js` PUT `force_login` must be `'true'`/`'false'` — `tests/api/settings.test.mjs`
- [x] `settings.js` PUT `tech_goal_amount`/`christmas_goal_amount` syncs into `funds` table — `tests/api/settings.test.mjs`
- [x] `settings.js` PUT value-length cap enforced (default + `about_content` override) — `tests/api/settings.test.mjs`
- [x] `settings.js` GET returns only `PUBLIC_KEYS` (a writable-but-non-public key is excluded) — `tests/api/settings.test.mjs`
- [x] `subscriptions.js` GET/POST require `manage_subscriptions` — `tests/api/subscriptions.test.mjs`
- [x] `subscriptions.js` ungrouped individual `mark_paid`/`unmark` round trip — `tests/api/subscriptions.test.mjs`
- [x] `subscriptions.js` 404s (nonexistent family/member) + unknown action + bad month format — `tests/api/subscriptions.test.mjs`

## P0 — zero-coverage files

- [x] `events.js` GET public listing (published only) + categories — `tests/api/events.test.mjs`
- [x] `events.js` GET `?id=` detail (any status) + photos — `tests/api/events.test.mjs`
- [x] `events.js` GET `?all=1` requires `manage_events` — `tests/api/events.test.mjs`
- [x] `events.js` POST create (base64-fallback photo storage path, `extra` JSON round-trip, first-gallery-photo-as-cover fallback) — `tests/api/events.test.mjs`
- [x] `events.js` POST requires title + `manage_events` — `tests/api/events.test.mjs`
- [x] `events.js` PUT update incl. `removePhotoIds`/`addPhotos`, nonexistent id → 404 — `tests/api/events.test.mjs`
- [x] `events.js` DELETE incl. cascading photo cleanup, nonexistent id → 404 — `tests/api/events.test.mjs`
- [x] `events/photo.js` missing key → 400, missing/no R2 binding → 404 — `tests/api/events-photo.test.mjs`
- [x] `events.js` real R2 object storage branch (`env.EVENT_PHOTOS.put`/`.delete`) — `tests/helpers/mock-r2.mjs` (OFFLINE R2 MOCK, in-memory `Map`-backed, no network/credentials/real bucket) + `tests/api/events-r2.test.mjs`. Covers: cover-photo `put()` through `storePhoto()`, the returned/persisted `/api/events/photo?key=` path, gallery-photo replace (`removePhotoIds` + `addPhotos` in the same `PUT`) triggering `deletePhotoObject()` cleanup of the old key, `removePhotoIds`-only deletion, `DELETE`'s per-photo cascade cleanup, and that a thrown/failing R2 `.delete()` does not break the primary DB operation (matches `deletePhotoObject()`'s existing try/catch, best-effort contract). Note: a `coverPhoto` that is never also inserted as an `event_photos` row is **not** R2-cleaned-up on replace or delete — that's a pre-existing `events.js` characteristic the new tests document rather than paper over (see the FOLLOW-UP/PRE-EXISTING GAP note below re: `events.js` not being touched this round).

## P1 — CRUD completeness

- [x] `members.js` POST/PUT require `view_members` — `tests/api/members.test.mjs`
- [x] `members.js` POST missing `name` → 400 — `tests/api/members.test.mjs`
- [x] `members.js` PUT nonexistent id → 404, no editable fields → 400 — `tests/api/members.test.mjs`
- [x] `members.js` PUT `recurringReminders`/`isVerified` updates — `tests/api/members.test.mjs`
- [x] `members.js` GET per-fund `funds` breakdown object — `tests/api/members.test.mjs`
- [x] `expenses.js` PUT update (full CRUD) — `tests/api/expenses.test.mjs`
- [x] `expenses.js` POST requires `manage_expenses` (non-`?all=1` path) — `tests/api/expenses.test.mjs`
- [x] `expenses.js` PUT/DELETE nonexistent id → 404, require `manage_expenses` — `tests/api/expenses.test.mjs`
- [x] `expenses.js` `summary.byCategory` aggregation — `tests/api/expenses.test.mjs`
- [x] `families.js` standalone POST `add_member` (incl. nonexistent family → 404) — `tests/api/families.test.mjs`
- [x] `families.js` POST `set_head` with a member not in that family → 400 — `tests/api/families.test.mjs`
- [x] `families.js` POST `remove_member` on a member with no family → 400 — `tests/api/families.test.mjs`
- [x] `families.js` POST create with empty `familyName` → 400 — `tests/api/families.test.mjs`
- [x] `families.js` GET requires `view_members` — `tests/api/families.test.mjs`
- [x] `families.js` PUT — family-detail edit mode + member-field edit mode (`body.memberId`) — `tests/api/families.test.mjs`
- [x] `families.js` PUT nonexistent id → 404, no editable fields → 400 — `tests/api/families.test.mjs`
- [x] `families.js` DELETE nonexistent family → 404, requires `manage_members` — `tests/api/families.test.mjs`
- [x] `wishlist.js` PUT/DELETE require `edit_wishlist` — `tests/api/wishlist.test.mjs`
- [x] `wishlist.js` POST/PUT/DELETE missing-field validation (400s) — `tests/api/wishlist.test.mjs`
- [x] `wishlist.js` GET is public (no auth required) — `tests/api/wishlist.test.mjs`
- [x] `purchases.js` `delete_purchase` — `tests/api/purchases.test.mjs`
- [x] `purchases.js` `update_purchase`/`delete_purchase` missing `id` → error — `tests/api/purchases.test.mjs`
- [x] `purchases.js` default fund/external-contribution derivation from `cost` — `tests/api/purchases.test.mjs`
- [x] `purchases.js` default public listing (no `action`) totals — `tests/api/purchases.test.mjs`

## P1 — remaining handlers + network-dependent flows

- [x] `bible.js` GET missing-param 400s (`chapters`/`verses`/`lookup`/`search`), unknown `books` version → empty array, unknown/missing `action` → 400 — `tests/api/bible.test.mjs`
- [x] `bible.js` POST `import` validation (missing `versionCode`/`verses`, `verses.length > 5000`, malformed-row skip, unknown action) — `tests/api/bible.test.mjs`
- [x] `search.js` family + purchases result categories — `tests/api/search.test.mjs`
- [x] `search.js` per-scope isolation (a `manage_funds`-only caller sees funds but not purchases, and vice versa) — `tests/api/search.test.mjs`
- [x] `auth.js` POST successful sign-in + member-by-email lookup (fetch-stubbed) — `tests/api/auth.test.mjs`
- [x] `auth.js` POST name-match fallback (`mappingRecommendation`) + `unclaimedMembers` picker — `tests/api/auth.test.mjs`
- [x] `auth.js` POST `isAdmin`/`permissions` awareness — `tests/api/auth.test.mjs`
- [x] `auth.js` PUT link success + "already linked" 400 + Google-verify-failure 401 — `tests/api/auth.test.mjs`
  **Bug found and fixed while writing this test:** `functions/api/auth.js`'s PUT handler
  checked `result.changes === 0` to detect an already-linked member, but D1's
  `.run()` result puts that count under `.meta.changes`, not a top-level
  `.changes` — so the guard was dead code in production too (never fired; a
  re-link attempt silently returned 200 without actually changing anything,
  instead of the intended 400). Fixed to `!result.meta || result.meta.changes === 0`.
  Mutation-tested: reverting the fix makes the new test fail.

## Money-in path — Razorpay webhook (see `docs/runbooks/razorpay-webhook.md`)

Closed alongside the Aug 2026 incident in which no online payment reached D1 for
~4 weeks (the only Razorpay webhook pointed at Apps Script, never at
`/api/webhook`). All mutation-tested per `CONTRIBUTING.md` §5.

- [x] `webhook.js` stores the contribution timestamp in **IST**, not UTC — `tests/api/webhook.test.mjs`
- [x] `webhook.js` real-payment timestamp fixture matches the Sheet/Razorpay display value — `tests/api/webhook.test.mjs`
- [x] `webhook.js` Sheets forward is **opt-in**: unset or empty `GOOGLE_SHEETS_WEBAPP_URL` makes no outbound request — `tests/api/webhook.test.mjs`
- [x] `webhook.js` never contacts a `script.google.com` URL baked into the source — `tests/api/webhook.test.mjs`
- [x] `webhook.js` still forwards the raw body to a configured URL when one is set — `tests/api/webhook.test.mjs`
- [x] `razorpay-checkout.js` fund label matches the fund for any `?fund=` casing — `tests/frontend/razorpay-fund-label.test.mjs`

## P2 — cross-cutting (efficient, high-leverage)

- [x] DB-missing-binding guard (`if (!db) return 500`) across all handlers — `tests/regression/db-binding-guard.test.mjs` (parametrized loop)
- [x] `onRequestOptions`/CORS present + allow-methods matches actual exported handlers, across all handlers — `tests/regression/cors-options.test.mjs` (parametrized loop)
- [x] SQL-injection-shaped input stored inertly (proves parameterized `.bind()` discipline holds) — `tests/regression/sql-injection-input.test.mjs`
- [x] `contributions.js` `memberEmails`/`memberPhones`/`memberStatus` dictionaries + pre-0002 `config`-fallback goal path — `tests/api/contributions.test.mjs`
- [x] `logs.js` JWT-actor resolution (admin vs member `actorType`) — `tests/api/logs.test.mjs`
- [x] `logs.js` 10-second same-IP/action/entity dedupe — `tests/api/logs.test.mjs`
- [x] `logs.js` GET filters (`actor`/`action`/`actorType`/`from`/`to`) + `limit`/`offset` pagination (clamped to 100) — `tests/api/logs.test.mjs`
- [x] `migrate.js` fail-closed: `MIGRATION_SECRET` unset → 403, mismatch → 401 — `tests/api/migrate.test.mjs`
- [x] `migrate.js` one fetch-stubbed happy-path import — `tests/api/migrate.test.mjs`
- [x] `verify.js` requires `view_members`, `?skipRemote=1` D1-only path — `tests/api/verify.test.mjs`
- [x] `verify.js` catches a deliberately-seeded orphan/integrity anomaly (proves the checker actually works, not just that it runs) — `tests/api/verify.test.mjs`

## `_lib.js` direct unit coverage

- [x] `getPermissions` DB-role-resolution path: missing role row, malformed permissions JSON fallback — `tests/api/_lib.test.mjs`
- [x] `requireAuth` "no specific permission required — any role holder passes" branch — `tests/api/_lib.test.mjs`
- [x] `verifyGoogleToken` aud-mismatch, non-OK response, missing-email branches (fetch-stubbed) — `tests/api/_lib.test.mjs`
- [x] `audit()` never-throws contract (DB write failure inside audit doesn't break the caller) — `tests/api/_lib.test.mjs`

---

## BROWSER E2E (Playwright + Chromium) — smoke coverage

Added in the Aug 2026 pre-release hardening pass. Distinct from the STRUCTURAL
(source/regex, e.g. `tests/frontend/analytics-charts.test.mjs`) and BEHAVIORAL
(Node/vm/API execution, everything under `tests/api`) tiers above — these
actually drive Chromium against a real local `wrangler pages dev` + local D1/R2,
via `npm run test:e2e` (`playwright.config.mjs`, `tests/e2e/`). See
`tests/e2e/fixtures.mjs` for why every page navigation is routed through a
production-URL interceptor (`theme.js` redirects `/api/*` to the live
Cloudflare Pages URL on `localhost`/`127.0.0.1` by design — E2E must neutralize
that, not rely on the sandbox's network policy happening to block it).

- [x] Admin console loads, the dev-only local auth path (`admin.html`'s
  `#devLoginBtn`, real code path minus the Google OAuth popup) establishes a
  session, Overview renders with live KPI/chart data, and dynamic
  (admin-created) funds are represented in the Funds section —
  `tests/e2e/admin-overview.spec.mjs`.
- [x] API failure: `/api/funds` unreachable shows a visible error rather than
  a silent empty/zero dashboard — `tests/e2e/api-failure.spec.mjs`. See the
  discovered-gap note below re: a narrower case (non-2xx *with* a JSON body)
  this specific test does not cover.
- [x] Fund admin create/edit/archive flow, logged in as a non-super-admin
  `manage_funds`-only role holder — `tests/e2e/fund-admin.spec.mjs`. Create and
  edit are verified working; Archive is verified to currently **fail** (see
  the discovered-gap note below — this documents real shipped behavior, not
  the intended one).
- [x] Public funds page renders both system and dynamic funds with no
  release-breaking console errors — `tests/e2e/public-funds.spec.mjs`.
- [x] Give/checkout modal (`razorpay-checkout.js`, one of the 8 frozen files —
  not modified) opens and is wired up, with Razorpay's real domains
  hard-blocked and "Proceed to Pay" never clicked — `tests/e2e/razorpay-ui.spec.mjs`.

---

## Discovered during the Aug 2026 pre-release hardening pass (not fixed — out of that pass's approved scope)

Two real, pre-existing bugs surfaced while building the BROWSER E2E tests
above. Neither `functions/api/funds.js` nor `admin.html` were in that pass's
approved change list, so these are recorded here rather than silently fixed:

- **`funds.js` PUT ignores `body.action` — the admin "Archive fund" button is
  currently non-functional.** `admin.html`'s `#f_archiveBtn` handler sends
  `PUT /api/funds` with `{ slug, action: "archive" }`. `functions/api/funds.js`'s
  `onRequestPut` never reads `body.action` (only the POST handler's
  `add_member`/`remove_member` branch does) — it only recognizes
  `body.status`. With no `status`/`name`/etc. in the payload, `changes` ends up
  empty and the handler returns `{ success: false, message: "No editable
  fields provided" }`; the fund's status never actually changes. Confirmed
  directly against the live local API with `curl` and exercised end-to-end in
  `tests/e2e/fund-admin.spec.mjs`, which asserts the real (broken) behavior so
  it stays honest about what's shipped. **Fix direction (not applied here):**
  either have `onRequestPut` treat `action: "archive"`/`"unarchive"` as
  shorthand for `status: "archived"`/`"active"`, or change the button to send
  `status` directly.
- **`admin.html`'s `api()` helper only rejects on HTTP 401** — any other
  non-2xx status (e.g. a real 500 with a JSON error body) still resolves via
  `r.json()`, so callers like `loadFunds()` that check `d.funds` see `undefined`
  and fall back to their generic "No funds yet." empty state instead of a
  distinct error. `tests/e2e/api-failure.spec.mjs` guards the *connection-
  unreachable* case (which does surface a distinct error via a rejected
  `fetch()`), not this narrower non-2xx-with-body case — noted here so it
  isn't mistaken for full coverage of "API failures are never silent."

---

## Explicitly accepted gaps (not oversights — recorded on purpose)

These are **not** silently missing; they're judged not reducible to the current
offline harness and are tracked here so nobody re-discovers them as a surprise:

- **`functions/api/selftest.js`** — by design a live-production-only E2E suite
  (see `TESTING.md`). Not unit-testable offline; its value is running against a
  real deployment. Not a gap to close with `node --test`.
- **`events.js` real R2 upload branch** — closed, see the P0 zero-coverage-files
  row above (`tests/api/events-r2.test.mjs`, OFFLINE R2 MOCK). The base64-fallback
  path (the default in local/dev without an R2 binding) was already covered.
- **`events.js` MIME-type validation on uploaded photos** — **FOLLOW-UP /
  PRE-EXISTING GAP.** `storePhoto()` in `functions/api/events.js` derives the
  file extension straight from the `data:<mime>;base64,...` prefix's declared
  MIME type with no allowlist check — any string in that position is accepted
  and used to build the R2 key/extension and the stored `Content-Type`. This
  predates this hardening pass and `events.js` is explicitly out of scope for
  it (frozen for this round, not one of the 8 money-path files). Not fixed
  here; tracked as a distinct follow-up.
- **`razorpay-checkout.js`** — no structural-test precedent yet (unlike
  `tests/frontend/analytics-charts.test.mjs`'s regex-based pattern for `script.js`).
  Flagged as a distinct future initiative, not silently ignored. If you pick this
  up, follow the `admin.html` pattern described in the row below.
- **`admin.html` inline-script CRUD wiring** — *partially closed.* The pattern now
  exists: `tests/frontend/contribution-member-picker.test.mjs` statically parses
  `admin.html` and asserts (a) every helper a feature calls is defined, (b) every
  element id the JS reads exists in the markup, (c) the feature is actually wired
  up at init, and (d) the behavioural invariants that matter, as source-shape
  assertions. Extend that file's approach for other admin sections. Still open:
  Funds, Purchases, Expenses, Wishlist, Roles, Families and Events wiring.
- **Concurrent-duplicate-delivery race** in `webhook.js` (the `UNIQUE|constraint`
  catch branch, as opposed to the pre-check `SELECT`) — architecturally hard to
  trigger in a single-threaded mock-D1 test. The idempotency guarantee itself
  (duplicate delivery stored once) IS covered via the pre-check path.

---

## How to use this tracker

1. Before starting any new backend work, skim this file for open (`[ ]`) items in
   the area you're touching — close them alongside your feature work if cheap, or
   at minimum don't make them worse.
2. When you close an item: check it, add the test file/name, run `npm test`, and
   confirm the total pass count only goes up.
3. When you ship a new endpoint: add its operations as new rows here in the same
   change (per `CONTRIBUTING.md`'s mandatory-testing rule) — ideally already checked,
   because you wrote the tests before checking the box.
4. Never delete a row to make the tracker look more "done" — an unchecked row is
   useful signal, not clutter.
