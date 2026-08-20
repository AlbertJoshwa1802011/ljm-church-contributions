// Watch & Listen rendered admin-configured livestream/podcast URLs
// (sunday_live_url / daily_prayer_url / podcast_playlist_url from
// /api/settings) directly into href="..." with no escaping, so a URL value
// containing a `"` could break out of the attribute and inject arbitrary
// markup/script — a stored-XSS path through admin-writable settings onto a
// public page. v2/watch.html is a plain browser script with no build step
// and no exports, so the render logic is extracted from source and
// evaluated here with a hostile URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "watch.html"), "utf8");

function extractFn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}() must exist in v2/watch.html`);
  const end = source.indexOf("\n    }", start) + 6;
  return source.slice(start, end);
}

function loadHelpers() {
  const esc = extractFn("esc");
  const safeUrl = extractFn("safeUrl");
  const toEmbed = extractFn("toEmbed");
  // eslint-disable-next-line no-new-func
  return new Function(`${esc}\n${safeUrl}\n${toEmbed}\nreturn { esc, safeUrl, toEmbed };`)();
}

test("watch.html: esc() neutralizes quotes/angle-brackets that could break out of an href attribute", () => {
  const { esc } = loadHelpers();
  const hostile = '"><script>alert(1)</script>';
  const escaped = esc(hostile);
  assert.doesNotMatch(escaped, /<script>/);
  assert.doesNotMatch(escaped, /"/);
});

test("watch.html: safeUrl() rejects javascript: and other non-http(s) schemes", () => {
  const { safeUrl } = loadHelpers();
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeUrl(''), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl('https://youtube.com/watch?v=abc123'), 'https://youtube.com/watch?v=abc123');
});

test("watch.html: card rendering escapes the URL before interpolating into href", () => {
  assert.match(source, /href="\s*'\s*\+\s*esc\(link\)/,
    "the fallback link's href must be built from esc(link), not the raw URL");
  assert.doesNotMatch(source, /href="'\s*\+\s*c\.url\s*\+\s*'"/,
    "the raw, unescaped c.url must never be interpolated directly into href");
});
