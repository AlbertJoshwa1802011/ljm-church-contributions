// Structural + helper checks for the Funds page and Christmas Fund 2k26
// dashboard. There is no jsdom harness — we parse source the same way
// tests/frontend/analytics-charts.test.mjs does, and eval the small identity
// helpers the same way tests/frontend/razorpay-fund-label.test.mjs does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const fundsHtml = readFileSync(path.join(REPO_ROOT, "funds.html"), "utf8");
const script = readFileSync(path.join(REPO_ROOT, "script.js"), "utf8");
const header = readFileSync(path.join(REPO_ROOT, "header.js"), "utf8");
const css = readFileSync(path.join(REPO_ROOT, "style.css"), "utf8");
const checkout = readFileSync(path.join(REPO_ROOT, "razorpay-checkout.js"), "utf8");
const migration = readFileSync(path.join(REPO_ROOT, "migrations/0023_christmas_fund_2k26.sql"), "utf8");

function loadScriptHelpers() {
  const start = script.indexOf("function identifySelectedFund(");
  assert.notEqual(start, -1, "identifySelectedFund() must exist in script.js");
  const end = script.indexOf("\nasync function preloadMembersList", start);
  assert.notEqual(end, -1, "preloadMembersList must follow the Christmas helpers");
  // eslint-disable-next-line no-new-func
  return new Function(`${script.slice(start, end)}; return { identifySelectedFund, christmasDashboardConfig };`)();
}

test("funds page: Christmas Fund 2k26 is a featured card with a New badge", () => {
  assert.match(fundsHtml, /<h3>Christmas Fund 2k26<\/h3>/);
  assert.match(fundsHtml, /<span class="fund-badge-new">New<\/span>/);
  assert.match(fundsHtml, /openFund\('christmas-fund-2k26'\)/);
  assert.match(fundsHtml, /class="fund-card active featured"/);
  assert.match(fundsHtml, /Give now →/);
  assert.match(fundsHtml, /Oct · Nov · Dec/);
  assert.match(fundsHtml, /Active this season/);
});

test("funds page: 2025 is renamed, view-only, and not archived", () => {
  assert.match(fundsHtml, /<h3>Christmas Fund 2025<\/h3>/);
  assert.doesNotMatch(fundsHtml, /<h3>Christmas Fund<\/h3>/);
  assert.doesNotMatch(fundsHtml, /fund-status archived/);
  assert.doesNotMatch(fundsHtml, /class="fund-card archived"/);
  assert.match(fundsHtml, /openFund\('christmas-fund'\)/);
  assert.match(fundsHtml, /fund-status past/);
  assert.match(fundsHtml, /2025 season/);
  assert.match(fundsHtml, /View history →/);
});

test("funds page: Tech Fund card is unchanged", () => {
  assert.match(fundsHtml, /<h3>Tech Fund<\/h3>/);
  assert.match(fundsHtml, /openFund\('Tech Fund'\)/);
  assert.match(fundsHtml, /View Fund →/);
});

test("funds page: 2k26 is listed after Tech and before the 2025 history card", () => {
  const tech = fundsHtml.indexOf("<h3>Tech Fund</h3>");
  const x26 = fundsHtml.indexOf("<h3>Christmas Fund 2k26</h3>");
  const x25 = fundsHtml.indexOf("<h3>Christmas Fund 2025</h3>");
  assert.ok(tech !== -1 && x26 !== -1 && x25 !== -1);
  assert.ok(tech < x26 && x26 < x25, "order must be Tech → 2k26 (new) → 2025 (history)");
});

test("funds page: dynamic append skips the three system slugs so cards are not duplicated", () => {
  assert.match(fundsHtml, /f\.slug !== "christmas-fund-2k26"/);
  assert.match(fundsHtml, /f\.slug !== "christmas-fund"/);
  assert.match(fundsHtml, /f\.slug !== "tech-contributions"/);
  assert.match(fundsHtml, /!f\.isSystem/);
});

