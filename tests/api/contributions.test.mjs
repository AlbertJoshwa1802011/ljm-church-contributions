import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contributions from "../../functions/api/contributions.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("contributions: add records created_by and defaults category to Direct Cash", async () => {
  const db = freshDb();
  const res = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST",
    body: { member_name: "Test Member", amount: 500, date: "2026-07-19", fund: "tech-contributions" }
  })));
  assert.equal(res.success, true, res.message);

  const row = await db.prepare("SELECT * FROM contributions WHERE id = ?").bind(res.id).first();
  assert.equal(row.created_by, "api-token");
  assert.equal(row.category, "Direct Cash");
  assert.equal(row.proof_id, null);
  assert.equal(row.is_deleted, 0);
});

test("contributions: add rejects missing required fields", async () => {
  const db = freshDb();
  const res = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST", body: { member_name: "", amount: 0, date: "", fund: "" }
  })));
  assert.equal(res.success, false);
});

test("contributions: add rejects an admin who isn't on the manual-entry allowlist", async () => {
  const db = freshDb();
  const context = {
    env: { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: {
      url: "https://test.local/api/contributions",
      method: "POST",
      headers: { get: (k) => (k === "Authorization" ? "Bearer thinkmuthu@gmail.com" : null) },
      json: async () => ({ member_name: "X", amount: 1, date: "2026-07-01", fund: "tech-contributions" })
    }
  };
  const res = await readJson(await contributions.onRequestPost(context));
  assert.equal(res.success, false);
  assert.match(res.message, /not authorized/i);
});

test("contributions: add requires credentials at all", async () => {
  const db = freshDb();
  const res = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST", authToken: null,
    body: { member_name: "X", amount: 1, date: "2026-07-01", fund: "tech-contributions" }
  })));
  assert.equal(res.success, false);
});

test("contributions: update records updated_by and writes before/after audit", async () => {
  const db = freshDb();
  const addRes = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST", body: { member_name: "Jane", amount: 100, date: "2026-07-01", fund: "tech-contributions" }
  })));
  const updRes = await readJson(await contributions.onRequestPut(makeContext({
    db, method: "PUT", body: { id: addRes.id, amount: 150 }
  })));
  assert.equal(updRes.success, true, updRes.message);

  const row = await db.prepare("SELECT * FROM contributions WHERE id = ?").bind(addRes.id).first();
  assert.equal(row.amount, 150);
  assert.equal(row.created_by, "api-token");
  assert.equal(row.updated_by, "api-token");

  const log = await db.prepare("SELECT * FROM activity_logs WHERE action = 'contribution.update'").first();
  assert.ok(log, "should write an audit row");
  const details = JSON.parse(log.details);
  assert.equal(details.before.amount, 100);
  assert.equal(details.after.amount, 150);
});

test("contributions: delete soft-deletes, hides from default GET, flags verified proof in audit", async () => {
  const db = freshDb();
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind("Sam", 200, "2026-07-01", "Online (Verified)", "pay_abc123", "tech-contributions").run();
  const target = await db.prepare("SELECT id FROM contributions WHERE member_name = 'Sam'").first();

  const delRes = await readJson(await contributions.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/contributions?id=" + target.id
  })));
  assert.equal(delRes.success, true, delRes.message);

  const row = await db.prepare("SELECT * FROM contributions WHERE id = ?").bind(target.id).first();
  assert.equal(row.is_deleted, 1);
  assert.ok(row.deleted_at);

  const log = await db.prepare("SELECT * FROM activity_logs WHERE action = 'contribution.delete'").first();
  assert.ok(log);
  assert.equal(JSON.parse(log.details).wasVerifiedProof, true);

  const listRes = await readJson(await contributions.onRequestGet(makeContext({
    db, url: "https://test.local/api/contributions?fund=tech-contributions"
  })));
  assert.ok(!listRes.contributions.find(c => c.Member === "Sam"), "soft-deleted row must not appear in the default (public) view");
});

test("contributions GET with includeDeleted=1 shows soft-deleted rows to an admin, and excludes them from the balance", async () => {
  const db = freshDb();
  const addRes = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST", body: { member_name: "Ada", amount: 300, date: "2026-07-01", fund: "tech-contributions" }
  })));
  await contributions.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/contributions?id=" + addRes.id
  }));

  const withoutFlag = await readJson(await contributions.onRequestGet(makeContext({
    db, url: "https://test.local/api/contributions?fund=tech-contributions"
  })));
  assert.ok(!withoutFlag.contributions.find(c => c.Member === "Ada"));
  assert.equal(withoutFlag.availableBalance, 0);

  const withFlag = await readJson(await contributions.onRequestGet(makeContext({
    db, url: "https://test.local/api/contributions?fund=tech-contributions&includeDeleted=1"
  })));
  const adaRow = withFlag.contributions.find(c => c.Member === "Ada");
  assert.ok(adaRow, "admin view with includeDeleted=1 should still show the soft-deleted row");
  assert.equal(adaRow.IsDeleted, 1);
  assert.equal(withFlag.availableBalance, 0, "soft-deleted amount must not count toward the balance even when shown to admins");
});

test("contributions GET exposes id/createdBy so the admin UI can target rows for edit/delete", async () => {
  const db = freshDb();
  await contributions.onRequestPost(makeContext({
    db, method: "POST", body: { member_name: "Ruth", amount: 300, date: "2026-07-01", fund: "tech-contributions" }
  }));
  const listRes = await readJson(await contributions.onRequestGet(makeContext({
    db, url: "https://test.local/api/contributions?fund=tech-contributions"
  })));
  const row = listRes.contributions.find(c => c.Member === "Ruth");
  assert.ok(row.id != null, "GET response must expose row id for edit/delete targeting");
  assert.equal(row.createdBy, "api-token");
});
