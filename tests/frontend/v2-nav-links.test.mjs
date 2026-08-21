// functions/_middleware.js only rewrites /events.html, /give-flow.html,
// /my-giving.html and /our-giving.html to their /v2/ equivalents when the
// request carries a *verified beta cookie* (see ROUTE_MAP in that file). But
// every v2/*.html page's own header/footer nav and CTAs linked to those same
// un-prefixed root paths. A real visitor who reaches any /v2/*.html page
// directly (documented as the intended, directly-reachable entry point for
// the Phase 0-5 ministry pages) almost never carries that cookie, so
// clicking "Give", "Events", "My Giving" or "Our Giving" fell through
// _middleware.js's next() to Cloudflare Pages' static-asset fallback, which
// silently served the *legacy* pre-v2 index.html (200 OK, no error) instead
// of the v2 page — a dead/wrong-destination link invisible to a status-code
// check, only visible by actually rendering the destination.
//
// Confirmed live via `wrangler pages dev`: GET /give-flow.html (no cookie)
// returned 200 with <title>LJM Church</title> (the legacy portal), not the
// v2 Give flow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const V2_DIR = path.join(REPO_ROOT, "v2");

const v2Pages = readdirSync(V2_DIR).filter((f) => f.endsWith(".html"));

// These are the only paths _middleware.js's ROUTE_MAP rewrites conditionally
// on a beta cookie. Every v2 page must link to their real, always-reachable
// /v2/ location instead, since v2 pages are directly reachable without a
// beta cookie.
const COOKIE_GATED_PATHS = ["/events.html", "/give-flow.html", "/my-giving.html", "/our-giving.html"];

test("v2 pages: no page links to a beta-cookie-gated root path (would 404 into the legacy homepage)", () => {
  assert.ok(v2Pages.length > 0, "expected to find v2/*.html pages");

  for (const page of v2Pages) {
    const source = readFileSync(path.join(V2_DIR, page), "utf8");
    for (const gated of COOKIE_GATED_PATHS) {
      assert.doesNotMatch(
        source,
        new RegExp(`href="${gated.replace(/[.]/g, "\\.")}"`),
        `${page} must not link to "${gated}" — use "/v2${gated}" instead, or it 404s into the legacy homepage for any visitor without a beta cookie`
      );
    }
  }
});

test("v2 pages: the give/events/my-giving/our-giving CTAs point at their real /v2/ pages", () => {
  const index = readFileSync(path.join(V2_DIR, "index.html"), "utf8");
  for (const gated of COOKIE_GATED_PATHS) {
    assert.match(
      index,
      new RegExp(`href="/v2${gated.replace(/[.]/g, "\\.")}"`),
      `v2/index.html should have at least one link to /v2${gated}`
    );
  }
});
