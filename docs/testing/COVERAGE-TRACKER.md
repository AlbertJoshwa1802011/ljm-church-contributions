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
- [ ] `events.js` real R2 object storage branch (`env.EVENT_PHOTOS.put`) — **accepted gap**, needs an R2 mock helper in `tests/helpers/` that doesn't exist yet (base64-fallback path IS covered above; this is only the R2-bound branch).

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

## Explicitly accepted gaps (not oversights — recorded on purpose)

These are **not** silently missing; they're judged not reducible to the current
offline harness and are tracked here so nobody re-discovers them as a surprise:

- **`functions/api/selftest.js`** — by design a live-production-only E2E suite
  (see `TESTING.md`). Not unit-testable offline; its value is running against a
  real deployment. Not a gap to close with `node --test`.
- **`events.js` real R2 upload branch** — needs an R2 binding mock in
  `tests/helpers/` (doesn't exist yet). The base64-fallback path (the default in
  local/dev without an R2 binding) IS covered.
- **`admin.html` inline-script CRUD wiring** and **`razorpay-checkout.js`** — no
  existing structural-test precedent (unlike `tests/frontend/analytics-charts.test.mjs`'s
  regex-based pattern for `script.js`). Flagged as a distinct future initiative,
  not silently ignored. If you pick this up, establish the pattern here first.
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
