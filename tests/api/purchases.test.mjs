import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as purchases from "../../functions/api/purchases.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("purchases: add_purchase records the signed-in admin as created_by", async () => {
  const db = freshDb(); // schema.sql already seeds the 'tech-contributions' fund

  const params = new URLSearchParams({
    action: "add_purchase", productName: "Projector", cost: "20000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const res = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?" + params.toString()
  })));
  assert.equal(res.success, true, res.message);

  const listRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases" })));
  const p = listRes.purchases.find(x => x.id === res.id);
  assert.ok(p, "the new purchase should appear in the public listing");
  assert.equal(p.createdBy, "api-token", "created_by should be the authenticated caller's identity");
});

test("purchases: update_purchase does not overwrite the original created_by", async () => {
  const db = freshDb();

  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Mixer", cost: "5000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const updateParams = new URLSearchParams({
    action: "update_purchase", id: addRes.id, productName: "Mixer (updated)", cost: "5500",
    purchaseDate: "2026-07-02", fundSource: "tech-contributions"
  });
  const updateRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + updateParams.toString() })));
  assert.equal(updateRes.success, true, updateRes.message);

  const row = await db.prepare("SELECT created_by, name FROM purchases WHERE id = ?").bind(addRes.id).first();
  assert.equal(row.created_by, "api-token", "editing a purchase must not blank out who originally added it");
  assert.equal(row.name, "Mixer (updated)");
});

test("purchases: add_purchase requires edit_purchases permission", async () => {
  const db = freshDb();
  const res = await readJson(await purchases.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/purchases?action=add_purchase&productName=X&cost=1&purchaseDate=2026-07-01&fundSource=tech-contributions"
  })));
  assert.equal(res.success, false);
});

test("purchases: delete_purchase removes the record", async () => {
  const db = freshDb();
  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Speaker", cost: "3000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const delRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: `https://test.local/api/purchases?action=delete_purchase&id=${addRes.id}`
  })));
  assert.equal(delRes.success, true, delRes.message);

  const row = await db.prepare("SELECT id FROM purchases WHERE id=?").bind(addRes.id).first();
  assert.equal(row, null);
});

test("purchases: update_purchase and delete_purchase require an id", async () => {
  const db = freshDb();
  const updateRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?action=update_purchase&productName=X&cost=1"
  })));
  assert.equal(updateRes.success, false);
  assert.match(updateRes.message, /Missing purchase id/);

  const deleteRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?action=delete_purchase"
  })));
  assert.equal(deleteRes.success, false);
  assert.match(deleteRes.message, /Missing purchase id/);
});

test("purchases: fund/external contribution defaults from cost when not explicitly provided", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", productName: "Mic Stand", cost: "1500",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
    // no fundContribution/externalContribution provided
  });
  const res = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() })));

  const row = await db.prepare("SELECT fund_contribution, external_contribution FROM purchases WHERE id=?").bind(res.id).first();
  assert.equal(row.fund_contribution, 1500, "defaults to the full cost when not specified");
  assert.equal(row.external_contribution, 0);
});

test("purchases: default public listing (no action) aggregates totalSpent and totalCost", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", productName: "Cables", cost: "1000", fundContribution: "600", externalContribution: "400",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() }));

  const res = await readJson(await purchases.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/purchases" })));
  assert.equal(res.success, true);
  assert.equal(res.count, 1);
  assert.equal(res.totalSpent, 600, "totalSpent sums fund_contribution");
  assert.equal(res.totalCost, 1000, "totalCost sums the full cost");
});
