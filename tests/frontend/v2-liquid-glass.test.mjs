// v2 Liquid Glass + WhatsApp-style tab bar.
// Static source invariants — no browser. Must not change the frozen giving
// path or the hamburger/drawer IDs the existing header tests lock in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const css = readFileSync(path.join(REPO_ROOT, "v2", "shared.css"), "utf8");
const tabbar = readFileSync(path.join(REPO_ROOT, "v2", "tabbar.js"), "utf8");
const i18n = readFileSync(path.join(REPO_ROOT, "v2", "i18n.js"), "utf8");
const giveFlow = readFileSync(path.join(REPO_ROOT, "v2", "give-flow.html"), "utf8");
const v2Pages = readdirSync(path.join(REPO_ROOT, "v2")).filter((f) => f.endsWith(".html"));

function blockAfter(source, marker) {
  const idx = source.indexOf(marker);
  assert.ok(idx !== -1, `missing marker ${marker}`);
  return source.slice(idx, idx + 900);
}

test("v2 shared.css: glass tokens exist in light, dark-scheme, and both data-themes", () => {
  assert.match(css, /:root\s*\{[^}]*--glass:/s);
  assert.match(css, /:root\s*\{[^}]*--glass-strong:/s);
  assert.match(css, /:root\s*\{[^}]*--glass-filter:/s);
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[\s\S]*--glass:/);
  assert.match(css, /:root\[data-theme="dark"\]\s*\{[\s\S]*--glass:/);
  assert.match(css, /:root\[data-theme="light"\]\s*\{[\s\S]*--glass:/);
});

test("v2 shared.css: reduced-transparency and missing backdrop-filter fall back to solid surface", () => {
  assert.match(css, /prefers-reduced-transparency:\s*reduce/);
  assert.match(css, /@supports not \(/);
  const reduced = css.split("prefers-reduced-transparency")[1] || "";
  assert.match(reduced, /--glass:\s*var\(--surface\)/);
  assert.match(reduced, /--glass-filter:\s*none/);
});

test("v2 shared.css: header is floating glass and never clips the hamburger", () => {
  const header = css.match(/\.site-header\s*\{[^}]+\}/)[0];
  assert.match(header, /overflow:\s*visible/);
  assert.doesNotMatch(header, /overflow:\s*hidden/);
  assert.match(header, /backdrop-filter:\s*var\(--glass-filter\)/);
  assert.match(header, /-webkit-backdrop-filter:\s*var\(--glass-filter\)/);
  assert.match(header, /border-radius:\s*var\(--radius-capsule\)/);
});

test("v2 shared.css: WhatsApp-style tab bar is a fixed glass capsule", () => {
  const bar = blockAfter(css, ".tabbar {");
  assert.match(bar, /position:\s*fixed/);
  assert.match(bar, /backdrop-filter:\s*var\(--glass-filter\)/);
  assert.match(bar, /border-radius:\s*var\(--radius-capsule\)/);
  assert.match(css, /\.tabbar-item\s*\{[^}]*min-height:\s*44px/s);
});

test("v2 shared.css: legacy mobile-actions strip stays hidden so it cannot stack on the tab bar", () => {
  assert.match(css, /\.mobile-actions\s*\{[^}]*display:\s*none\s*!important/s);
});

test("v2 tabbar.js: Home / Events / Give / Pray / More, and More uses the existing drawer", () => {
  assert.match(tabbar, /href="\/"/);
  assert.match(tabbar, /href="\/v2\/events\.html"/);
  assert.match(tabbar, /href="\/v2\/give-flow\.html"/);
  assert.match(tabbar, /href="\/v2\/prayer\.html"/);
  assert.match(tabbar, /id="tabbarMore"/);
  assert.match(tabbar, /getElementById\("hamburgerBtn"\)/);
  assert.match(tabbar, /getElementById\("navDrawer"\)/);
  assert.doesNotMatch(tabbar, /\/api\/webhook/);
  assert.doesNotMatch(tabbar, /new Razorpay/);
});

test("v2 pages: every HTML page loads tabbar.js and keeps hamburger/drawer wiring", () => {
  assert.ok(v2Pages.length >= 10, "expected the full set of v2 html pages");
  for (const page of v2Pages) {
    const html = readFileSync(path.join(REPO_ROOT, "v2", page), "utf8");
    assert.match(html, /src="tabbar\.js"/, `${page} must load tabbar.js`);
    assert.match(html, /id="hamburgerBtn"/, `${page} must keep #hamburgerBtn`);
    assert.match(html, /id="navDrawer"/, `${page} must keep #navDrawer`);
    assert.doesNotMatch(html, /class="mobile-actions"/, `${page} must not keep the old mobile action strip`);
  }
});

test("v2 i18n: tab bar More label exists in English and Tamil", () => {
  assert.match(i18n, /"nav\.more":\s*"More"/);
  assert.match(i18n, /"nav\.more":\s*"மேலும்"/);
});

test("v2 give-flow: Razorpay checkout class names and script stay frozen", () => {
  assert.match(giveFlow, /src="\/razorpay-checkout\.js"/);
  assert.match(giveFlow, /insight-modal-visible/);
  assert.match(giveFlow, /id="proceedToPayBtn"/);
  assert.match(giveFlow, /class="contrib-toggle/);
  assert.match(giveFlow, /class="amount-chip"/);
  assert.match(giveFlow, /id="rzp-button1"/);
  assert.doesNotMatch(giveFlow, /functions\/api\/webhook/);
});

test("frozen money path files are still the production handlers", () => {
  const webhook = readFileSync(path.join(REPO_ROOT, "functions", "api", "webhook.js"), "utf8");
  const checkout = readFileSync(path.join(REPO_ROOT, "razorpay-checkout.js"), "utf8");
  const contributions = readFileSync(path.join(REPO_ROOT, "functions", "api", "contributions.js"), "utf8");
  assert.match(webhook, /proof_id/);
  assert.match(checkout, /Razorpay/);
  assert.match(contributions, /availableBalance/);
});
