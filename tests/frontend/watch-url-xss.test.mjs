// v2/watch.html renders the admin-configured Watch & Listen URLs
// (sunday_live_url / daily_prayer_url / podcast_playlist_url, settings.js,
// manage_funds-gated) into the page. Before the fix, any URL that didn't
// match the YouTube-embed regex fell through to:
//   '<a ... href="' + c.url + '" ...>Open link ↗</a>'
// with NO escaping and NO scheme check — a stored XSS: an admin (or anyone
// who tricks one into pasting a malicious link into the Settings > Watch &
// Listen form) could set the field to `javascript:...` (executes on click)
// or to a string containing `"><script>...` (breaks out of the attribute
// immediately, no click needed) and every visitor to /v2/watch.html would
// carry it.
//
// This test extracts and executes the real render script from v2/watch.html
// (same "evaluate real source" approach as razorpay-fund-label.test.mjs /
// theme-local-api-redirect.test.mjs) against a stubbed fetch + DOM, and
// asserts the rendered HTML never contains a raw javascript:/data: href or
// an unescaped quote that could break out of the attribute.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const html = readFileSync(path.join(REPO_ROOT, "v2", "watch.html"), "utf8");

function extractRenderScript() {
  const start = html.indexOf("// Best-effort YouTube embed URL normalizer");
  assert.notEqual(start, -1, "the Watch & Listen render script must exist in v2/watch.html");
  const marker = "please try again shortly.</div>'; });";
  const markerAt = html.indexOf(marker, start);
  assert.notEqual(markerAt, -1, "the fetch().catch() tail must exist in v2/watch.html");
  const end = markerAt + marker.length;
  return html.slice(start, end);
}

// Runs the real render script against a fake `fetch` returning `settings`,
// and returns the innerHTML string the script assigned to #watchGrid.
async function renderWatchGrid(settings) {
  const script = extractRenderScript();
  let renderedHtml = null;
  const gridEl = {
    set innerHTML(v) { renderedHtml = v; },
    get innerHTML() { return renderedHtml; }
  };
  const sandbox = {
    document: { getElementById: (id) => (id === "watchGrid" ? gridEl : { innerHTML: "" }) },
    location: { href: "https://lightofjesusministry.example/v2/watch.html" },
    URL,
    fetch: () => Promise.resolve({ json: async () => ({ settings }) }),
    Date,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(`(function () { ${script} })();`, sandbox, { filename: "watch.html-inline" });
  // Let the fetch().then() microtask chain settle.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return renderedHtml;
}

test("watch.html: javascript: URL in sunday_live_url never reaches an href attribute", async () => {
  const out = await renderWatchGrid({ sunday_live_url: "javascript:alert(document.cookie)" });
  assert.doesNotMatch(out, /href="javascript:/i, `must not render a javascript: href, got:\n${out}`);
});

test("watch.html: a quote-breaking payload in daily_prayer_url cannot escape the href attribute", async () => {
  const payload = '" onmouseover="alert(1)"><script>alert(2)</script>';
  const out = await renderWatchGrid({ daily_prayer_url: payload });
  // The payload's quotes/angle-brackets must come out HTML-entity-escaped, so
  // the whole thing stays inert text inside href="...", not a real new
  // onmouseover="..." attribute or a real <script> element.
  assert.doesNotMatch(out, /"\s+onmouseover="/i, `a real onmouseover attribute was created — attribute breakout succeeded:\n${out}`);
  assert.doesNotMatch(out, /<script>alert/i, `raw <script> tag survived unescaped:\n${out}`);
  assert.match(out, /href="&quot; onmouseover=&quot;alert\(1\)&quot;&gt;&lt;script&gt;/,
    `expected the payload to be HTML-entity-escaped inside href, got:\n${out}`);
});

test("watch.html: data: URL in podcast_playlist_url is rejected, not linked", async () => {
  const out = await renderWatchGrid({ podcast_playlist_url: "data:text/html,<script>alert(1)</script>" });
  assert.doesNotMatch(out, /href="data:/i, `must not render a data: href, got:\n${out}`);
});

test("watch.html: a real https YouTube URL still renders as a working iframe embed (no regression)", async () => {
  const out = await renderWatchGrid({ sunday_live_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  assert.match(out, /<iframe src="https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ"/);
});

test("watch.html: a real https non-YouTube URL still renders as a clickable fallback link (no regression)", async () => {
  const out = await renderWatchGrid({ daily_prayer_url: "https://meet.google.com/abc-defg-hij" });
  assert.match(out, /href="https:\/\/meet\.google\.com\/abc-defg-hij"/);
});
