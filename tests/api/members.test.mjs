// Characterization tests for /api/members — the member directory with computed
// contribution stats. Locks in the aggregation and the duplicate-name guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as members from "../../functions/api/members.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("members: GET aggregates each member's contribution totals", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Alice','a@x.com','111',1)").run();
  await db.prepare("INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Alice',1000,'2026-07-01 10:00:00','Direct Cash','m1','tech-contributions')").run();
  await db.prepare("INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Alice',500,'2026-07-02 10:00:00','Direct Cash','m2','tech-contributions')").run();

  const res = await readJson(await members.onRequestGet(makeContext({ db, url: "https://test.local/api/members" })));
  const alice = res.members.find(m => m.name === "Alice");
  assert.ok(alice, "member should be listed");
  assert.equal(alice.totalContributions, 2);
  assert.equal(alice.totalAmount, 1500);
});

test("members: POST adds a new believer", async () => {
  const db = freshDb();
  const res = await readJson(await members.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/members", body: { name: "Sam", email: "s@x.com", phone: "222" }
  })));
  assert.equal(res.success, true, res.message);
  const row = await db.prepare("SELECT name FROM members WHERE name='Sam'").first();
  assert.ok(row);
});

test("members: POST rejects a duplicate name", async () => {
  const db = freshDb();
  await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "Sam" } }));
  const dup = await readJson(await members.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/members", body: { name: "Sam" }
  })));
  assert.equal(dup.success, false);
});

test("members: PUT updates a member's contact details", async () => {
  const db = freshDb();
  const add = await readJson(await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "Ed" } })));
  const upd = await readJson(await members.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/members", body: { id: add.id, email: "ed@x.com" }
  })));
  assert.equal(upd.success, true, upd.message);
  const row = await db.prepare("SELECT email FROM members WHERE id=?").bind(add.id).first();
  assert.equal(row.email, "ed@x.com");
});

test("members: GET requires view_members permission", async () => {
  const db = freshDb();
  const res = await readJson(await members.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/members"
  })));
  assert.equal(res.success, false);
});
