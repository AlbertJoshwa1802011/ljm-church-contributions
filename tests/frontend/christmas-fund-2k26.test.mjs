// Structural checks for the Christmas Fund 2025 rename + Christmas Fund 2k26
// listing. There is no jsdom harness — we parse source the same way
// tests/frontend/analytics-charts.test.mjs does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const fundsHtml = readFileSync(path.join(REPO_ROOT, "funds.html"), "utf8");
const script = readFileSync(path.join(REPO_ROOT, "script.js"), "utf8");

test("funds page: Christmas Fund 2k26 is a featured card with a New badge", () => {
  assert.match(fundsHtml, /Christmas Fund 2k26/);
  assert.match(fundsHtml, /fund-badge-new/);
  assert.match(fundsHtml, /openFund\('christmas-fund-2k26'\)/);
  assert.match(fundsHtml, /class="fund-card active featured"/);
});

test("funds page: 2025 is renamed and is not archived or payable from the card", () => {
  assert.match(fundsHtml, /Christmas Fund 2025/);
  assert.doesNotMatch(fundsHtml, /<h3>Christmas Fund<\/h3>/);
  assert.doesNotMatch(fundsHtml, /fund-status archived/);
  assert.match(fundsHtml, /openFund\('christmas-fund'\)/);
  assert.match(fundsHtml, /2025 season/);
});

test("funds page: Tech Fund card is unchanged", () => {
  assert.match(fundsHtml, /<h3>Tech Fund<\/h3>/);
  assert.match(fundsHtml, /openFund\('Tech Fund'\)/);
});

test("dashboard: 2k26 uses the Christmas renderer, not the Tech/dynamic path", () => {
  assert.match(script, /function identifySelectedFund\(/);
  assert.match(script, /kind: "xmas2k26"/);
  assert.match(script, /initChristmasFundDashboard\(\{/);
  assert.match(script, /slug: "christmas-fund-2k26"/);
  assert.match(script, /hidePayment: true/);
});
