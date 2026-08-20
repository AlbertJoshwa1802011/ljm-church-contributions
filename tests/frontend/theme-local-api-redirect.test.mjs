// theme.js redirects /api/* fetches to the real production Cloudflare Pages
// URL whenever the page is loaded from localhost/127.0.0.1 ("Local Preview to
// Live Production"). admin.html is one of the pages that loads theme.js, and
// now hosts the new Ministry admin panels (Churches, Promises, Testimonies,
// Prayer, Contact, Programs, Blog, Settings) — every one of them issues
// POST/PUT/DELETE calls. Before the fix, a developer testing those panels
// locally with a real Google admin session would have every mutating call
// silently redirected to production, actually creating/editing/deleting real
// ministry data instead of touching a local/test backend.
//
// The fix scopes the redirect to safe read-only methods (GET/HEAD) only, so
// local read-only previews keep working exactly as before while writes never
// leave localhost. This test actually executes theme.js in a sandboxed DOM
// stub (matching the razorpay-fund-label.test.mjs pattern of evaluating real
// source, not a re-implementation) and asserts the routing for both cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const themeJs = readFileSync(path.join(REPO_ROOT, "theme.js"), "utf8");

// Minimal enough DOM/browser stub for theme.js's top-level IIFE to run without
// throwing: it touches window.location/fetch/matchMedia/localStorage and
// document.addEventListener/documentElement/querySelectorAll.
function loadThemeJsFetch(hostname) {
  const calls = [];
  const fakeFetch = (url) => {
    calls.push(url);
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };
  const fakeDocument = {
    addEventListener() {},
    documentElement: { setAttribute() {}, getAttribute() { return null; }, style: { setProperty() {} } },
    querySelectorAll: () => []
  };
  const sandbox = {
    window: {
      location: { hostname },
      fetch: fakeFetch,
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      dispatchEvent() {},
      CustomEvent: function (name, opts) { this.name = name; this.detail = opts && opts.detail; }
    },
    document: fakeDocument,
    console,
    Request: function Request() {} // constructor identity only; not instantiated in these tests
  };
  sandbox.window.document = fakeDocument;
  vm.createContext(sandbox);
  vm.runInContext(themeJs, sandbox, { filename: "theme.js" });
  return { fetch: sandbox.window.fetch, calls };
}

test("theme.js: on localhost, a plain GET to /api/* IS redirected to production (intended read-preview behavior)", async () => {
  const { fetch, calls } = loadThemeJsFetch("localhost");
  await fetch("/api/churches");
  assert.equal(calls[0], "https://light-of-jesus-ministry-contributions.pages.dev/api/churches");
});

test("theme.js: on localhost, an explicit GET/HEAD to /api/* is still redirected", async () => {
  const { fetch, calls } = loadThemeJsFetch("localhost");
  await fetch("/api/churches", { method: "GET" });
  await fetch("/api/churches", { method: "HEAD" });
  assert.equal(calls[0], "https://light-of-jesus-ministry-contributions.pages.dev/api/churches");
  assert.equal(calls[1], "https://light-of-jesus-ministry-contributions.pages.dev/api/churches");
});

test("theme.js: on localhost, POST/PUT/DELETE to /api/* stay local — must NEVER reach production", async () => {
  const { fetch, calls } = loadThemeJsFetch("localhost");
  await fetch("/api/testimonies", { method: "POST", body: "{}" });
  await fetch("/api/events", { method: "DELETE" });
  await fetch("/api/settings", { method: "PUT", body: "{}" });
  await fetch("/api/churches", { method: "post", body: "{}" }); // lowercase method too

  for (const url of calls) {
    assert.equal(url, url.replace(/^https:\/\/.*\.pages\.dev/, ""),
      `mutating call must not be rewritten to production, got: ${url}`);
  }
  assert.deepEqual(calls, ["/api/testimonies", "/api/events", "/api/settings", "/api/churches"]);
});

test("theme.js: on the real production hostname, fetch is left completely untouched", async () => {
  const { fetch, calls } = loadThemeJsFetch("light-of-jesus-ministry-contributions.pages.dev");
  await fetch("/api/churches");
  await fetch("/api/events", { method: "DELETE" });
  assert.deepEqual(calls, ["/api/churches", "/api/events"]);
});

test("theme.js: 127.0.0.1 is treated the same as localhost for the redirect guard", async () => {
  const { fetch, calls } = loadThemeJsFetch("127.0.0.1");
  await fetch("/api/churches", { method: "DELETE" });
  assert.equal(calls[0], "/api/churches", "mutating call on 127.0.0.1 must also stay local");
});
