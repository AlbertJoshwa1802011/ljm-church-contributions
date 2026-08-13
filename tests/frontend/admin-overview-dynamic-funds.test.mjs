// Regression test for the Admin Overview fund-reporting rework.
//
// The Overview KPI grid, monthly trend, fund-distribution chart, and recent-
// contributions table used to be wired directly to the two legacy system
// funds: two hardcoded fetches to /api/contributions?fund=tech-contributions
// and /api/contributions?fund=christmas-fund. A newly created fund (via the
// dynamic fund registry at /api/funds) would never show up in the Overview
// without a developer adding another hardcoded fetch/condition.
//
// loadOverview() now discovers funds from /api/funds (the registry) and
// fetches each fund's own contributions from /api/funds?slug=<slug> — so a
// new fund appears automatically. This test statically parses admin.html so
// a future regression that reintroduces a hardcoded fund slug into the
// Overview loader fails `npm test` instead of only surfacing when someone
// creates a third fund and notices Overview ignores it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

function extractFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start !== -1, `Expected to find "${signature}" in admin.html`);
  // Walk brace depth from the function's opening "{" to find its matching close.
  const openBrace = source.indexOf("{", start);
  let depth = 0, i = openBrace;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") { depth--; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

const loadOverview = extractFunctionBody(adminSource, "function loadOverview()");

test("Admin Overview: loadOverview() does not hardcode the legacy Tech/Christmas fund slugs", () => {
  assert.doesNotMatch(
    loadOverview,
    /tech-contributions|christmas-fund/,
    "loadOverview() must not reference specific fund slugs — it should discover funds dynamically from /api/funds"
  );
  assert.doesNotMatch(
    loadOverview,
    /["']Tech Fund["']|["']Christmas Fund["']/,
    "loadOverview() must not hardcode legacy fund display names"
  );
});

test("Admin Overview: loadOverview() discovers funds from the /api/funds registry", () => {
  assert.match(
    loadOverview,
    /api\(\s*["']\/api\/funds["']\s*\)/,
    "loadOverview() should call the dynamic fund registry listing endpoint"
  );
});

test("Admin Overview: loadOverview() fetches each discovered fund's own contributions dynamically (no fixed count of fetches)", () => {
  assert.match(
    loadOverview,
    /funds\.map\(\s*function\s*\(\s*f\s*\)/,
    "loadOverview() should iterate over the funds returned by /api/funds, not a fixed pair of fetches"
  );
  assert.match(
    loadOverview,
    /\/api\/funds\?slug=["'\s]*\+\s*encodeURIComponent\(\s*f\.slug\s*\)/,
    "loadOverview() should request each fund's detail by its own slug"
  );
});

test("Admin Overview: the fund-distribution chart is rendered from the dynamic funds list, not a hardcoded array", () => {
  assert.match(
    loadOverview,
    /renderDist\(\s*funds\s*\)/,
    "renderDist() should be called with the funds discovered from /api/funds"
  );
});

test("Admin Overview: KPI totals (spent/available) are summed across all discovered funds", () => {
  assert.match(
    loadOverview,
    /funds\.reduce\(\s*function\s*\(\s*s\s*,\s*f\s*\)\s*\{\s*return\s*s\s*\+\s*\(Number\(f\.spentOnProducts\)/,
    "spent-on-products KPI should sum spentOnProducts across every discovered fund"
  );
  assert.match(
    loadOverview,
    /funds\.reduce\(\s*function\s*\(\s*s\s*,\s*f\s*\)\s*\{\s*return\s*s\s*\+\s*\(Number\(f\.availableBalance\)/,
    "available-balance KPI should sum availableBalance across every discovered fund"
  );
});
