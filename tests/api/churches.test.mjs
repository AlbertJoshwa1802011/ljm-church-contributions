import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as churches from "../../functions/api/churches.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("churches: public GET returns the two seeded active churches", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(res.success, true);
  assert.equal(res.churches.length, 2);
  const slugs = res.churches.map(c => c.slug).sort();
  assert.deepEqual(slugs, ["church-of-light", "city-worship-center"]);
  const mother = res.churches.find(c => c.slug === "church-of-light");
  assert.equal(mother.isMotherChurch, true);
});

test("churches: full create -> edit -> archive round trip", async () => {
  const db = freshDb();

  const addRes = await readJson(await churches.onRequestPost(makeContext({
    db, body: { nameEn: "Diaspora Fellowship", city: "London", country: "UK" }
  })));
  assert.equal(addRes.success, true);
  const id = addRes.id;

  const listRes = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(listRes.churches.length, 3);
  const created = listRes.churches.find(c => c.id === id);
  assert.equal(created.slug, "diaspora-fellowship");
  assert.equal(created.city, "London");

  const updateRes = await readJson(await churches.onRequestPut(makeContext({
    db, body: { id, nameEn: "Diaspora Fellowship UK", city: "Manchester" }
  })));
  assert.equal(updateRes.success, true);

  const afterUpdate = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  const updated = afterUpdate.churches.find(c => c.id === id);
  assert.equal(updated.nameEn, "Diaspora Fellowship UK");
  assert.equal(updated.city, "Manchester");

  const deleteRes = await readJson(await churches.onRequestDelete(makeContext({
    db, url: `https://test.local/api/churches?id=${id}`
  })));
  assert.equal(deleteRes.success, true);

  // Archived churches drop out of the public list...
  const afterArchive = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(afterArchive.churches.some(c => c.id === id), false);

  // ...but are preserved (never hard-deleted) and visible via ?all=1.
  const allRes = await readJson(await churches.onRequestGet(makeContext({
    db, url: "https://test.local/api/churches?all=1"
  })));
  const archived = allRes.churches.find(c => c.id === id);
  assert.equal(archived.status, "archived");
});

test("churches: write operations require manage_funds permission", async () => {
  const db = freshDb();
  const res = await churches.onRequestPost(makeContext({
    db, authToken: null, body: { nameEn: "Should fail" }
  }));
  assert.equal(res.status, 401);
});

test("churches: ?all=1 requires manage_funds permission", async () => {
  const db = freshDb();
  const res = await churches.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/churches?all=1"
  }));
  assert.equal(res.status, 401);
});

test("churches: POST rejects duplicate slug with 409", async () => {
  const db = freshDb();
  const res = await churches.onRequestPost(makeContext({
    db, body: { nameEn: "Another Church of Light", slug: "church-of-light" }
  }));
  assert.equal(res.status, 409);
});

test("churches: POST missing nameEn is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestPost(makeContext({ db, body: {} })));
  assert.equal(res.success, false);
});

test("churches: PUT nonexistent id -> 404, missing id -> 400", async () => {
  const db = freshDb();
  const missingId = await churches.onRequestPut(makeContext({ db, body: { nameEn: "X" } }));
  assert.equal(missingId.status, 400);

  const notFound = await churches.onRequestPut(makeContext({ db, body: { id: 999, nameEn: "X" } }));
  assert.equal(notFound.status, 404);
});

test("churches: DELETE missing id -> 400, nonexistent id -> 404", async () => {
  const db = freshDb();
  const missingId = await churches.onRequestDelete(makeContext({ db, url: "https://test.local/api/churches" }));
  assert.equal(missingId.status, 400);

  const notFound = await churches.onRequestDelete(makeContext({ db, url: "https://test.local/api/churches?id=999" }));
  assert.equal(notFound.status, 404);
});
