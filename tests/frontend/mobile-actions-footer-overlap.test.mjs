// Confirmed on a real render (wrangler pages dev + Chromium, contact.html at
// 320x568): .mobile-actions is a `position: fixed` Pray/Give bar pinned to
// the bottom of the viewport on every page ≤640px wide, but nothing reserved
// matching space at the bottom of the document. .site-footer only has
// 28px of bottom padding, while the fixed bar is roughly 64-98px tall
// (button height + its own padding + the home-indicator safe area on
// notched phones) — so the last ~30-70px of every page's footer (the
// copyright line, the last quick link) sat permanently behind the fixed
// bar, unreachable, on every phone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const css = readFileSync(path.join(REPO_ROOT, "v2", "shared.css"), "utf8");

test("v2/shared.css: the page reserves bottom space for the fixed mobile Pray/Give bar", () => {
  const markerStart = css.indexOf(".mobile-actions {\n    display: flex; position: fixed;");
  assert.notEqual(markerStart, -1, "the mobile sticky action bar ruleset must exist");
  // shared.css has several unrelated "@media (max-width: 640px)" blocks —
  // find the one that actually wraps .mobile-actions, not the first match.
  const start = css.lastIndexOf("@media (max-width: 640px)", markerStart);
  assert.notEqual(start, -1);
  const block = css.slice(start, markerStart + 1200);

  assert.match(block, /position:\s*fixed/, "the bar itself must still be fixed (premise of this test)");
  assert.match(block, /body\s*\{[^}]*padding-bottom:/,
    "body must reserve bottom padding at least as tall as the fixed bar, or footer content sits underneath it");
});
