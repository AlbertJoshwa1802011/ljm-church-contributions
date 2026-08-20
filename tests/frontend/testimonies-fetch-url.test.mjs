// Regression test for a real bug found in the LJM V2 journey-breaker session
// (caught live by tests/e2e/navigation-and-health.e2e.mjs against a real
// browser + wrangler dev server): v2/testimonies.html's default (no kind
// filter) load built the URL as
//   '/api/testimonies' + '' + '&_t=' + Date.now()
// i.e. `/api/testimonies&_t=170...` — missing the `?` that starts a query
// string. Cloudflare Pages Functions routing treats that as a literal,
// non-matching pathname, so the request 404s. Since `currentKind` starts
// empty, this hit EVERY first-time visitor's default page load, and the
// `.catch()`/non-JSON-response path showed "Couldn't load testimonies right
// now" instead of the real gallery — the single most visible thing on the
// Testimonies page, broken for every visitor, every time.
//
// This extracts the real URL-building expression from the file and executes
// it for both the empty and populated `currentKind` cases, asserting the
// result is always a well-formed `path?query` URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "testimonies.html"), "utf8");

function buildUrl(currentKind) {
  const m = source.match(/fetch\((\'\/api\/testimonies[^,]+)/);
  assert.ok(m, "Expected to find the testimonies fetch() call in v2/testimonies.html");
  // eslint-disable-next-line no-new-func
  return new Function("currentKind", "Date", `return ${m[1]};`)(currentKind, { now: () => 1234567890 });
}

test("v2/testimonies.html: the default (no kind filter) fetch URL is well-formed (regression)", () => {
  const url = buildUrl("");
  assert.equal(url, "/api/testimonies?_t=1234567890");
  assert.ok(!url.includes("testimonies&"), `URL is malformed (missing '?' before query string): ${url}`);
});

test("v2/testimonies.html: a kind-filtered fetch URL is still well-formed", () => {
  const url = buildUrl("miracle");
  assert.equal(url, "/api/testimonies?kind=miracle&_t=1234567890");
});
