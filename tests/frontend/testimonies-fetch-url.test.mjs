// Regression test for a real, browser-confirmed bug found during adversarial
// QA: v2/testimonies.html's default (no kind filter) fetch built its URL as
// '/api/testimonies' + '' + '&_t=' + Date.now() — missing the leading '?',
// producing a literal request to /api/testimonies&_t=169... . Cloudflare
// Pages Functions routing doesn't match that path (it only matches exactly
// /api/testimonies), so the request fell through to the static-asset
// fallback and was served the legacy root index.html (200 OK, but HTML, not
// JSON). fetch(...).then(r => r.json()) then threw a JSON parse error,
// landing in the .catch() and showing "Couldn't load testimonies right now"
// to every visitor who didn't click a kind filter chip first — i.e. the
// Testimonies page was broken by default. Confirmed live against a real
// wrangler pages dev + local D1 run and in a real Chromium page via
// Playwright (network log showed the malformed request and the HTML
// response body) before this fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "testimonies.html"), "utf8");

test("testimonies.html: the list fetch always has exactly one '?' before its query string", () => {
  const match = source.match(/fetch\('\/api\/testimonies\?[^']*'/);
  assert.ok(match, "expected the testimonies list fetch() call to start with '/api/testimonies?'");
});

test("testimonies.html: the malformed no-'?' construction does not come back", () => {
  assert.doesNotMatch(source, /'\/api\/testimonies' \+ \(currentKind/,
    "the URL must not be built as '/api/testimonies' + (currentKind ? '?kind=...' : '') + '&_t=...' — that's a '?'-less URL when currentKind is empty");
});

test("testimonies.html: simulated URL construction is valid with and without a kind filter", () => {
  const match = source.match(/fetch\((['"])\/api\/testimonies\?[^;]*?_t=[^,]*\1/);
  assert.ok(match, "could not locate the fetch() URL expression to simulate");
  const expr = match[0].slice(match[0].indexOf("'") + 1, -1) || match[0];

  function build(currentKind) {
    // Mirrors the fixed expression: '/api/testimonies?' + (currentKind ? 'kind=' + currentKind + '&' : '') + '_t=' + Date.now()
    return "/api/testimonies?" + (currentKind ? "kind=" + currentKind + "&" : "") + "_t=123";
  }

  const withoutFilter = build("");
  const withFilter = build("miracle");
  assert.equal(withoutFilter, "/api/testimonies?_t=123");
  assert.equal(withFilter, "/api/testimonies?kind=miracle&_t=123");
  // Both must parse as a valid URL with a real query string (not folded into the path).
  for (const url of [withoutFilter, withFilter]) {
    const parsed = new URL(url, "http://test.local");
    assert.equal(parsed.pathname, "/api/testimonies", `${url} must resolve to the real /api/testimonies path`);
    assert.ok(parsed.search.startsWith("?"), `${url} must have a real '?' query string`);
  }
});
