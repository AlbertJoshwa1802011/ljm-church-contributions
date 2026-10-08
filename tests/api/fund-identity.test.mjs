import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalFundSlug,
  normalizeFundForWrite,
  fundLedgerName,
  fundPaymentNote,
  FUND_TECH,
  FUND_XMAS_2025,
  FUND_XMAS_2K26
} from "../../functions/api/_fund.js";

test("fund identity: 2k26 aliases never collapse into the 2025 ledger or Tech", () => {
  for (const input of ["christmas-fund-2k26", "Christmas Fund 2k26", "Christmas 2k26 fund", "christmas2k26"]) {
    assert.equal(canonicalFundSlug(input), FUND_XMAS_2K26, input);
  }
});

test("fund identity: 2025 / historical Christmas aliases stay on christmas-fund", () => {
  for (const input of ["christmas", "Christmas Fund", "christmas-fund", "Christmas Fund 2025"]) {
    assert.equal(canonicalFundSlug(input), FUND_XMAS_2025, input);
  }
});

test("fund identity: Tech aliases and unknown notes still map to Tech (webhook contract)", () => {
  assert.equal(canonicalFundSlug("Tech Fund"), FUND_TECH);
  assert.equal(canonicalFundSlug("something-else"), FUND_TECH);
  assert.equal(canonicalFundSlug(""), FUND_TECH);
});

test("fund identity: admin writes keep custom fund slugs", () => {
  assert.equal(normalizeFundForWrite("building-fund"), "building-fund");
  assert.equal(normalizeFundForWrite("Christmas Fund 2k26"), FUND_XMAS_2K26);
});

test("fund identity: payment note for 2k26 is the Google Pay wording", () => {
  assert.equal(fundPaymentNote("christmas-fund-2k26"), "Christmas 2k26 fund");
  assert.equal(fundLedgerName("christmas-fund-2k26"), "Christmas Fund 2k26");
  assert.equal(fundLedgerName("christmas-fund"), "Christmas Fund 2025");
});
