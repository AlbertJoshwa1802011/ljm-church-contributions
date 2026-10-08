// Structural invariants for the premium navy/gold contribution portal.
// No jsdom — parse source the same way analytics-charts.test.mjs does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const theme = readFileSync(path.join(REPO_ROOT, "theme.css"), "utf8");
const premium = readFileSync(path.join(REPO_ROOT, "premium.css"), "utf8");
const index = readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
const script = readFileSync(path.join(REPO_ROOT, "script.js"), "utf8");
const checkout = readFileSync(path.join(REPO_ROOT, "razorpay-checkout.js"), "utf8");
const webhook = readFileSync(path.join(REPO_ROOT, "functions", "api", "webhook.js"), "utf8");
const contributions = readFileSync(path.join(REPO_ROOT, "functions", "api", "contributions.js"), "utf8");

const THEME_PAGES = [
  "index.html",
  "members.html",
  "member.html",
  "impact.html",
  "funds.html",
  "events.html",
  "about.html",
  "subscriptions.html",
  "admin.html",
];

test("theme.css: premium navy/gold tokens exist in :root and dark", () => {
  assert.match(theme, /:root\s*\{[\s\S]*--gold:\s*#F6C453/);
  assert.match(theme, /:root\s*\{[\s\S]*--cta-gradient:/);
  assert.match(theme, /:root\s*\{[\s\S]*--hero-gradient:/);
  assert.match(theme, /Plus Jakarta Sans/);
  assert.match(theme, /\[data-theme="dark"\]\s*\{[\s\S]*--bg:\s*#07111F/);
  assert.match(theme, /\[data-theme="dark"\]\s*\{[\s\S]*--surface:\s*#0E2035/);
  assert.match(theme, /\[data-theme="dark"\]\s*\{[\s\S]*--gold:\s*#F6C453/);
});

test("every live theme.css module also loads premium.css", () => {
  for (const page of THEME_PAGES) {
    const html = readFileSync(path.join(REPO_ROOT, page), "utf8");
    assert.match(html, /href="premium\.css"/, `${page} must load premium.css`);
  }
});

test("home dashboard: hero, personal summary, and success modal exist without removing fund IDs", () => {
  assert.match(index, /id="ljmHero"/);
  assert.match(index, /id="ljmPublicHero"/);
  assert.match(index, /id="ljmPersonalSummary"/);
  assert.match(index, /id="ljmSuccessModal"/);
  assert.match(index, /id="rzp-button1"/);
  assert.match(index, /id="contributionModal"/);
  assert.match(index, /id="fundHeading"/);
  assert.match(index, /id="totalAmount"/);
  assert.match(index, /id="heroGreeting"/);
  assert.match(index, /id="categoryPieChart"/);
});

test("script.js: premium renderers are defined and paintPremiumHome isolates failures", () => {
  assert.match(script, /function renderPersonalSummary\s*\(/);
  assert.match(script, /function renderPublicHero\s*\(/);
  assert.match(script, /function paintPremiumHome\s*\(/);
  assert.match(script, /function showContributionSuccess\s*\(/);
  const paint = script.slice(script.indexOf("function paintPremiumHome"), script.indexOf("function showContributionSuccess"));
  assert.match(paint, /try\s*\{[\s\S]*renderPublicHero\(\)/);
  assert.match(paint, /try\s*\{[\s\S]*renderHeroGreeting\(\)/);
  assert.match(paint, /try\s*\{[\s\S]*renderPersonalSummary/);
});

test("checkout: success UI is used without removing Razorpay or the alert fallback", () => {
  assert.match(checkout, /showContributionSuccess/);
  assert.match(checkout, /new Razorpay/);
  assert.match(checkout, /alert\("Thank you! Payment successful/);
  assert.match(webhook, /proof_id/);
  assert.match(contributions, /availableBalance/);
});

test("premium.css: gold is the CTA, not the whole surface", () => {
  assert.match(premium, /\.btn-gold/);
  assert.match(premium, /--cta-gradient/);
  assert.doesNotMatch(premium, /background:\s*#F6C453\s*!important;\s*body/);
  assert.match(premium, /\.ljm-hero/);
  assert.match(premium, /\.ljm-success-card/);
});
