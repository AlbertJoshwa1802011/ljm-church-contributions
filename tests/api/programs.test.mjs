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

// Regression: an out-of-range dayOfWeek (e.g. 99, sent straight to the API
// bypassing the admin console's <select>) used to be stored as-is. The
// public /v2/programs.html renderer does `DAYS[p.dayOfWeek].slice(0, 3)` —
// DAYS[99] is undefined, so .slice() threw inside the render and broke the
// *entire* public programs page (every church's schedule) into an error
// state, confirmed live in a real browser during the adversarial QA session
// that added this test.
test("programs: POST rejects an out-of-range dayOfWeek", async () => {
  const db = freshDb();
  for (const bad of [7, 99, -1, -99]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Bad Day", dayOfWeek: bad }
    })));
    assert.equal(res.success, false, `dayOfWeek=${bad} must be rejected`);
    assert.match(res.message, /0 \(Sunday\) through 6 \(Saturday\)/);
  }
});

test("programs: POST accepts every valid dayOfWeek (0 Sunday .. 6 Saturday) and null", async () => {
  const db = freshDb();
  for (const good of [0, 1, 2, 3, 4, 5, 6, null]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Good Day " + good, dayOfWeek: good }
    })));
    assert.equal(res.success, true, res.message);
  }
});

test("programs: PUT also rejects an out-of-range dayOfWeek", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", dayOfWeek: 2 }
  })));
  const res = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "X", dayOfWeek: 42 }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /0 \(Sunday\) through 6 \(Saturday\)/);
});
