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

function loadFundDisplayName() {
  const start = source.indexOf("function fundDisplayName(");
  assert.notEqual(start, -1, "fundDisplayName() must exist in razorpay-checkout.js");
  const end = source.indexOf("\n}", start) + 2;
  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(start, end)}; return fundDisplayName;`)();
}

test("checkout: the fund label matches the fund, whatever casing ?fund= arrives in", () => {
  const fundDisplayName = loadFundDisplayName();

  for (const input of ["tech-contributions", "Tech Fund", "tech fund", "TECH", "techfund", "tech"]) {
    assert.equal(fundDisplayName(input), "Tech Fund", `"${input}" should display as Tech Fund`);
  }
  for (const input of ["christmas-fund", "Christmas Fund", "christmas fund", "CHRISTMAS", "christmasfund", "christmas"]) {
    assert.equal(fundDisplayName(input), "Christmas Fund", `"${input}" should display as Christmas Fund`);
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
