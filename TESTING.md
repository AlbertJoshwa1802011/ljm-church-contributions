# Testing

This project has **two layers of testing**, aimed at two different things:

1. **`node --test` suite** (`tests/`) — fast, offline, runs the real `functions/api/*.js` code against an in-memory SQLite database. This is what you run locally and in CI on every push.
2. **Production self-test suite** (`functions/api/selftest.js`) — a live, production-safe end-to-end suite that runs *against a real deployment* (real D1, real Cloudflare Pages Functions), triggered from the admin console's "Self-test" tab. It exercises things the offline suite can't: real HTTP routing, real auth token verification, the live webhook, etc. It creates and then deletes its own test records, so it never pollutes real data.

Neither replaces the other. The `node --test` suite is where new backend logic should get its first, fast feedback loop; the Self-test tab is the pre-flight check before/after a real deploy.

## Running the `node --test` suite

```bash
npm test
```

Requires **Node.js 22+** (uses the built-in `node:sqlite` module, which is why there's no external test-framework dependency at all — no Jest, no Vitest, nothing to `npm install`).

`package.json`'s `test` script is `node --test 'tests/**/*.test.mjs'` — note the **explicit glob**, not a bare directory path. Passing a bare directory (`node --test tests/`) does not reliably auto-discover test files in this Node version/environment; if you ever "fix" this back to a bare path, run `npm test` yourself before trusting it; it will silently report a false failure otherwise.

## How the harness works

`tests/helpers/mock-d1.mjs` is a thin shim that makes Node's built-in SQLite look enough like a Cloudflare D1 binding (`db.prepare(sql).bind(...args).first() / .all() / .run()`) to run the **actual** `functions/api/*.js` request handlers directly, with no network access, no Cloudflare runtime, and no mocking of your own business logic:

```js
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as families from "../../functions/api/families.js";

const db = freshDb(); // fresh in-memory SQLite DB, schema.sql already applied
const res = await families.onRequestPost(makeContext({
  db,
  body: { familyName: "Thomas Family", members: [{ name: "John Thomas", relation: "Head" }] }
}));
const result = JSON.parse(await res.text());
```

- `freshDb()` creates a brand-new `:memory:` SQLite database and runs `schema.sql` against it — every test starts from a clean, fully-seeded (funds, roles, wishlist samples, Bible verse starter set, etc.) baseline, exactly like a fresh install.
- `makeContext({ db, method, url, body, authToken, headers })` builds a fake Cloudflare Pages Functions `context` object. By default `authToken` is the machine `ADMIN_API_TOKEN` path (wildcard permissions, no network call to Google) — pass `authToken: null` to test the "not authorized" path, or set `headers` directly for other scenarios.
- Because this calls the real `onRequestGet`/`onRequestPost`/etc. exports, a bug in the actual handler shows up as a real test failure — there's no separate "mock" implementation of the business logic to drift out of sync.

## Adding a new test

1. Put it in `tests/api/<feature>.test.mjs` (or `tests/unit/` for pure-logic tests that don't need a database at all).
2. Use `node:test` (`test(...)`) and `node:assert/strict`.
3. Import the real handler from `functions/api/`, build a fresh DB with `freshDb()`, and call the handler with `makeContext()`.
4. Run `npm test` yourself and confirm it actually passes before considering the task done — don't assume a test you just wrote is correct without running it.

A few conventions worth following (see the existing test files for examples):
- Test the *behavior a user or admin would notice*, not implementation details — e.g. "a family is billed once regardless of member count," not "the SQL INSERT statement has N columns."
- Cover the permission-denied path at least once per new endpoint (`authToken: null`).
- If your endpoint touches money or membership records, add a test that would fail if the record were silently duplicated, double-counted, or wrongly attributed — these are the bugs most worth catching automatically.

## The production Self-test suite (`functions/api/selftest.js`)

This predates the `node --test` suite and covers the live deployment specifically. Convention for adding a new case there: a `try { ...; record(name, true) } catch (e) { record(name, false, e.message) }` block, with matching cleanup of anything you created added to the `finally` block at the bottom of the file (all test-created rows are tagged `ZZ Selftest` / `zz-selftest-*` / `TEST-*` so they're easy to spot and guaranteed to be deleted even if an assertion fails partway through).

## `functions/api/verify.js`

A separate, read-only data-integrity/reconciliation endpoint (`GET /api/verify`) — schema sanity checks, orphan-reference checks, etc. Never writes to data tables. Worth extending when you add a new foreign-key-like relationship this schema doesn't enforce at the database level (this project has almost no real `FOREIGN KEY` constraints — see the comment at the top of `functions/api/verify.js`).

## Manual UI verification

There's no automated browser/UI test suite. `.agents/workflows/verify-portal.md` documents the manual checklist (viewport sizes, dark mode, console errors) to run through after a UI-affecting change — `verify-portal.js` is a browser-console script for a quick DOM-presence smoke check on a live page.
