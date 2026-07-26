// Combines the public read-model characterization tests (goal/collected/spent math,
// member dictionaries, config fallback) with the manual add/edit/delete admin CRUD tests
// and the pre-0012 D1_ERROR regression. Both concerns share this file so any future
// contributions.js change is checked against every invariant at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contributions from "../../functions/api/contributions.js";

async function readJson(response) { return JSON.parse(await response.text()); }
function ctx(db, url) { return { env: { DB: db }, request: { url } }; }

async function addContribution(db, name, amount, proof, fund = "tech-contributions", category = "Direct Cash") {
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES (?,?,?,?,?,?)"
  ).bind(name, amount, "2026-07-01 10:00:00", category, proof, fund).run();
}
async function addPurchase(db, id, cost, fundContribution, fund = "tech-contributions", status = "Active") {
  await db.prepare(
    "INSERT INTO purchases (id, name, amount, date, fund, status, fund_contribution) VALUES (?,?,?,?,?,?,?)"
  ).bind(id, "Item " + id, cost, "2026-07-02", fund, status, fundContribution).run();
}

test("contributions: returns the seeded goal and computes availableBalance = collected − spent", async () => {
  const db = freshDb();
  await addContribution(db, "Alice", 1000, "p1");
  await addContribution(db, "Bob", 500, "p2");
  await addPurchase(db, "P1", 400, 400); // 400 drawn from the fund

  const body = await readJson(await contributions.onRequestGet(
    ctx(db, "https://test.local/api/contributions?fund=tech-contributions")));

  assert.equal(body.goalAmount, 50000, "seeded tech goal");
  assert.equal(body.contributions.length, 2);
  assert.equal(body.spentOnProducts, 400);
  assert.equal(body.availableBalance, 1100, "1500 collected − 400 spent");
});

test("contributions: only the fund_contribution portion of a purchase reduces the balance", async () => {
  const db = freshDb();
  await addContribution(db, "Alice", 1000, "p1");
  // A ₹5000 item but only ₹300 came from the fund (rest external) — balance drops by 300, not 5000.
  await addPurchase(db, "P2", 5000, 300);
  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions")));
  assert.equal(body.spentOnProducts, 300);
  assert.equal(body.availableBalance, 700);
});

test("contributions: availableBalance never goes negative", async () => {
  const db = freshDb();
  await addPurchase(db, "P3", 9999, 9999);
  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions")));
  assert.equal(body.availableBalance, 0);
});

test("contributions: ?fund=purchases lists purchases with display-capitalized fund labels", async () => {
  const db = freshDb();
  await addPurchase(db, "P9", 25000, 25000);
  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions?fund=purchases")));
  assert.equal(body.count, 1);
  assert.equal(body.purchases[0].fund, "Tech Fund", "slug is mapped to the display name for the frontend");
});

test("contributions: an unknown fund falls back to tech-contributions", async () => {
  const db = freshDb();
  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions?fund=nonsense")));
  assert.equal(body.goalAmount, 50000);
});

test("contributions: memberEmails/memberPhones/memberStatus dictionaries are populated from the members table", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Verified Giver','v@x.com','111',1)").run();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Unverified Giver','u@x.com','222',0)").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions")));
  assert.equal(body.memberEmails["Verified Giver"], "v@x.com");
  assert.equal(body.memberPhones["Verified Giver"], "111");
  assert.equal(body.memberStatus["Verified Giver"], true);
  assert.equal(body.memberStatus["Unverified Giver"], false);
});

test("contributions: falls back to the config table when the funds row/goal is missing (pre-0002 compatibility path)", async () => {
  const db = freshDb();
  // Simulate a funds row with no goal (or missing entirely) — config is the fallback source.
  await db.prepare("DELETE FROM funds WHERE slug = 'tech-contributions'").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions?fund=tech-contributions")));
  assert.equal(body.goalAmount, 50000, "should fall back to config.tech_goal_amount");
});

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

test("contributions GET survives a pre-0012 database missing is_deleted (production D1_ERROR regression)", async () => {
  // Reproduces the real production incident: the code from migration 0012 was
  // deployed (GET selects/filters on is_deleted) but the migration was never
  // applied to the remote D1, so every dashboard read threw "no such column:
  // is_deleted" -> 500 D1_ERROR -> the UI rendered every value as 0.
  // Rebuild the contributions table in its pre-0012 shape and confirm the GET
  // now falls back gracefully and returns real numbers.
  const db = freshDb();
  db._sqlite.exec(`
    DROP TABLE contributions;
    CREATE TABLE contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_name TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT,
      notes TEXT,
      proof_id TEXT,
      email TEXT,
      phone TEXT,
      fund TEXT NOT NULL DEFAULT 'tech-contributions',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db._sqlite.exec(
    "INSERT INTO contributions (member_name, amount, date, category, fund) VALUES ('Legacy Giver', 750, '2026-07-01', 'Direct Cash', 'tech-contributions');"
  );

  const res = await contributions.onRequestGet(makeContext({
    db, url: "https://test.local/api/contributions?fund=tech-contributions"
  }));
  assert.equal(res.status, 200, "GET must not 500 when the 0012 columns are absent");
  const body = await readJson(res);
  const row = body.contributions.find(c => c.Member === "Legacy Giver");
  assert.ok(row, "contribution rows must still be returned on a pre-0012 database");
  assert.equal(Number(row.Amount), 750);
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
