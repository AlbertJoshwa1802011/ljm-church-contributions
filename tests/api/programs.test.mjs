import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as programs from "../../functions/api/programs.js";
import * as churches from "../../functions/api/churches.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function motherChurchId(db) {
  const res = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  return res.churches.find(c => c.slug === "church-of-light").id;
}

test("programs: full create -> edit -> delete round trip", async () => {
  const db = freshDb();
  const churchId = await motherChurchId(db);

  const addRes = await readJson(await programs.onRequestPost(makeContext({
    db, body: { titleEn: "Sunday Service", churchId, dayOfWeek: 0, startTime: "09:00", location: "Main Hall" }
  })));
  assert.equal(addRes.success, true);
  const id = addRes.id;

  const listRes = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(listRes.programs.length, 1);
  assert.equal(listRes.programs[0].titleEn, "Sunday Service");
  assert.equal(listRes.programs[0].churchId, churchId);

  const updateRes = await readJson(await programs.onRequestPut(makeContext({
    db, body: { id, titleEn: "Sunday Worship Service", startTime: "09:30" }
  })));
  assert.equal(updateRes.success, true);

  const afterUpdate = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(afterUpdate.programs[0].titleEn, "Sunday Worship Service");
  assert.equal(afterUpdate.programs[0].startTime, "09:30");

  const deleteRes = await readJson(await programs.onRequestDelete(makeContext({
    db, url: `https://test.local/api/programs?id=${id}`
  })));
  assert.equal(deleteRes.success, true);

  const afterDelete = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(afterDelete.programs.length, 0);
});

test("programs: public GET filters by ?church=", async () => {
  const db = freshDb();
  const listAll = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null })));
  const church1 = listAll.churches.find(c => c.slug === "church-of-light").id;
  const church2 = listAll.churches.find(c => c.slug === "city-worship-center").id;

  await programs.onRequestPost(makeContext({ db, body: { titleEn: "Church 1 program", churchId: church1 } }));
  await programs.onRequestPost(makeContext({ db, body: { titleEn: "Church 2 program", churchId: church2 } }));

  const filtered = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/programs?church=${church1}`
  })));
  assert.equal(filtered.programs.length, 1);
  assert.equal(filtered.programs[0].titleEn, "Church 1 program");

  const unfiltered = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(unfiltered.programs.length, 2);
});

test("programs: inactive programs are hidden from the public list but visible via ?all=1", async () => {
  const db = freshDb();
  const addRes = await readJson(await programs.onRequestPost(makeContext({
    db, body: { titleEn: "Draft program", status: "inactive" }
  })));

  const publicList = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(publicList.programs.length, 0);

  const allList = await readJson(await programs.onRequestGet(makeContext({
    db, url: "https://test.local/api/programs?all=1"
  })));
  assert.equal(allList.programs.length, 1);
  assert.equal(allList.programs[0].id, addRes.id);
});

test("programs: write operations and ?all=1 require manage_content permission", async () => {
  const db = freshDb();
  const postRes = await programs.onRequestPost(makeContext({ db, authToken: null, body: { titleEn: "X" } }));
  assert.equal(postRes.status, 401);

  const allRes = await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs?all=1" }));
  assert.equal(allRes.status, 401);
});

test("programs: POST missing titleEn is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({ db, body: {} })));
  assert.equal(res.success, false);
});

test("programs: PUT/DELETE nonexistent id -> 404, PUT missing id -> 400", async () => {
  const db = freshDb();
  const missingId = await programs.onRequestPut(makeContext({ db, body: { titleEn: "X" } }));
  assert.equal(missingId.status, 400);

  const notFoundPut = await programs.onRequestPut(makeContext({ db, body: { id: 999, titleEn: "X" } }));
  assert.equal(notFoundPut.status, 404);

  const notFoundDelete = await programs.onRequestDelete(makeContext({
    db, url: "https://test.local/api/programs?id=999"
  }));
  assert.equal(notFoundDelete.status, 404);
});
