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
import vm from "node:vm";

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

// Regression guard: Admin Overview intentionally includes archived funds in
// its totals — /api/funds returns archived funds to an authenticated admin
// caller (only "deleted" funds are excluded server-side), and loadOverview()
// sums over whatever /api/funds hands back with no client-side status
// filter. This is deliberate: an admin auditing "how much has this fund ever
// raised" should still see an archived fund's history. Do not "fix" this by
// adding a status filter without a product decision to change it — this test
// exists so that change is a visible, deliberate diff instead of an
// accidental regression.
test("Admin Overview (regression guard): loadOverview() does not filter funds by status — archived funds stay in the totals", () => {
  assert.doesNotMatch(
    loadOverview,
    /\.filter\(\s*function\s*\([^)]*\)\s*\{[^}]*status/s,
    "loadOverview() must not filter the funds/contributions list by status — archived funds are intentionally included in Overview totals"
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Behavioral coverage below: computeMonthlyGiving() and api() are pure
// enough (no DOM) to extract from admin.html's inline <script> and execute
// for real in a vm sandbox — so these assert actual computed output, not
// just "the source text looks right" the way the structural tests above do.
// ─────────────────────────────────────────────────────────────────────────

function extractFunctionSource(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start !== -1, `Expected to find "${signature}" in admin.html`);
  const openBrace = source.indexOf("{", start);
  let depth = 0, i = openBrace;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") { depth--; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

const computeMonthlyGivingSrc = extractFunctionSource(adminSource, "function computeMonthlyGiving(contributions, now)");

function loadComputeMonthlyGiving() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`var computeMonthlyGiving = ${computeMonthlyGivingSrc};`, sandbox);
  return sandbox.computeMonthlyGiving;
}

test("Admin Overview (behavioral): computeMonthlyGiving() buckets current vs. previous month and computes growthPct", () => {
  const computeMonthlyGiving = loadComputeMonthlyGiving();
  const now = new Date(2026, 7, 14); // 14 Aug 2026
  const contributions = [
    { Date: "2026-08-01", Amount: 100 },
    { Date: "2026-08-10", Amount: "50" }, // string amount, like a raw API value
    { Date: "2026-07-15", Amount: 200 },
    { Date: "2026-06-01", Amount: 999 }, // two months back — must not count either bucket
  ];

  const result = computeMonthlyGiving(contributions, now);

  assert.equal(result.thisMonth, 150, "August contributions should sum to 150");
  assert.equal(result.lastMonth, 200, "July contributions should sum to 200, June excluded");
  assert.equal(result.growthPct, -25, "(150-200)/200 rounded is -25%");
});

test("Admin Overview (behavioral): computeMonthlyGiving() handles the December → January year wrap", () => {
  const computeMonthlyGiving = loadComputeMonthlyGiving();
  const now = new Date(2026, 0, 5); // 5 Jan 2026
  const contributions = [
    { Date: "2026-01-02", Amount: 10 },
    { Date: "2025-12-31", Amount: 15 },
    { Date: "2025-12-01", Amount: 5 },
    { Date: "2025-11-30", Amount: 1000 }, // two months back across the year boundary — excluded
  ];

  const result = computeMonthlyGiving(contributions, now);

  assert.equal(result.thisMonth, 10, "January contributions should sum to 10");
  assert.equal(result.lastMonth, 20, "December (previous year) contributions should sum to 20");
});

test("Admin Overview (behavioral): computeMonthlyGiving() returns growthPct null when there's no prior-month baseline", () => {
  const computeMonthlyGiving = loadComputeMonthlyGiving();
  const now = new Date(2026, 7, 14);
  const result = computeMonthlyGiving([{ Date: "2026-08-01", Amount: 500 }], now);

  assert.equal(result.lastMonth, 0);
  assert.equal(result.growthPct, null, "growthPct must be null (not divide-by-zero) when last month had no giving");
});

test("Admin Overview (behavioral): computeMonthlyGiving() ignores unparsable dates instead of corrupting a bucket", () => {
  const computeMonthlyGiving = loadComputeMonthlyGiving();
  const now = new Date(2026, 7, 14);
  const result = computeMonthlyGiving([
    { Date: "not-a-date", Amount: 500 },
    { Date: "2026-08-01", Amount: 100 },
  ], now);

  assert.equal(result.thisMonth, 100, "an unparsable date must not be added to any bucket");
});

test("Admin Overview: loadOverview() delegates month/growth math to the extracted computeMonthlyGiving() helper", () => {
  assert.match(
    loadOverview,
    /computeMonthlyGiving\(\s*all\s*,\s*new Date\(\)\s*\)/,
    "loadOverview() should call computeMonthlyGiving(all, new Date()) rather than re-implementing the bucketing inline"
  );
});

// ─────────────────────────────────────────────────────────────────────────
// api() failure-mode hardening: an earlier version resolved with r.json()
// for ANY response, 401 aside — so a 500 from /api/funds (e.g. a D1 outage)
// was handed to loadOverview()'s .then() as if it were a normal payload.
// `{error: "..."}` has no `.funds` array, so `(fundsRes && fundsRes.funds)
// || []` silently became `[]` — a real backend failure rendered as an
// honest-looking empty/zero dashboard instead of a visible error. api() now
// rejects on any non-2xx (401 aside, which already had its own gate-redirect
// handling), which routes the failure into the existing .catch() error UI.
// ─────────────────────────────────────────────────────────────────────────

const apiSrc = extractFunctionSource(adminSource, "function api(path, opts)");

function loadApi(fetchImpl) {
  const sandbox = {
    state: { token: null },
    TOKEN_KEY: "ljm_admin_token",
    sessionStorage: { removeItem() {} },
    fetch: fetchImpl,
    Object,
  };
  vm.createContext(sandbox);
  vm.runInContext(`var api = ${apiSrc};`, sandbox);
  return sandbox.api;
}

test("Admin Overview (behavioral): api() rejects on a 500 response instead of resolving with the error body as data", async () => {
  const api = loadApi(async () => ({
    status: 500,
    ok: false,
    json: async () => ({ error: "D1 database binding missing" }),
  }));

  await assert.rejects(
    () => api("/api/funds"),
    (err) => {
      assert.match(err.message, /D1 database binding missing/, "the thrown error should carry the server's failure message");
      return true;
    }
  );
});

test("Admin Overview (behavioral): api() rejects a 400 with the server's message, preserving prior error-message behavior", async () => {
  const api = loadApi(async () => ({
    status: 400,
    ok: false,
    json: async () => ({ success: false, message: "No editable fields provided" }),
  }));

  await assert.rejects(
    () => api("/api/funds", { method: "PUT" }),
    /No editable fields provided/
  );
});

test("Admin Overview (behavioral): api() still resolves normally with the parsed body on a 200", async () => {
  const api = loadApi(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ funds: [{ slug: "tech-contributions" }] }),
  }));

  const result = await api("/api/funds");
  assert.deepEqual(result, { funds: [{ slug: "tech-contributions" }] });
});
