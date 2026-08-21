// Confirmed on a real render (wrangler pages dev + Chromium screenshot at
// 320x568/375x667/390x844): the header's "Coimbatore · Worldwide" subtitle
// under the brand name was silently clipped mid-word ("Coimbatore · W")
// instead of wrapping or disappearing — and at the narrowest widths the
// clipped region reached all the way to the hamburger button, making the
// only way to open the mobile nav drawer invisible and unreachable.
// .site-header has `overflow: hidden`, and both `.brand` and `.hamburger-btn`
// are `flex-shrink: 0` — below ~400px their combined natural width exceeds
// the viewport, and the header's own overflow:hidden hides the excess
// instead of letting it flow onto a new line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const css = readFileSync(path.join(REPO_ROOT, "v2", "shared.css"), "utf8");

test("v2/shared.css: the header brand shrinks (subtitle hidden, icon and title tightened) before it clips on narrow phones", () => {
  const start = css.indexOf("@media (max-width: 400px)");
  assert.notEqual(start, -1, "a <=400px header media query must exist");
  const block = css.slice(start, start + 300);
  assert.match(block, /\.brand small\s*\{\s*display:\s*none;?\s*\}/, "the subtitle must be dropped");
  assert.match(block, /\.brand-mark\s*\{[^}]*width:\s*24px/, "the icon must shrink to free up room for the hamburger");
});

test("v2/shared.css: .site-header still clips overflow (regression net for the fix above)", () => {
  // Sanity check that the premise still holds — if a future change removes
  // overflow:hidden from .site-header, the media-query workaround above may
  // no longer be the right fix and this test should be revisited.
  assert.match(css, /\.site-header\s*\{[^}]*overflow:\s*hidden/s);
});
