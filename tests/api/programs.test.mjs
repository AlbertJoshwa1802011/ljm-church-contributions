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

// Regression: the public Programs page (v2/programs.html) renders
// DAYS[dayOfWeek] from a fixed 7-entry array with no bounds check. An
// out-of-range dayOfWeek stored via the API (previously accepted with no
// validation at all) makes that array index undefined and throws inside the
// page's render loop — breaking the ENTIRE public programs list for every
// visitor, not just the one bad row.
test("programs: POST rejects an out-of-range dayOfWeek instead of storing it", async () => {
  const db = freshDb();
  for (const bad of [999, -1, 7, 3.5, NaN]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs",
      body: { titleEn: "Bad Day", dayOfWeek: bad }
    })));
    assert.equal(res.success, false, `dayOfWeek=${bad} must be rejected`);
  }
  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.length, 0, "no program should have been created with an invalid dayOfWeek");
});

test("programs: POST accepts every in-range dayOfWeek (0-6) and null/omitted for one-off programs", async () => {
  const db = freshDb();
  for (const good of [0, 1, 6]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs",
      body: { titleEn: `Day ${good}`, dayOfWeek: good }
    })));
    assert.equal(res.success, true, res.message);
  }
  const omitted = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "One-off" }
  })));
  assert.equal(omitted.success, true, omitted.message);
  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.titleEn === "One-off").dayOfWeek, null);
});

test("programs: PUT rejects an out-of-range dayOfWeek", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", dayOfWeek: 2 }
  })));
  const res = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs",
    body: { id: create.id, titleEn: "X", dayOfWeek: 999 }
  })));
  assert.equal(res.success, false);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.id === create.id).dayOfWeek, 2, "the original valid value must be untouched by the rejected update");
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

test("programs: POST/PUT reject an out-of-range dayOfWeek (regression: 7/99/-1 crashed v2/programs.html's DAYS[] lookup)", async () => {
  const db = freshDb();
  for (const bad of [7, 99, -1, 1.5]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Bad Day", dayOfWeek: bad }
    })));
    assert.equal(res.success, false, `dayOfWeek=${bad} should be rejected`);
  }

  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Sunday Service", dayOfWeek: 0 }
  })));
  assert.equal(create.success, true);

  const putRes = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "Sunday Service", dayOfWeek: 99 }
  })));
  assert.equal(putRes.success, false);
});

test("programs: POST/PUT accept a null/empty dayOfWeek (one-off programs) and valid 0-6", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Full Night Prayer", dayOfWeek: null, recurrence: "monthly-2nd-friday" }
  })));
  assert.equal(create.success, true);

  const six = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Saturday Service", dayOfWeek: 6 }
  })));
  assert.equal(six.success, true);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  const saved = all.programs.find(p => p.titleEn === "Full Night Prayer");
  assert.equal(saved.dayOfWeek, null);
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
