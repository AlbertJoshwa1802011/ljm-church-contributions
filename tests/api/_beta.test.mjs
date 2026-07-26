// Direct unit tests for functions/api/_beta.js's cookie signing/verification —
// the trust boundary for the whole flag-gated "v2" flow, so it gets its own
// focused coverage beyond what beta-activate.test.mjs exercises indirectly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { signBetaCookie, verifyBetaCookie, parseCookies } from "../../functions/api/_beta.js";

const SECRET = "unit-test-secret";

test("_beta: a freshly signed cookie verifies back to the same email", async () => {
  const cookie = await signBetaCookie("someone@example.com", SECRET);
  const email = await verifyBetaCookie(cookie, SECRET);
  assert.equal(email, "someone@example.com");
});

test("_beta: verifying with the wrong secret fails closed", async () => {
  const cookie = await signBetaCookie("someone@example.com", SECRET);
  const email = await verifyBetaCookie(cookie, "a-different-secret");
  assert.equal(email, null);
});

test("_beta: a tampered payload (email swapped) fails signature verification", async () => {
  const cookie = await signBetaCookie("someone@example.com", SECRET);
  const [payloadB64, sigB64] = cookie.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ email: "attacker@example.com", exp: Date.now() + 100000 }))
    .toString("base64url");
  const tampered = tamperedPayload + "." + sigB64;
  const email = await verifyBetaCookie(tampered, SECRET);
  assert.equal(email, null);
});

test("_beta: an expired cookie fails verification even with a valid signature", async () => {
  const cookie = await signBetaCookie("someone@example.com", SECRET);
  const realNow = Date.now;
  try {
    // Jump 25 hours into the future — past the cookie's real 24h expiry —
    // to prove verification checks exp, not just the signature.
    Date.now = () => realNow() + 25 * 60 * 60 * 1000;
    const email = await verifyBetaCookie(cookie, SECRET);
    assert.equal(email, null);
  } finally {
    Date.now = realNow;
  }
});

test("_beta: malformed cookie values fail closed instead of throwing", async () => {
  assert.equal(await verifyBetaCookie("", SECRET), null);
  assert.equal(await verifyBetaCookie("not-a-valid-token", SECRET), null);
  assert.equal(await verifyBetaCookie("a.b.c", SECRET), null);
  assert.equal(await verifyBetaCookie(null, SECRET), null);
  assert.equal(await verifyBetaCookie("valid.looking", ""), null);
});

test("_beta: parseCookies reads a Cookie header into a plain object", () => {
  const parsed = parseCookies("ljm_beta=abc123; other=xyz; theme=dark");
  assert.equal(parsed.ljm_beta, "abc123");
  assert.equal(parsed.other, "xyz");
  assert.equal(parsed.theme, "dark");
});

test("_beta: parseCookies handles an empty/missing header", () => {
  assert.deepEqual(parseCookies(""), {});
  assert.deepEqual(parseCookies(undefined), {});
});
