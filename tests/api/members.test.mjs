// Characterization tests for /api/members — the member directory with computed
// contribution stats. Locks in the aggregation and the duplicate-name guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as members from "../../functions/api/members.js";

async function readJson(res) { return JSON.parse(await res.text()); }

// makeContext()'s ADMIN_API_TOKEN default gives wildcard permissions, so it
// can't test a *specific* permission scope. Build a raw context with the
// legacy email-token path enabled instead, to authenticate as an email that
// only holds the exact role permissions this test wires up.
function emailCtx(db, email, { method = "GET", url = "https://test.local/api/members", body } = {}) {
  return {
    env: { DB: db, ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: {
      url, method,
      headers: { get: (k) => (k === "Authorization" ? "Bearer " + email : null) },
      json: async () => body ?? {}
    }
  };
}

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

test("members: POST requires credentials", async () => {
  const db = freshDb();
  const res = await readJson(await members.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/members", body: { name: "Nope" }
  })));
  assert.equal(res.success, false);
});

test("members: PUT requires credentials", async () => {
  const db = freshDb();
  const add = await readJson(await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "Guarded" } })));
  const res = await readJson(await members.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/members", body: { id: add.id, email: "x@x.com" }
  })));
  assert.equal(res.success, false);
});

// SECURITY regression (docs/audits/2026-08-21-production-hardening.md):
// POST/PUT used to gate on "view_members" — a READ-scoped permission — so a
// role granted only read-only member lookup could still create/edit member
// records. families.js's own write endpoints already correctly require
// "manage_members"; this endpoint used the wrong scope by mistake.
test("members: POST requires manage_members, not just view_members", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('read_only_members', '["view_members"]');
     INSERT INTO member_roles (email, role_name) VALUES ('reader@example.com', 'read_only_members');`
  );
  const res = await readJson(await members.onRequestPost(emailCtx(db, "reader@example.com", {
    method: "POST", body: { name: "Should Not Be Created" }
  })));
  assert.equal(res.success, false, "view_members alone must not be able to create a member");

  const row = await db.prepare("SELECT id FROM members WHERE name = 'Should Not Be Created'").first();
  assert.equal(row, null);
});

test("members: PUT requires manage_members, not just view_members", async () => {
  const db = freshDb();
  const add = await readJson(await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "Untouchable" } })));
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('read_only_members2', '["view_members"]');
     INSERT INTO member_roles (email, role_name) VALUES ('reader2@example.com', 'read_only_members2');`
  );
  const res = await readJson(await members.onRequestPut(emailCtx(db, "reader2@example.com", {
    method: "PUT", body: { id: add.id, email: "hacked@example.com" }
  })));
  assert.equal(res.success, false, "view_members alone must not be able to edit a member");
});

test("members: manage_members alone (without view_members) can create and edit a member", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('member_editor', '["manage_members"]');
     INSERT INTO member_roles (email, role_name) VALUES ('editor@example.com', 'member_editor');`
  );
  const add = await readJson(await members.onRequestPost(emailCtx(db, "editor@example.com", {
    method: "POST", body: { name: "Editable" }
  })));
  assert.equal(add.success, true, add.message);

  const upd = await readJson(await members.onRequestPut(emailCtx(db, "editor@example.com", {
    method: "PUT", body: { id: add.id, email: "editable@example.com" }
  })));
  assert.equal(upd.success, true, upd.message);
});

test("members: POST requires a name", async () => {
  const db = freshDb();
  const res = await readJson(await members.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/members", body: { email: "noname@x.com" }
  })));
  assert.equal(res.success, false);
});

test("members: PUT on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await members.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/members", body: { id: 999999, email: "x@x.com" }
  })));
  assert.equal(res.success, false);
});

test("members: PUT with no editable fields is rejected", async () => {
  const db = freshDb();
  const add = await readJson(await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "NoFields" } })));
  const res = await readJson(await members.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/members", body: { id: add.id }
  })));
  assert.equal(res.success, false);
});

test("members: PUT updates recurringReminders and isVerified", async () => {
  const db = freshDb();
  const add = await readJson(await members.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/members", body: { name: "Flaggable" } })));

  const res = await readJson(await members.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/members",
    body: { id: add.id, recurringReminders: "No", isVerified: true }
  })));
  assert.equal(res.success, true, res.message);

  const row = await db.prepare("SELECT recurring_reminders, is_verified FROM members WHERE id = ?").bind(add.id).first();
  assert.equal(row.recurring_reminders, "No");
  assert.equal(row.is_verified, 1);
});

test("members: GET stitches the per-fund contribution breakdown for each member", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name) VALUES ('Multi Fund')").run();
  await db.prepare("INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Multi Fund',100,'2026-07-01 10:00:00','Direct Cash','mf1','tech-contributions')").run();
  await db.prepare("INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Multi Fund',50,'2026-07-01 10:00:00','Direct Cash','mf2','christmas-fund')").run();

  const res = await readJson(await members.onRequestGet(makeContext({ db, url: "https://test.local/api/members" })));
  const m = res.members.find(x => x.name === "Multi Fund");
  assert.equal(m.funds["tech-contributions"].amount, 100);
  assert.equal(m.funds["christmas-fund"].amount, 50);
});
