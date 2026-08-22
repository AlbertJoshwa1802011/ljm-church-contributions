// Combines the public read-model characterization tests (goal/collected/spent math,
// member dictionaries, config fallback) with the manual add/edit/delete admin CRUD tests
// and the pre-0012 D1_ERROR regression. Both concerns share this file so any future
// contributions.js change is checked against every invariant at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contributions from "../../functions/api/contributions.js";

async function readJson(response) { return JSON.parse(await response.text()); }
// A real Cloudflare Pages Request always has `.headers` — onRequestGet now
// unconditionally calls requireAuth(context), which reads
// request.headers.get("Authorization"), so the fixture must carry a real
// (empty) headers stub to match production shape.
function ctx(db, url, authHeader) {
  return {
    env: { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: { url, headers: { get: (k) => (k === "Authorization" ? (authHeader ? "Bearer " + authHeader : null) : null) } }
  };
}

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

test("contributions: memberEmails/memberPhones/memberStatus dictionaries are populated from the members table (admin caller sees real values)", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Verified Giver','v@x.com','111',1)").run();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Unverified Giver','u@x.com','222',0)").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions", "test-admin-token")));
  assert.equal(body.memberEmails["Verified Giver"], "v@x.com");
  assert.equal(body.memberPhones["Verified Giver"], "111");
  assert.equal(body.memberStatus["Verified Giver"], true);
  assert.equal(body.memberStatus["Unverified Giver"], false);
});

// SECURITY regression (docs/audits/2026-08-21-production-hardening.md): this
// endpoint has no auth requirement at all — it's the public dashboard's data
// source — so it must never leak a real congregant's email/phone (or a
// contribution's own Email/Phone) to an unauthenticated caller. Only a
// truthy presence flag is public; the public UI (script.js) only ever reads
// these as a boolean "Verified" badge check, never displays the value.
test("contributions: an unauthenticated (public) caller gets presence booleans, never real emails/phones", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Verified Giver','v@x.com','111',1)").run();
  await addContribution(db, "Verified Giver", 250, "pub-proof-1");
  await db.prepare("UPDATE contributions SET email = 'v@x.com', phone = '111' WHERE member_name = 'Verified Giver'").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions")));
  assert.equal(body.memberEmails["Verified Giver"], true, "public caller gets a boolean, not the real email");
  assert.equal(body.memberPhones["Verified Giver"], true, "public caller gets a boolean, not the real phone");
  assert.equal(body.memberStatus["Verified Giver"], true, "the already-public verified flag is unaffected");

  const row = body.contributions.find((c) => c.Member === "Verified Giver");
  assert.ok(row, "the contribution itself is still public (transparency-by-design)");
  assert.equal(row.Email, undefined, "a public caller must never see a contributor's raw email");
  assert.equal(row.Phone, undefined, "a public caller must never see a contributor's raw phone");
});

// ADVERSARIAL-PASS regression (docs/audits/2026-08-21-production-hardening.md):
// the first version of the PII fix used requireAuth(context) with no
// permission argument — "any recognized role holder" — so a caller
// authenticated with an unrelated, narrowly-scoped permission (e.g.
// edit_wishlist, meant only for managing the public wishlist page) was
// treated as a full PII-viewing admin. Confirmed live against a real
// low-privilege token: it could read real member emails/phones AND
// soft-deleted contributions via includeDeleted=1.
test("contributions: a caller with an unrelated permission (edit_wishlist only) gets public-shaped data, not admin PII or soft-deleted rows", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('wishlist_only', '["edit_wishlist"]');
     INSERT INTO member_roles (email, role_name) VALUES ('wishlist-volunteer@example.com', 'wishlist_only');`
  );
  await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Target Giver','target@example.com','777',1)").run();
  await addContribution(db, "Target Giver", 300, "wishlist-attack-proof");
  await db.prepare("UPDATE contributions SET email = 'target@example.com', phone = '777' WHERE member_name = 'Target Giver'").run();
  await db.prepare("INSERT INTO contributions (member_name, amount, date, category, proof_id, fund, is_deleted) VALUES ('Hidden Giver', 999, '2026-07-01', 'Direct Cash', 'hidden-proof', 'tech-contributions', 1)").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions?fund=tech-contributions&includeDeleted=1", "wishlist-volunteer@example.com")));

  assert.equal(body.memberEmails["Target Giver"], true, "an unrelated permission must not unlock real member emails");
  assert.equal(body.memberPhones["Target Giver"], true, "an unrelated permission must not unlock real member phones");
  const row = body.contributions.find((c) => c.Member === "Target Giver");
  assert.equal(row.Email, undefined, "an unrelated permission must not unlock a contribution's raw email");
  assert.equal(row.Phone, undefined, "an unrelated permission must not unlock a contribution's raw phone");
  assert.ok(!body.contributions.find((c) => c.Member === "Hidden Giver"), "an unrelated permission must not unlock includeDeleted=1 (soft-deleted rows)");
});

test("contributions: an authenticated admin caller still gets the real Email/Phone on each contribution (admin.html's edit-form prefill depends on this)", async () => {
  const db = freshDb();
  await addContribution(db, "Grace", 400, "adm-proof-1");
  await db.prepare("UPDATE contributions SET email = 'grace@example.com', phone = '9999' WHERE member_name = 'Grace'").run();

  const body = await readJson(await contributions.onRequestGet(ctx(db, "https://test.local/api/contributions", "test-admin-token")));
  const row = body.contributions.find((c) => c.Member === "Grace");
  assert.equal(row.Email, "grace@example.com");
  assert.equal(row.Phone, "9999");
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

// ADVERSARIAL-PASS regression (docs/audits/2026-08-21-production-hardening.md):
// this manual-entry insert has no proof_id (NULL, unlike Razorpay-verified
// rows) and no natural collision to catch a double-click / stale-tab
// resubmit — confirmed live: two identical POSTs silently created two
// independent contribution rows, double-counting a real cash gift. A
// resubmit of the identical fields within 10s must now return the original
// row instead of creating a duplicate.
test("contributions: a resubmit of the identical manual entry within 10s is deduped, not duplicated", async () => {
  const db = freshDb();
  const body = { member_name: "Cash Giver", amount: 5000, date: "2026-08-21", fund: "tech-contributions", category: "Direct Cash" };
  const r1 = await readJson(await contributions.onRequestPost(makeContext({ db, method: "POST", body })));
  const r2 = await readJson(await contributions.onRequestPost(makeContext({ db, method: "POST", body })));
  assert.equal(r1.success, true, r1.message);
  assert.equal(r2.success, true, r2.message);
  assert.equal(r2.id, r1.id, "the resubmit must return the original id, not create a new row");
  assert.equal(r2.deduped, true);

  const rows = await db.prepare("SELECT id FROM contributions WHERE member_name = 'Cash Giver'").all();
  assert.equal(rows.results.length, 1, "only one row should exist for the duplicated submission");

  // a genuinely different contribution (different amount) must still go through
  const r3 = await readJson(await contributions.onRequestPost(makeContext({
    db, method: "POST", body: { ...body, amount: 750 }
  })));
  assert.equal(r3.success, true);
  assert.notEqual(r3.id, r1.id, "a genuinely different contribution must not be deduped away");
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
