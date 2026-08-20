// Regression test for a real bug found in the LJM V2 journey-breaker session:
// v2/watch.html rendered the admin-controlled Watch & Listen URLs
// (settings.sunday_live_url / daily_prayer_url / podcast_playlist_url) as a
// raw string concatenated into `<a href="'+c.url+'">` with no escaping. A
// non-YouTube URL containing a `"` breaks out of the attribute and injects
// markup (e.g. an onerror image) — a stored XSS served to every visitor of
// the public watch page. functions/api/settings.js now also rejects non-
// http(s) values for these keys at write time (see settings.test.mjs); this
// test guards the render path itself, in case a bad value ever reaches it
// (e.g. data written before the server-side guard existed).
//
// Unlike a test that reimplements the escaping logic itself (which would
// pass regardless of what the real file does), this extracts v2/watch.html's
// actual IIFE — the real fetch().then() chain that builds #watchGrid's
// innerHTML — and executes it for real against a fake fetch/DOM, then
// inspects the actual HTML string the real code produced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "watch.html"), "utf8");

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

test("v2/watch.html: defines esc() and safeHref() helpers", () => {
  assert.match(source, /function esc\(/, "Expected an esc() HTML-escaping helper in v2/watch.html");
  assert.match(source, /function safeHref\(/, "Expected a safeHref() protocol allowlist helper in v2/watch.html");
});

test("v2/watch.html: rendering a hostile Watch & Listen URL never produces unescaped attribute breakout or a javascript:/data: href (regression)", async () => {
  const blocks = extractScriptBlocks(source);
  const cardScript = blocks.find(b => /toEmbed/.test(b));
  assert.ok(cardScript, "Expected to find the watch-card rendering script block");

  // Run the REAL IIFE from the file (not a reimplementation) against a fake
  // fetch (returns hostile settings) and a fake DOM element that just
  // records whatever .innerHTML the real code assigns to it.
  const grid = { _html: "", set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
  const elements = { watchGrid: grid };
  const fakeDoc = {
    querySelectorAll: () => [],
    getElementById: (id) => elements[id] || { innerHTML: "" }
  };

  const hostileSettings = {
    sunday_live_url: '"><img src=x onerror=alert(document.cookie)>',
    daily_prayer_url: "javascript:alert(1)",
    podcast_playlist_url: 'https://evil.example/?list=abc123" onmouseover="alert(1)'
  };
  const fakeFetch = () => Promise.resolve({ json: () => Promise.resolve({ settings: hostileSettings }) });

  // Run the file's real IIFE body (unwrapped) — it kicks off the real
  // fetch().then().then() chain against our fake fetch/DOM above.
  const body = cardScript.replace(/^\s*\(function\s*\(\)\s*\{/, "").replace(/\}\)\(\);\s*$/, "");
  const fn = new Function("document", "fetch", body);
  fn(fakeDoc, fakeFetch);

  // Poll for the async chain to finish populating the grid (bounded wait).
  const deadline = Date.now() + 1000;
  while (grid.innerHTML === "" && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  const html = grid.innerHTML;
  assert.ok(html.length > 0, "watchGrid.innerHTML should have been populated");
  assert.ok(!html.includes('"><img'), `hostile URL broke out of an HTML attribute — rendered HTML: ${html}`);
  assert.ok(!/href="javascript:/i.test(html), `javascript: URL was rendered as a clickable href — rendered HTML: ${html}`);
  assert.ok(!/onmouseover=/i.test(html), `payload injected a raw event handler attribute — rendered HTML: ${html}`);
});
