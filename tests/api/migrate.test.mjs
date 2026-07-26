// Characterization tests for /api/migrate — the one-time Google Sheets -> D1
// bulk import utility. Deterministic fail-closed guards + one fetch-stubbed
// happy path, using the globalThis.fetch stub pattern from webhook.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as migrate from "../../functions/api/migrate.js";

async function readJson(res) { return JSON.parse(await res.text()); }
function ctx(db, env, url) { return { env: { DB: db, ...env }, request: { url } }; }

test("migrate: is disabled (403) when MIGRATION_SECRET is not configured", async () => {
  const db = freshDb();
  const res = await migrate.onRequestGet(ctx(db, {}, "https://test.local/api/migrate?secret=anything"));
  assert.equal(res.status, 403);
});

test("migrate: rejects a wrong secret with 401", async () => {
  const db = freshDb();
  const res = await migrate.onRequestGet(ctx(db, { MIGRATION_SECRET: "correct" }, "https://test.local/api/migrate?secret=wrong"));
  assert.equal(res.status, 401);
});

test("migrate: missing DB binding is a 500", async () => {
  const res = await migrate.onRequestGet({ env: { MIGRATION_SECRET: "s" }, request: { url: "https://test.local/api/migrate?secret=s" } });
  assert.equal(res.status, 500);
});

test("migrate: a successful import inserts members, contributions, and purchases from the Sheets payload", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("fund=tech-contributions")) {
      return { ok: true, json: async () => ({
        memberEmails: { "Legacy Giver": "legacy@example.com" },
        memberPhones: {}, memberStatus: {},
        contributions: [{ Member: "Legacy Giver", Amount: 500, Date: "2026-01-01", Category: "Direct Cash", Notes: "ID: pay_LEGACY1" }]
      }) };
    }
    if (u.includes("fund=christmas-fund")) {
      return { ok: true, json: async () => ({ memberEmails: {}, memberPhones: {}, memberStatus: {}, contributions: [] }) };
    }
    if (u.includes("fund=purchases")) {
      return { ok: true, json: async () => ({ purchases: [
        { id: "LEGACY-P1", name: "Old Mixer", cost: 4000, date: "2026-01-02", fund: "Tech Fund", status: "Active", fundContribution: 4000 }
      ] }) };
    }
    return realFetch(url);
  };

  try {
    const res = await readJson(await migrate.onRequestGet(ctx(db, { MIGRATION_SECRET: "s" }, "https://test.local/api/migrate?secret=s")));
    assert.equal(res.status, "success", JSON.stringify(res));
    assert.equal(res.stats.membersInserted, 1);
    assert.equal(res.stats.contributionsInserted, 1);
    assert.equal(res.stats.purchasesInserted, 1);

    const member = await db.prepare("SELECT email FROM members WHERE name='Legacy Giver'").first();
    assert.equal(member.email, "legacy@example.com");
    const contrib = await db.prepare("SELECT proof_id, amount FROM contributions WHERE member_name='Legacy Giver'").first();
    assert.equal(contrib.proof_id, "pay_LEGACY1");
    assert.equal(contrib.amount, 500);
    const purchase = await db.prepare("SELECT id FROM purchases WHERE id='LEGACY-P1'").first();
    assert.ok(purchase);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("migrate: a failed Sheets fetch reports an error without partial success", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  try {
    const res = await migrate.onRequestGet(ctx(db, { MIGRATION_SECRET: "s" }, "https://test.local/api/migrate?secret=s"));
    assert.equal(res.status, 500);
    const body = await readJson(res);
    assert.equal(body.status, "error");
    assert.ok(body.stats.errors.length > 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
