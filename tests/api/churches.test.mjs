import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as churches from "../../functions/api/churches.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("churches: public GET lists the two seeded active churches", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  assert.equal(res.success, true);
  assert.equal(res.churches.length, 2);
  assert.ok(res.churches.some(c => c.slug === "church-of-light" && c.isMotherChurch));
  assert.ok(res.churches.some(c => c.slug === "city-worship-center"));
});

test("churches: POST requires manage_content permission", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "third-campus", nameEn: "Third Campus" }
  })));
  assert.equal(res.success, false);
});

test("churches: POST creates a new church; validation rejects missing fields", async () => {
  const db = freshDb();
  const bad = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches", body: { slug: "" }
  })));
  assert.equal(bad.success, false);

  const res = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "third-campus", nameEn: "Third Campus" }
  })));
  assert.equal(res.success, true);

  const list = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  assert.equal(list.churches.length, 3);
});

test("churches: DELETE archives (soft-delete) — archived churches drop from public listing", async () => {
  const db = freshDb();
  const create = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches", body: { slug: "temp", nameEn: "Temp" }
  })));

  await churches.onRequestDelete(makeContext({ db, method: "DELETE", url: `https://test.local/api/churches?id=${create.id}` }));

  const list = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  assert.equal(list.churches.some(c => c.slug === "temp"), false);

  const all = await readJson(await churches.onRequestGet(makeContext({ db, url: "https://test.local/api/churches?all=1" })));
  assert.ok(all.churches.some(c => c.slug === "temp" && c.status === "archived"));
});

test("churches: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await churches.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/churches", body: { id: 999999, nameEn: "X" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await churches.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/churches?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("churches: ?all=1 requires manage_content", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches?all=1" })));
  assert.equal(res.success, false);
});

test("churches: malformed JSON body returns 400, not a 500 with a leaked parser error", async () => {
  const db = freshDb();
  const ctx = makeContext({ db, method: "POST", url: "https://test.local/api/churches" });
  ctx.request.json = async () => { throw new SyntaxError("Unexpected token"); };
  const res = await churches.onRequestPost(ctx);
  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
});
