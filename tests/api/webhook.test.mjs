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

// ── Timestamps are stored in IST ──────────────────────────────────────────
// The handler used to store UTC while every other row in `contributions` came
// from the Google Sheet in IST. It went unnoticed because the webhook had never
// been successfully delivered in production (the only registered Razorpay
// webhook pointed at the Apps Script URL), so the first real delivery would
// have started mixing two timezones in one ledger — a 17:31 gift rendering as
// 12:01 on the public portal.

test("webhook: the contribution timestamp is stored in IST, not UTC", async () => {
  const db = freshDb();
  // 1700000000 -> 2023-11-14 22:13:20 UTC -> 2023-11-15 03:43:20 IST
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_TZ1", created_at: 1_700_000_000 })));
  const c = await db.prepare("SELECT date FROM contributions WHERE proof_id = 'pay_TZ1'").first();

  assert.equal(c.date, "2023-11-15 03:43:20", "created_at must be rendered in IST (UTC+05:30)");
  assert.notEqual(c.date, "2023-11-14 22:13:20", "storing UTC would put the gift 5h30m before it happened");
});

test("webhook: a real captured payment lands on the timestamp the sheet and Razorpay show", async () => {
  const db = freshDb();
  // pay_TKUwMs3w4mHmNs — Razorpay dashboard and the Google Sheet both show
  // 2026-08-01 17:31:15 IST for this payment.
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_TKUwMs3w4mHmNs", created_at: 1_785_585_675 })));
  const c = await db.prepare("SELECT date FROM contributions WHERE proof_id = 'pay_TKUwMs3w4mHmNs'").first();
  assert.equal(c.date, "2026-08-01 17:31:15");
});

test("webhook: IST conversion does not disturb the date part when the payment is mid-day UTC", async () => {
  const db = freshDb();
  // 2026-08-02 02:34:20 UTC -> same calendar day in IST, 08:04:20
  await webhook.onRequestPost(makeWebhookContext(db, capturedPayment({ id: "pay_TZ2", created_at: 1_785_638_060 })));
  const c = await db.prepare("SELECT date FROM contributions WHERE proof_id = 'pay_TZ2'").first();
  assert.equal(c.date, "2026-08-02 08:04:20");
});

// ── The Google Sheets forward is opt-in ───────────────────────────────────
// It used to fall back to a hardcoded Apps Script deployment whenever
// GOOGLE_SHEETS_WEBAPP_URL was unset or empty, which meant the forward could
// not be disabled by configuration, and the hardcoded URL pointed at a
// different (stale) deployment than the one actually serving the sheet.
// With Razorpay delivering to the Apps Script webhook directly, forwarding here
// as well would write every gift into the sheet twice.

function withFetchRecorder(fn) {
  return async () => {
    const saved = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return { ok: true, text: async () => "ok" }; };
    try { await fn(calls); } finally { globalThis.fetch = saved; }
  };
}

test("webhook: no Sheets forward happens when GOOGLE_SHEETS_WEBAPP_URL is unset", withFetchRecorder(async (calls) => {
  const db = freshDb();
  const ctx = makeWebhookContext(db, capturedPayment({ id: "pay_NOFWD" }));
  delete ctx.env.GOOGLE_SHEETS_WEBAPP_URL;
  ctx.waitUntil = (p) => p;
  const res = await webhook.onRequestPost(ctx);

  assert.equal(res.status, 200, "the payment is still recorded");
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM contributions").first()).n, 1);
  assert.deepEqual(calls, [], "an unset URL must mean no outbound request at all — not a hardcoded fallback");
}));

test("webhook: an empty GOOGLE_SHEETS_WEBAPP_URL also disables the forward", withFetchRecorder(async (calls) => {
  const db = freshDb();
  const ctx = makeWebhookContext(db, capturedPayment({ id: "pay_EMPTYFWD" }));
  ctx.env.GOOGLE_SHEETS_WEBAPP_URL = "";
  ctx.waitUntil = (p) => p;
  await webhook.onRequestPost(ctx);
  assert.deepEqual(calls, [], "empty string must disable the forward, so the sheet is not written twice");
}));

test("webhook: no request is ever made to a hardcoded script.google.com deployment", withFetchRecorder(async (calls) => {
  const db = freshDb();
  const ctx = makeWebhookContext(db, capturedPayment({ id: "pay_NOHARDCODE" }));
  delete ctx.env.GOOGLE_SHEETS_WEBAPP_URL;
  ctx.waitUntil = (p) => p;
  await webhook.onRequestPost(ctx);

  const leaked = calls.filter(c => c.url.includes("script.google.com"));
  assert.deepEqual(leaked, [], "payment payloads must never be POSTed to a URL baked into the source");
}));

test("webhook: the Sheets forward still fires, to the configured URL, when one is set", withFetchRecorder(async (calls) => {
  const db = freshDb();
  const ctx = makeWebhookContext(db, capturedPayment({ id: "pay_FWD" }));
  ctx.env.GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/CONFIGURED/exec?secret=abc";
  ctx.waitUntil = (p) => p;
  await webhook.onRequestPost(ctx);

  assert.equal(calls.length, 1, "exactly one forward");
  assert.equal(calls[0].url, "https://script.google.com/macros/s/CONFIGURED/exec?secret=abc");
  assert.equal(calls[0].opts.method, "POST");
  assert.match(calls[0].opts.body, /pay_FWD/, "the raw Razorpay body is forwarded verbatim");
}));
