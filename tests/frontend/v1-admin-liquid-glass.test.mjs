// v1 portal + admin Liquid Glass (Apple iOS materials).
// Static source invariants — no browser. Must not change the frozen giving
// path, must not inject the v2 WhatsApp tab bar into admin, and must cover
// every public module that already loads theme.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const theme = readFileSync(path.join(REPO_ROOT, "theme.css"), "utf8");
const admin = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");
const v2css = readFileSync(path.join(REPO_ROOT, "v2", "shared.css"), "utf8");
const paymentModal = readFileSync(path.join(REPO_ROOT, "payment-modal.css"), "utf8");

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

function firstBlock(source, marker) {
  const idx = source.indexOf(marker);
  assert.ok(idx !== -1, `missing marker ${marker}`);
  const brace = source.indexOf("{", idx);
  const end = source.indexOf("}", brace);
  return source.slice(brace, end + 1);
}

test("theme.css: glass tokens exist in :root and [data-theme=dark]", () => {
  assert.match(theme, /:root\s*\{[^}]*--glass:/s);
  assert.match(theme, /:root\s*\{[^}]*--glass-strong:/s);
  assert.match(theme, /:root\s*\{[^}]*--glass-filter:/s);
  assert.match(theme, /:root\s*\{[^}]*--radius-capsule:/s);
  assert.match(theme, /\[data-theme="dark"\]\s*\{[\s\S]*--glass:/);
  assert.match(theme, /\[data-theme="dark"\]\s*\{[\s\S]*--glass-filter:/);
});

test("theme.css: reduced-transparency and missing backdrop-filter fall back to solid surface", () => {
  assert.match(theme, /prefers-reduced-transparency:\s*reduce/);
  assert.match(theme, /@supports not \(/);
  const reduced = theme.split("prefers-reduced-transparency")[1] || "";
  assert.match(reduced, /--glass:\s*var\(--surface\)/);
  assert.match(reduced, /--glass-filter:\s*none/);
});

test("theme.css and v2/shared.css keep the same light glass fill recipe", () => {
  const light = /--glass:\s*color-mix\(in srgb, var\(--surface\) 62%, transparent\)/;
  assert.match(theme, light);
  assert.match(v2css, light);
  const darkFill = /--glass:\s*color-mix\(in srgb, var\(--surface\) 78%, transparent\)/;
  assert.match(theme, darkFill);
  assert.match(v2css, darkFill);
});

test("theme.css: header is glass-strong and never clips fund/avatar menus", () => {
  const header = firstBlock(theme, ".ljm-header {");
  assert.match(header, /overflow:\s*visible/);
  assert.doesNotMatch(header, /overflow:\s*hidden/);
  assert.match(header, /background:\s*var\(--glass-strong\)/);
  assert.match(header, /backdrop-filter:\s*var\(--glass-filter\)/);
});

test("theme.css: KPI chips use --glass (not a solid --surface !important fill)", () => {
  const chip = firstBlock(theme, ".kpi-chip {");
  assert.match(chip, /background:\s*var\(--glass\)\s*!important/);
  assert.doesNotMatch(chip, /background:\s*var\(--surface\)\s*!important/);
  assert.match(chip, /backdrop-filter:\s*var\(--glass-filter\)/);
});

test("theme.css: mobile bottom-nav is a floating glass capsule", () => {
  assert.match(theme, /\.bottom-nav\s*\{[\s\S]*border-radius:\s*var\(--radius-capsule\)/);
  assert.match(theme, /\.bottom-nav\s*\{[\s\S]*background:\s*var\(--glass-strong\)/);
  assert.match(theme, /\.bottom-nav\s*\{[\s\S]*backdrop-filter:\s*var\(--glass-filter\)/);
  assert.doesNotMatch(
    theme,
    /\.bottom-nav\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255/,
    "bottom-nav must not use hardcoded white as its fill in theme.css"
  );
});

test("theme.css: public cards/chips inherit glass (covers members, impact, funds, events, about, subscriptions)", () => {
  const recipe = theme.slice(theme.indexOf("Liquid Glass surfaces"), theme.indexOf("Shared top header"));
  for (const cls of [
    ".member-card",
    ".fund-card",
    ".impact-total-card",
    ".product-card",
    ".about-card",
    ".subscriptions-kpi",
    ".contributor-card",
    ".chart-card",
  ]) {
    assert.ok(recipe.includes(cls), `glass recipe must include ${cls}`);
  }
  assert.match(theme, /\.chart-container\s*\{[\s\S]*backdrop-filter:\s*none/);
});

test("every live theme.css module still loads the shared stylesheet", () => {
  for (const page of THEME_PAGES) {
    const html = readFileSync(path.join(REPO_ROOT, page), "utf8");
    assert.match(html, /href="theme\.css"/, `${page} must load theme.css`);
  }
});

test("admin.html: chrome uses glass; tables stay opaque; no v2 tab bar", () => {
  assert.match(admin, /aside\s*\{[\s\S]*background:\s*var\(--glass-strong\)/);
  assert.match(admin, /\.card\s*\{[\s\S]*background:\s*var\(--glass\)/);
  assert.match(admin, /\.kpi\s*\{[\s\S]*background:\s*var\(--glass\)/);
  assert.match(admin, /#mobileNav\s*\{[\s\S]*border-radius:\s*var\(--radius-capsule\)/);
  assert.match(admin, /#mobileNav\s*\{[\s\S]*background:\s*var\(--glass-strong\)/);
  assert.match(admin, /\.table-wrap\s*\{[^}]*background:\s*var\(--surface\)/);
  assert.match(admin, /table\s*\{[^}]*background:\s*var\(--surface\)/);
  assert.doesNotMatch(admin, /tabbar\.js/, "admin must not load v2/tabbar.js");
  assert.doesNotMatch(admin, /class="tabbar"/);
});

test("payment-modal.css: give modal shell is glass; class names stay frozen", () => {
  assert.match(paymentModal, /\.premium-contrib-modal\s*\{[\s\S]*background:\s*var\(--glass-strong/);
  assert.match(paymentModal, /\.contrib-toggle/);
  assert.match(paymentModal, /\.amount-chip/);
});

test("frozen money path files are still the production handlers", () => {
  const webhook = readFileSync(path.join(REPO_ROOT, "functions", "api", "webhook.js"), "utf8");
  const checkout = readFileSync(path.join(REPO_ROOT, "razorpay-checkout.js"), "utf8");
  const contributions = readFileSync(path.join(REPO_ROOT, "functions", "api", "contributions.js"), "utf8");
  assert.match(webhook, /proof_id/);
  assert.match(checkout, /Razorpay/);
  assert.match(contributions, /availableBalance/);
});
