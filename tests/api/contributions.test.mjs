// Characterization tests for /api/contributions — the public fund read model that
// the dashboard renders. Locks in the goal/collected/spent/available math so a
// future change can't quietly alter what givers and the pastor see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as contributions from "../../functions/api/contributions.js";

async function readJson(res) { return JSON.parse(await res.text()); }
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
