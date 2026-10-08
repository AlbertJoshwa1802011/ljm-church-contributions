// The Razorpay checkout screen showed the wrong fund name to every tech-fund
// payer: `fundName.includes("tech")` is case-sensitive, and ?fund= arrives as
// "Tech Fund" as often as "tech-contributions", so the test returned false and
// the description read "Contribution towards Christmas Fund" on a Tech Fund
// gift. Confirmed on a real payment (pay_TKUwMs3w4mHmNs: notes said
// fundName "Tech Fund", the payer was shown "Christmas Fund").
//
// razorpay-checkout.js is a plain browser script with no build step and no
// exports, so the helper is extracted from source and evaluated here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "razorpay-checkout.js"), "utf8");

function loadCheckoutHelpers() {
  const start = source.indexOf("function compactFundKey(");
  assert.notEqual(start, -1, "compactFundKey() must exist in razorpay-checkout.js");
  const end = source.indexOf("function isClosedChristmas2025(");
  assert.notEqual(end, -1, "isClosedChristmas2025() must exist");
  const closeEnd = source.indexOf("\n}", end) + 2;
  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(start, closeEnd)}; return { fundDisplayName, canonicalFundSlug, isClosedChristmas2025, isChristmas2k26Fund };`)();
}

function loadFundDisplayName() {
  return loadCheckoutHelpers().fundDisplayName;
}

test("checkout: the fund label matches the fund, whatever casing ?fund= arrives in", () => {
  const fundDisplayName = loadFundDisplayName();

  for (const input of ["tech-contributions", "Tech Fund", "tech fund", "TECH", "techfund", "tech"]) {
    assert.equal(fundDisplayName(input), "Tech Fund", `"${input}" should display as Tech Fund`);
  }
  for (const input of ["christmas-fund", "Christmas Fund", "christmas fund", "CHRISTMAS", "christmasfund", "christmas", "Christmas Fund 2025"]) {
    assert.equal(fundDisplayName(input), "Christmas Fund 2025", `"${input}" should display as Christmas Fund 2025`);
  }
  for (const input of ["christmas-fund-2k26", "Christmas Fund 2k26", "Christmas 2k26 fund", "christmas2k26"]) {
    assert.equal(fundDisplayName(input), "Christmas 2k26 fund", `"${input}" should display as Christmas 2k26 fund`);
  }
});

test("checkout: 'Tech Fund' is the exact regression case from pay_TKUwMs3w4mHmNs", () => {
  const fundDisplayName = loadFundDisplayName();
  assert.equal(fundDisplayName("Tech Fund"), "Tech Fund",
    'the real payment carried notes.fundName "Tech Fund" and was shown "Christmas Fund"');
});

test("checkout: unknown or missing fund falls back to Tech Fund, matching webhook.js", () => {
  const fundDisplayName = loadFundDisplayName();
  for (const input of ["", null, undefined, "something-else"]) {
    assert.equal(fundDisplayName(input), "Tech Fund");
  }
});

test("checkout: the description is built from fundDisplayName, not an inline case-sensitive test", () => {
  assert.match(source, /"description":\s*"Contribution towards "\s*\+\s*fundDisplayName\(fundName\)/,
    "the description must route through the shared helper");
  assert.doesNotMatch(source, /fundName\.includes\("tech"\)/,
    "the case-sensitive .includes() check must not come back");
});

test("checkout: Razorpay notes.fundName is the canonical slug so the webhook cannot mis-file 2k26 as Tech", () => {
  assert.match(source, /const fundName = canonicalFundSlug\(getFundContext\(\)\)/);
  assert.match(source, /"fundName": fundName/);
});

test("checkout: Christmas Fund 2025 is closed for new payments; 2k26 is open", () => {
  const { isClosedChristmas2025, isChristmas2k26Fund } = loadCheckoutHelpers();
  assert.equal(isClosedChristmas2025("christmas-fund"), true);
  assert.equal(isClosedChristmas2025("Christmas Fund 2025"), true);
  assert.equal(isClosedChristmas2025("christmas-fund-2k26"), false);
  assert.equal(isChristmas2k26Fund("Christmas Fund 2k26"), true);
  assert.equal(isChristmas2k26Fund("Tech Fund"), false);
  assert.match(source, /dataset\.paymentsClosed/);
});
