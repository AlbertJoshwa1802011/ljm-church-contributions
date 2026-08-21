// theme.js is loaded by admin.html and every legacy top-level page
// (about/events/funds/impact/index/member/members/subscriptions.html). It
// monkey-patches window.fetch so that on localhost/127.0.0.1, any relative
// /api/* call is redirected to the real production domain
// (light-of-jesus-ministry-contributions.pages.dev) — a deliberate
// convenience so a local preview can show real content without standing up
// local D1.
//
// The bug: it redirected EVERY method, not just GET. Confirmed live via
// `wrangler pages dev`: admin.html's POST /api/events (creating an event)
// resolved to https://light-of-jesus-ministry-contributions.pages.dev/api/events
// — a local admin session silently mutating the real production database,
// with nothing in the URL bar to suggest anything but localhost was touched.
// Given every write path in admin.html (create/edit/delete/publish/moderate)
// goes through this same fetch(), this made "test locally" and "mutate
// production" indistinguishable for the entire legacy app + admin console.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "theme.js"), "utf8");

function runFetchPatchWith({ hostname, method, url }) {
  const calls = [];
  const sandbox = {
    window: {
      location: { hostname },
      fetch: (u, init) => { calls.push({ url: u, init }); return Promise.resolve({ ok: true }); }
    }
  };
  sandbox.window.fetch.toString = () => "function fetch() { [native code] }"; // not required, just parity
  vm.createContext(sandbox);
  // theme.js is a full IIFE with lots of unrelated DOM/localStorage code that
  // won't run in a bare vm sandbox — only exec the redirect block itself.
  const start = source.indexOf("// ---- Global API Redirect");
  const end = source.indexOf("\n\n", start);
  assert.notEqual(start, -1, "the Global API Redirect block must exist in theme.js");
  vm.runInContext(source.slice(start, end), sandbox);
  return sandbox.window.fetch(url, method ? { method } : undefined).then(() => calls[0]);
}

test("theme.js: on localhost, a GET to /api/* is redirected to production (the intended preview behavior)", async () => {
  const call = await runFetchPatchWith({ hostname: "127.0.0.1", method: "GET", url: "/api/events" });
  assert.equal(call.url, "https://light-of-jesus-ministry-contributions.pages.dev/api/events");
});

test("theme.js: on localhost, a POST to /api/* stays local — must NOT silently hit production", async () => {
  const call = await runFetchPatchWith({ hostname: "127.0.0.1", method: "POST", url: "/api/events" });
  assert.equal(call.url, "/api/events", "a write must never be redirected off the local origin");
});

for (const method of ["PUT", "DELETE", "PATCH"]) {
  test(`theme.js: on localhost, a ${method} to /api/* also stays local`, async () => {
    const call = await runFetchPatchWith({ hostname: "127.0.0.1", method, url: "/api/events" });
    assert.equal(call.url, "/api/events");
  });
}

test("theme.js: off localhost, fetch is never patched at all", async () => {
  const call = await runFetchPatchWith({ hostname: "light-of-jesus-ministry-contributions.pages.dev", method: "GET", url: "/api/events" });
  assert.equal(call.url, "/api/events");
});
