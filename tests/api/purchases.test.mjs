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
