// Parametrized regression test: every handler that touches D1 must fail
// gracefully (500, JSON body) when the DB binding is missing, rather than
// throwing an unhandled exception. This is the single most repeated,
// least-individually-tested line in the API surface (`if (!db) return ...500`)
// — see docs/testing/COVERAGE-TRACKER.md P2. Looping once here covers it for
// every module instead of one bespoke test per file.
import { test } from "node:test";
import assert from "node:assert/strict";

// selftest.js is a live-deployment-only suite (see TESTING.md) — not exercised
// here. events/photo.js doesn't take a D1 binding at all (it uses R2), so a
// missing-DB scenario doesn't apply to it — its own guard (missing EVENT_PHOTOS)
// is covered in events-photo.test.mjs.
const MODULES = [
  "appearance.js", "auth.js", "bible.js", "contributions.js", "events.js",
  "expenses.js", "families.js", "funds.js", "logs.js", "members.js",
  "migrate.js", "purchases.js", "roles.js", "search.js", "settings.js",
  "subscriptions.js", "verify.js", "webhook.js", "wishlist.js"
];

function fakeRequest(method) {
  return {
    url: "https://test.local/api/x?id=1&secret=x",
    method,
    headers: { get: () => null },
    json: async () => ({}),
    text: async () => "{}"
  };
}

for (const file of MODULES) {
  test(`db-binding guard: ${file} fails gracefully (not an unhandled throw) with no DB binding`, async () => {
    const mod = await import(`../../functions/api/${file}`);
    const handlerNames = Object.keys(mod).filter(k => k.startsWith("onRequest") && k !== "onRequestOptions");

    for (const name of handlerNames) {
      const method = name.replace("onRequest", "").toUpperCase();
      const context = { env: {}, request: fakeRequest(method) };
      let res;
      try {
        res = await mod[name](context);
      } catch (err) {
        assert.fail(`${file} ${name} threw instead of returning an error response: ${err.message}`);
      }
      assert.ok(res instanceof Response, `${file} ${name} should return a Response`);
      assert.ok(res.status >= 400, `${file} ${name} should respond with an error status when DB is missing (got ${res.status})`);
    }
  });
}
