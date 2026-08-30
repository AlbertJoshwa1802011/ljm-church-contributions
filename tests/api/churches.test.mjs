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

test("churches: POST requires manage_funds permission", async () => {
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

test("churches: ?all=1 requires manage_funds", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches?all=1" })));
  assert.equal(res.success, false);
});

// ── Issue 6: a church that was archived must stay archived through an edit ──

test("churches: editing an archived church leaves it archived", async () => {
  const db = freshDb();
  const created = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "stray-campus", nameEn: "Stray Campus" }
  })));

  await churches.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/churches?id=${created.id}`
  }));

  // The admin console's edit form does not send `status`. Before this fix the
  // PUT defaulted it to 'active', so re-saving an archived church silently put
  // it back on the public site.
  const res = await readJson(await churches.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/churches",
    body: { id: created.id, nameEn: "Stray Campus renamed" }
  })));
  assert.equal(res.success, true);

  const pub = await readJson(await churches.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/churches"
  })));
  assert.equal(pub.churches.some(c => c.slug === "stray-campus"), false,
    "an archived church must not reappear publicly just because it was edited");

  const all = await readJson(await churches.onRequestGet(makeContext({ db, url: "https://test.local/api/churches?all=1" })));
  const row = all.churches.find(c => c.slug === "stray-campus");
  assert.equal(row.status, "archived");
  assert.equal(row.nameEn, "Stray Campus renamed", "the edit itself must still apply");
});

test("churches: an archived church can be deliberately restored by sending status", async () => {
  const db = freshDb();
  const created = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "restore-me", nameEn: "Restore Me" }
  })));
  await churches.onRequestDelete(makeContext({ db, method: "DELETE", url: `https://test.local/api/churches?id=${created.id}` }));

  await churches.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/churches",
    body: { id: created.id, nameEn: "Restore Me", status: "active" }
  }));

  const pub = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  assert.ok(pub.churches.some(c => c.slug === "restore-me"));
});

test("churches: photoUrl and onlineUrl round-trip", async () => {
  const db = freshDb();
  const meet = "https://meet.google.com/abc-defg-hij";
  const created = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "photo-church", nameEn: "Photo Church", photoUrl: "https://cdn.test/church.jpg", onlineUrl: meet }
  })));
  assert.equal(created.success, true);

  const pub = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const row = pub.churches.find(c => c.slug === "photo-church");
  assert.equal(row.photoUrl, "https://cdn.test/church.jpg");
  assert.equal(row.onlineUrl, meet);
});
