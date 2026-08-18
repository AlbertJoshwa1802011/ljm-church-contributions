// /v2/testimonies.html built its list-fetch URL as:
//   '/api/testimonies' + (currentKind ? '?kind=' + currentKind : '') + '&_t=' + Date.now()
// With the default "All" filter, currentKind is "" (falsy), so the URL came out as
// '/api/testimonies&_t=171234...' — no '?' before the query string at all. Cloudflare
// Pages Functions only route on the exact pathname, so that request never reached
// functions/api/testimonies.js; it fell through to static-asset serving, which (with
// no not_found_handling configured) served the legacy root index.html at 200. The
// page's `.then(r => r.json())` then threw on the HTML body, and every first-time
// visitor landing on /v2/testimonies.html (the default "All" view) saw "Couldn't load
// testimonies right now" instead of the real testimonies — reproduced live against a
// local wrangler pages dev server, confirmed via `curl -s '.../api/testimonies&_t=1'`
// returning the legacy homepage's HTML, not JSON.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "testimonies.html"), "utf8");

function buildUrl(currentKind) {
  const start = source.indexOf("fetch('/api/testimonies?");
  assert.notEqual(start, -1, "the conditional-kind testimonies list fetch must exist in v2/testimonies.html");
  const end = source.indexOf(", { cache:", start);
  const expr = source.slice(start + "fetch(".length, end);
  // eslint-disable-next-line no-new-func
  return new Function("currentKind", `var Date = { now: function () { return 123; } }; return ${expr};`)(currentKind);
}

test("testimonies.html: the default (unfiltered) list URL is well-formed with a '?' before its query string", () => {
  const url = buildUrl("");
  assert.match(url, /^\/api\/testimonies\?/, `expected a '?' right after the path, got: ${url}`);
});

test("testimonies.html: the kind-filtered list URL is also well-formed", () => {
  const url = buildUrl("miracle");
  assert.match(url, /^\/api\/testimonies\?kind=miracle&_t=/, `expected kind + _t joined with '&', got: ${url}`);
});
