import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as wishlist from "../../functions/api/wishlist.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("wishlist: full add -> edit -> delete round trip", async () => {
  const db = freshDb();

  const addRes = await readJson(await wishlist.onRequestPost(makeContext({
    db, body: { name: "Stage lighting", cost: 12000, priority: "High", notes: "For evening services" }
  })));
  assert.equal(addRes.success, true);
  const id = addRes.id;

  const listRes = await readJson(await wishlist.onRequestGet(makeContext({ db })));
  // schema.sql already seeds 2 sample items, so this new one makes 3.
  assert.equal(listRes.wishlist.length, 3);
  const item = listRes.wishlist.find(w => w.id === id);
  assert.equal(item.name, "Stage lighting");
  assert.equal(item.priority, "High");

  const updateRes = await readJson(await wishlist.onRequestPut(makeContext({
    db, body: { id, name: "Stage lighting (LED)", cost: 15000, priority: "Medium" }
  })));
  assert.equal(updateRes.success, true);

  const afterUpdate = await readJson(await wishlist.onRequestGet(makeContext({ db })));
  const updated = afterUpdate.wishlist.find(w => w.id === id);
  assert.equal(updated.name, "Stage lighting (LED)");
  assert.equal(updated.priority, "Medium");

  const deleteRes = await readJson(await wishlist.onRequestDelete(makeContext({
    db, url: `https://test.local/api/wishlist?id=${id}`
  })));
  assert.equal(deleteRes.success, true);

  const afterDelete = await readJson(await wishlist.onRequestGet(makeContext({ db })));
  assert.equal(afterDelete.wishlist.some(w => w.id === id), false);
});

test("wishlist: write operations require edit_wishlist permission", async () => {
  const db = freshDb();
  const res = await wishlist.onRequestPost(makeContext({
    db, authToken: null, body: { name: "Should fail", cost: 100 }
  }));
  assert.equal(res.status, 401);
});
