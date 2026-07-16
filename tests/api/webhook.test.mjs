// Characterization tests for the Razorpay payment webhook — the MONEY-IN path.
// These lock in the current, correct behavior so future milestone work cannot
// silently break how real contributions are recorded. No network is used: the
// HMAC signature is computed locally and the background Google Sheets sync
// (context.waitUntil(fetch(...))) is stubbed out.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as webhook from "../../functions/api/webhook.js";

const SECRET = "whsec_test_secret";

// Stub global fetch so the async Sheets sync never leaves the test process.
let realFetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => "stubbed" });
});
after(() => { globalThis.fetch = realFetch; });

function sign(rawBody, secret = SECRET) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function makeWebhookContext(db, payloadObj, { signature, secret = SECRET } = {}) {
  const rawBody = JSON.stringify(payloadObj);
  const sig = signature ?? sign(rawBody, secret);
  const headers = new Map([["x-razorpay-signature", sig]]);
  return {
    env: { DB: db, RAZORPAY_WEBHOOK_SECRET: secret, GOOGLE_SHEETS_WEBAPP_URL: "" },
    request: {
      text: async () => rawBody,
      headers: { get: (k) => headers.get(k) ?? headers.get(k?.toLowerCase?.() ?? k) ?? null }
    },
    waitUntil: () => {}
  };
}

function capturedPayment(overrides = {}) {
  return {
    event: overrides.event || "payment.captured",
    payload: { payment: { entity: {
      id: overrides.id || "pay_TEST123",
      amount: overrides.amount ?? 50000, // paise → ₹500
      email: overrides.email || "giver@example.com",
      contact: overrides.contact || "+919999999999",
      method: overrides.method || "upi",
      vpa: overrides.vpa || "giver@okhdfcbank",
      created_at: overrides.created_at || 1_700_000_000,
      notes: overrides.notes || { memberName: "Test Giver", fundName: "tech-contributions", month: "July" }
    } } }
  };
}

async function readJson(res) { return JSON.parse(await res.text()); }

test("webhook: a captured payment is recorded once with the right amount, fund and proof_id", async () => {
  const db = freshDb();
  const res = await webhook.onRequestPost(makeWebhookContext(db, capturedPayment()));
  assert.equal(res.status, 200);
  assert.equal((await readJson(res)).status, "success");

  const rows = (await db.prepare("SELECT * FROM contributions").all()).results;
  assert.equal(rows.length, 1, "exactly one contribution row");
  const c = rows[0];
  assert.equal(c.proof_id, "pay_TEST123");
  assert.equal(c.amount, 500, "paise are converted to rupees");
  assert.equal(c.fund, "tech-contributions");
  assert.equal(c.category, "Online (Verified)");
  assert.equal(c.member_name, "Test Giver");
});

test("webhook: the same payment delivered twice is stored only once (idempotent by proof_id)", async () => {
  const db = freshDb();
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_DUP" })));
  const res2 = await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_DUP" })));
  assert.match((await readJson(res2)).message, /Duplicate/i);

  const n = (await db.prepare("SELECT COUNT(*) AS n FROM contributions").first()).n;
  assert.equal(n, 1, "duplicate delivery must not double-count a gift");
});

test("webhook: an invalid signature is rejected (400) and writes nothing", async () => {
  const db = freshDb();
  const res = await webhook.onRequestPost(makeWebhookContext(db, capturedPayment(), { signature: "deadbeef" }));
  assert.equal(res.status, 400);
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM contributions").first()).n;
  assert.equal(n, 0);
});

test("webhook: a non payment.captured event is acknowledged but writes nothing", async () => {
  const db = freshDb();
  const res = await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ event: "payment.authorized" })));
  assert.equal(res.status, 200);
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM contributions").first()).n;
  assert.equal(n, 0);
});

test("webhook: a first-time giver is auto-added to the members list", async () => {
  const db = freshDb();
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({
    id: "pay_M", notes: { memberName: "New Believer", fundName: "tech" }
  })));
  const m = await db.prepare("SELECT name FROM members WHERE name = ?").bind("New Believer").first();
  assert.ok(m, "a new giver becomes a member record");
});

test("webhook: fund names are normalized (christmas variants → christmas-fund, unknown → tech-contributions)", async () => {
  const db = freshDb();
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_X1", notes: { memberName: "A", fundName: "Christmas" } })));
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_X2", notes: { memberName: "B", fundName: "some-random-fund" } })));
  const x1 = await db.prepare("SELECT fund FROM contributions WHERE proof_id = ?").bind("pay_X1").first();
  const x2 = await db.prepare("SELECT fund FROM contributions WHERE proof_id = ?").bind("pay_X2").first();
  assert.equal(x1.fund, "christmas-fund");
  assert.equal(x2.fund, "tech-contributions");
});