test("funds page CSS: New badge, featured card, and 2025 past-season chip exist", () => {
  assert.match(css, /\.fund-badge-new\s*\{/);
  assert.match(css, /\.fund-card\.featured\s*\{/);
  assert.match(css, /\.fund-status\.past\s*\{/);
  assert.match(css, /\.fund-closed-note/);
});

test("identifySelectedFund: 2k26 aliases never land on Tech or 2025", () => {
  const { identifySelectedFund } = loadScriptHelpers();
  for (const input of [
    "christmas-fund-2k26", "Christmas Fund 2k26", "Christmas 2k26 fund",
    "christmas2k26", "christmasfund2k26"
  ]) {
    const ident = identifySelectedFund(input);
    assert.equal(ident.kind, "xmas2k26", input);
    assert.equal(ident.slug, "christmas-fund-2k26", input);
    assert.equal(ident.cacheKey, "christmasFund2k26Data", input);
  }
});

test("identifySelectedFund: 2025 aliases stay on the historical ledger; Tech is untouched", () => {
  const { identifySelectedFund } = loadScriptHelpers();
  for (const input of ["christmas", "christmas-fund", "Christmas Fund", "Christmas Fund 2025"]) {
    const ident = identifySelectedFund(input);
    assert.equal(ident.kind, "xmas2025", input);
    assert.equal(ident.slug, "christmas-fund", input);
  }
  const tech = identifySelectedFund("Tech Fund");
  assert.equal(tech.kind, "tech");
  assert.equal(tech.slug, "tech-contributions");
  assert.equal(tech.cacheKey, "techFundData");
});

test("christmasDashboardConfig: 2k26 is payable; 2025 hides payment", () => {
  const { christmasDashboardConfig } = loadScriptHelpers();
  const live = christmasDashboardConfig("xmas2k26");
  assert.equal(live.slug, "christmas-fund-2k26");
  assert.equal(live.hidePayment, undefined);
  assert.match(live.heading, /Christmas Fund 2k26/);
  const past = christmasDashboardConfig("xmas2025");
  assert.equal(past.slug, "christmas-fund");
  assert.equal(past.hidePayment, true);
  assert.match(past.heading, /Christmas Fund 2025/);
  assert.equal(christmasDashboardConfig("tech"), null);
});

test("dashboard: silent refresh reuses christmasDashboardConfig so 2k26 cannot fall through to Tech", () => {
  assert.match(script, /christmasDashboardConfig\(ident\.kind\)/);
  assert.doesNotMatch(
    script.slice(script.indexOf("async function silentBackgroundRefresh")),
    /if \(selectedFund === 'christmasfund'\)[\s\S]{0,80}initChristmasFundDashboard\(\)/
  );
});

test("header: New badge and Give-from-2025 redirect to 2k26", () => {
  assert.match(header, /f\.slug === "christmas-fund-2k26"[\s\S]{0,80}ljmh-fund-new/);
  assert.match(header, /location\.assign\("index\.html\?fund=christmas-fund-2k26"\)/);
  assert.match(header, /name: "Christmas Fund 2k26"/);
  assert.match(header, /name: "Christmas Fund 2025"/);
});

test("checkout: 2k26 Google Pay note and Oct–Nov–Dec season months", () => {
  assert.match(checkout, /return "Christmas 2k26 fund"/);
  assert.match(checkout, /\["October", "November", "December"\]/);
  assert.match(checkout, /isClosedChristmas2025\(getFundContext\(\)\)/);
});

test("migration 0023 is additive: rename display only, insert 2k26, never drop", () => {
  assert.match(migration, /UPDATE funds[\s\S]*name = 'Christmas Fund 2025'[\s\S]*WHERE slug = 'christmas-fund'/);
  assert.match(migration, /INSERT OR IGNORE INTO funds[\s\S]*christmas-fund-2k26/);
  assert.match(migration, /christmas_2k26_goal_amount/);
  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(migration, /\bALTER TABLE\b/i);
});
