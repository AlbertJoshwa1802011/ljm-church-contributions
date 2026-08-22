// Regression test: our-giving.html and my-giving.html shipped with a
// stripped-down footer (just a copyright line + "Back to Home") while every
// other /v2/*.html page has the full footer-grid (Explore + Quick Links,
// including Contact and Prayer). Since neither page's top nav includes
// Contact or Prayer either, a visitor landing on Our Giving or My Giving had
// no way to reach Contact, Prayer, About, Programs, Youth, Blog,
// Testimonies, Watch, or even Give without going back to Home first.
//
// This statically confirms every v2 page's footer carries the shared
// footer-grid with links to the other main sections.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const V2_DIR = path.join(REPO_ROOT, "v2");

const REQUIRED_FOOTER_LINKS = [
  "/v2/contact.html",
  "/v2/prayer.html",
  "/v2/give-flow.html",
  "/v2/about.html",
  "/v2/programs.html",
  "/v2/blog.html",
  "/v2/testimonies.html",
  "/v2/watch.html"
];

test("v2/*.html: every page's footer links to Contact, Prayer, and the other main sections", () => {
  const files = readdirSync(V2_DIR).filter(f => f.endsWith(".html"));
  assert.ok(files.length > 0, "Expected to find .html files under v2/");

  const offenders = [];
  for (const file of files) {
    const source = readFileSync(path.join(V2_DIR, file), "utf8");
    const footerMatch = source.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
    assert.ok(footerMatch, `${file}: expected a <footer class="site-footer"> block`);
    const footer = footerMatch[0];
    for (const link of REQUIRED_FOOTER_LINKS) {
      if (!footer.includes(`href="${link}"`)) {
        offenders.push(`${file}: footer missing href="${link}"`);
      }
    }
  }

  assert.deepEqual(offenders, [], `Some v2 pages have an incomplete footer:\n${offenders.join("\n")}`);
});
