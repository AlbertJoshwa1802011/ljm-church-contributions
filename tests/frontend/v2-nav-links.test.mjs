// Regression test for a real, site-wide bug found in the LJM V2 journey-
// breaker session: every /v2/*.html page's header nav, mobile drawer, footer
// "Quick Links", and every inline "Give"/"Our Giving"/"My Giving"/"Events"
// call-to-action linked to the OLD root-level paths (/give-flow.html,
// /our-giving.html, /my-giving.html, /events.html) instead of the real v2
// pages that actually ship that content (/v2/give-flow.html etc).
//
// functions/_middleware.js only rewrites those old root paths to their /v2/
// equivalent for a visitor holding a verified beta cookie — everyone else
// falls through to next(), and since no legacy page exists at those exact
// root paths, they hit the site's catch-all 404. Since /v2/*.html pages are
// directly reachable (not beta-gated — see docs/milestone-v2/12-phase-0-5-
// implementation-status.md), this broke the single most important
// call-to-action on a giving portal — the "Give" button — for every ordinary
// visitor on every new public page, while the very same nav bar correctly
// used /v2/ prefixes for its other links (watch, prayer, contact, etc.),
// which is what made this a clear oversight rather than intended routing.
//
// This statically scans every v2/*.html file's `href="..."` attributes for
// the old un-prefixed targets and fails if any reappear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const V2_DIR = path.join(REPO_ROOT, "v2");

const BETA_GATED_OLD_PATHS = ["give-flow.html", "our-giving.html", "my-giving.html", "events.html"];

test("v2/*.html: no page links to a beta-gated old root path instead of its real /v2/ page (regression)", () => {
  const files = readdirSync(V2_DIR).filter(f => f.endsWith(".html"));
  assert.ok(files.length > 0, "Expected to find .html files under v2/");

  const offenders = [];
  for (const file of files) {
    const source = readFileSync(path.join(V2_DIR, file), "utf8");
    for (const oldPath of BETA_GATED_OLD_PATHS) {
      // Un-prefixed href pointing at the old path, NOT preceded by "/v2/".
      const re = new RegExp(`href="/${oldPath.replace(".", "\\.")}"`, "g");
      let m;
      while ((m = re.exec(source))) {
        offenders.push(`${file}: href="/${oldPath}" (should be href="/v2/${oldPath}")`);
      }
    }
  }

  assert.deepEqual(offenders, [], `Found broken links to beta-gated old paths:\n${offenders.join("\n")}`);
});
