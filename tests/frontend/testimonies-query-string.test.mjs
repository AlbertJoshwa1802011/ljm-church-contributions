// Regression test for a real bug found in deep QA: v2/testimonies.html's
// default (no kind-filter) page load built the fetch URL as
// '/api/testimonies' + '' + '&_t=' + Date.now() -> '/api/testimonies&_t=...'
// (missing the leading '?'). Because the site has no _redirects/404.html,
// that malformed path fell through Cloudflare Pages' unmatched-route
// fallback to the legacy homepage HTML (200, not JSON) instead of hitting
// functions/api/testimonies.js -- every first-time visitor to Testimonies
// saw only "Couldn't load testimonies right now," since `.then(r => r.json())`
// threw parsing HTML as JSON.
//
// This statically parses testimonies.html so a future edit that reintroduces
// an unconditional '&' after the base path (instead of building the query
// string starting with '?') fails `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "testimonies.html"), "utf8");

function extractTestimoniesFetchCall(src) {
  const match = src.match(/fetch\(\s*(['"]\/api\/testimonies[\s\S]*?)\s*,\s*\{\s*cache:\s*['"]no-store['"]/);
  assert.ok(match, "Expected to find the testimonies list fetch(...) call in v2/testimonies.html");
  return match[1];
}

test("testimonies.html: the list fetch URL never appends '&' directly onto a bare base path", () => {
  const urlExpr = extractTestimoniesFetchCall(source);
  // The buggy shape: '/api/testimonies' + (cond ? '?x=' + y : '') + '&_t=' + ...
  // i.e. a '&'-joined segment appears in the expression before any '?' is
  // guaranteed to have been emitted first.
  assert.doesNotMatch(
    urlExpr,
    /^'\/api\/testimonies'\s*\+\s*\([^)]*\?[^)]*:\s*['"]{2}\)\s*\+\s*['"]&/,
    "The fetch URL must not unconditionally append '&...' right after a base path with no guaranteed '?' -- " +
    "when the preceding conditional is falsy this produces '/api/testimonies&_t=...', a malformed path that " +
    "Cloudflare Pages serves as the legacy homepage (200 HTML) instead of routing to the API."
  );
});

test("testimonies.html: the list fetch URL always starts its query string with '?', never '&', regardless of the kind filter", () => {
  const urlExpr = extractTestimoniesFetchCall(source);
  // Fixed shape: '/api/testimonies?' + (cond ? 'kind=' + x + '&' : '') + '_t=' + ...
  assert.match(
    urlExpr,
    /^'\/api\/testimonies\?'/,
    "Expected the fetch URL expression to start with the literal '/api/testimonies?' so the query string is always well-formed"
  );
});
