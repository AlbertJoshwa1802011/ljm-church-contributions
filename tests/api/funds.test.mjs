// Characterization tests for /api/funds — the dynamic fund registry.
// Locks in the protections around the two live system funds (Tech/Christmas):
// they can't be renamed, restructured or deleted, and deleting a custom fund is
// a soft delete that PRESERVES contribution history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as funds from "../../functions/api/funds.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("funds: public listing shows the two seeded system funds", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds"
  })));
  const slugs = res.funds.map(f => f.slug).sort();
  assert.deepEqual(slugs, ["christmas-fund", "tech-contributions"]);
  assert.ok(res.funds.every(f => f.isSystem === 1));
});

test("funds: an admin can create a custom fund and it becomes visible", async () => {
  const db = freshDb();
  const create = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Building Fund", goal_amount: 100000 }
  })));
  assert.equal(create.success, true, create.message);
  assert.equal(create.slug, "building-fund");

  const list = await readJson(await funds.onRequestGet(makeContext({ db, url: "https://test.local/api/funds" })));
  assert.ok(list.funds.find(f => f.slug === "building-fund"), "new fund appears in the listing");
});

test("funds: system funds reject rename but allow goal changes (and keep the legacy config key in sync)", async () => {
  const db = freshDb();
  const bad = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "tech-contributions", name: "Renamed Fund" }
  })));
  assert.equal(bad.success, false, "renaming a system fund must be refused");

  const good = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "tech-contributions", goal_amount: 75000 }
  })));
  assert.equal(good.success, true, good.message);

  const row = await db.prepare("SELECT goal_amount FROM funds WHERE slug='tech-contributions'").first();
  assert.equal(row.goal_amount, 75000);
  const cfg = await db.prepare("SELECT value FROM config WHERE key='tech_goal_amount'").first();
  assert.equal(cfg.value, "75000", "legacy config fallback stays consistent");
});

test("funds: system funds cannot be deleted", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/funds?slug=tech-contributions"
  })));
  assert.equal(res.success, false);
});

test("funds: deleting a custom fund is soft and preserves its contributions", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Temp Fund" }
  }));
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Gv',100,'2026-07-01 10:00:00','Direct Cash','pf1','temp-fund')"
  ).run();

  const del = await readJson(await funds.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/funds?slug=temp-fund"
  })));
  assert.equal(del.success, true, del.message);

  const fund = await db.prepare("SELECT status FROM funds WHERE slug='temp-fund'").first();
  assert.equal(fund.status, "deleted", "soft delete flips status, doesn't drop the row");
  const contrib = await db.prepare("SELECT COUNT(*) AS n FROM contributions WHERE fund='temp-fund'").first();
  assert.equal(contrib.n, 1, "contribution history must survive a fund deletion");
});

test("funds: creating a fund requires manage_funds permission", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/funds", body: { name: "X" }
  })));
  assert.equal(res.success, false);
});
