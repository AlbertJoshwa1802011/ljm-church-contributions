// Parametrized regression test: for every handler module that defines
// onRequestOptions (CORS preflight), the declared Access-Control-Allow-Methods
// must actually cover every HTTP method the module implements — catching drift
// where a new POST/PUT/DELETE action is added but the OPTIONS allow-list isn't
// updated. See docs/testing/COVERAGE-TRACKER.md P2.
//
// auth.js, migrate.js, selftest.js, verify.js, webhook.js intentionally have no
// onRequestOptions (server-to-server or admin-tool GET-only endpoints that don't
// need a CORS preflight) — not included here, nothing to check.
import { test } from "node:test";
import assert from "node:assert/strict";

const MODULES_WITH_OPTIONS = [
  "appearance.js", "bible.js", "contributions.js", "events.js", "expenses.js",
  "families.js", "funds.js", "logs.js", "members.js", "purchases.js", "roles.js",
  "search.js", "settings.js", "subscriptions.js", "wishlist.js", "events/photo.js"
];

function methodFromHandlerName(name) {
  return name.replace("onRequest", "").toUpperCase();
}

for (const file of MODULES_WITH_OPTIONS) {
  test(`cors: ${file}'s OPTIONS allow-methods covers every handler it actually exports`, async () => {
    const mod = await import(`../../functions/api/${file}`);
    assert.ok(typeof mod.onRequestOptions === "function", `${file} should export onRequestOptions`);

    const res = await mod.onRequestOptions();
    assert.ok(res instanceof Response);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");

    const allowHeader = res.headers.get("Access-Control-Allow-Methods") || "";
    const allowed = allowHeader.split(",").map(s => s.trim().toUpperCase());

    const implementedMethods = Object.keys(mod)
      .filter(k => k.startsWith("onRequest") && k !== "onRequestOptions")
      .map(methodFromHandlerName);

    for (const method of implementedMethods) {
      assert.ok(
        allowed.includes(method),
        `${file} implements ${method} but its OPTIONS handler only declares [${allowed.join(", ")}]`
      );
    }
  });
}
