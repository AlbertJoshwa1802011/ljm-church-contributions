import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as programs from "../../functions/api/programs.js";
import * as churches from "../../functions/api/churches.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("programs: POST requires manage_content; created program shows in public listing joined with church", async () => {
  const db = freshDb();
  const churchList = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const churchId = churchList.churches.find(c => c.slug === "church-of-light").id;

  const denied = await readJson(await programs.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Sunday Service" }
  })));
  assert.equal(denied.success, false);

  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Sunday Service", churchId, dayOfWeek: 0, startTime: "09:00" }
  }));

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  assert.equal(pub.programs.length, 1);
  assert.equal(pub.programs[0].churchSlug, "church-of-light");
});

test("programs: ?church= filters by church slug", async () => {
  const db = freshDb();
  const churchList = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const light = churchList.churches.find(c => c.slug === "church-of-light").id;
  const city = churchList.churches.find(c => c.slug === "city-worship-center").id;

  await programs.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Light Service", churchId: light } }));
  await programs.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "City Service", churchId: city } }));

  const res = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs?church=city-worship-center" })));
  assert.equal(res.programs.length, 1);
  assert.equal(res.programs[0].titleEn, "City Service");
});

test("programs: inactive programs are excluded from the public listing but visible via ?all=1", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Youth Night" }
  })));
  await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "Youth Night", status: "inactive" }
  }));

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  assert.equal(pub.programs.length, 0);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.length, 1);
});

test("programs: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: 999999, titleEn: "X" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await programs.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/programs?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("programs: DELETE requires manage_content", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X" }
  })));
  const denied = await readJson(await programs.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/programs?id=${create.id}`
  })));
  assert.equal(denied.success, false);
});

// ── Online join links (issue 8 of docs/milestone-v2/13-home-experience-rework.md) ──

test("programs: onlineUrl and isOnline round-trip through POST, GET and PUT", async () => {
  const db = freshDb();
  const meet = "https://meet.google.com/abc-defg-hij";

  const created = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Online prayer", dayOfWeek: 3, startTime: "20:00", isOnline: true, onlineUrl: meet }
  })));
  assert.equal(created.success, true);

  const list = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs"
  })));
  assert.equal(list.programs[0].isOnline, true);
  assert.equal(list.programs[0].onlineUrl, meet);

  const updated = "https://meet.google.com/zzz-zzzz-zzz";
  await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs",
    body: { id: created.id, titleEn: "Online prayer", isOnline: true, onlineUrl: updated }
  }));

  const after = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs"
  })));
  assert.equal(after.programs[0].onlineUrl, updated);
});

test("programs: an in-person program reports isOnline false with no link", async () => {
  const db = freshDb();
  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Sunday service" }
  }));

  const list = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs"
  })));
  assert.equal(list.programs[0].isOnline, false);
  assert.equal(list.programs[0].onlineUrl, null);
});
