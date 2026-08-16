import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as promises from "../../functions/api/promises.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

function istToday() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return {
    onDate: ist.toISOString().slice(0, 10),
    month: ist.getUTCMonth() + 1,
    year: ist.getUTCFullYear()
  };
}

test("promises: today-resolver returns an exact-date daily match over a fallback", async () => {
  const db = freshDb();
  const { onDate, month, year } = istToday();

  await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", onDate: "2020-01-01", textEn: "Old fallback promise" }
  }));
  await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", onDate, textEn: "Today's real promise", reference: "Isaiah 41:10" }
  }));
  await promises.onRequestPost(makeContext({
    db, body: { scope: "monthly", month, year, textEn: "This month's promise" }
  }));
  await promises.onRequestPost(makeContext({
    db, body: { scope: "yearly", year, textEn: "This year's promise" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  })));
  assert.equal(res.success, true);
  assert.equal(res.today.daily.textEn, "Today's real promise");
  assert.equal(res.today.monthly.textEn, "This month's promise");
  assert.equal(res.today.yearly.textEn, "This year's promise");
});

test("promises: today-resolver falls back to the most recently published row when no exact match exists", async () => {
  const db = freshDb();
  await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", onDate: "2020-01-01", textEn: "Older" }
  }));
  await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", onDate: "2021-06-15", textEn: "Newer fallback" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  })));
  assert.equal(res.today.daily.textEn, "Newer fallback");
  assert.equal(res.today.monthly, null);
  assert.equal(res.today.yearly, null);
});

test("promises: an unpublished promise is never returned by the today-resolver", async () => {
  const db = freshDb();
  const { onDate } = istToday();
  await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", onDate, textEn: "Draft, not ready", isPublished: false }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  })));
  assert.equal(res.today.daily, null);
});

test("promises: ?when=today is public, no authentication required", async () => {
  const db = freshDb();
  const res = await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  }));
  assert.equal(res.status, 200);
});

test("promises: admin list/detail requires manage_content permission", async () => {
  const db = freshDb();
  const listRes = await promises.onRequestGet(makeContext({ db, authToken: null }));
  assert.equal(listRes.status, 401);

  const detailRes = await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?id=1"
  }));
  assert.equal(detailRes.status, 401);
});

test("promises: full create -> edit -> delete round trip via admin list/detail", async () => {
  const db = freshDb();
  const addRes = await readJson(await promises.onRequestPost(makeContext({
    db, body: { scope: "yearly", year: 2026, textEn: "The Lord is my strength", reference: "Ps 28:7" }
  })));
  assert.equal(addRes.success, true);
  const id = addRes.id;

  const detail = await readJson(await promises.onRequestGet(makeContext({
    db, url: `https://test.local/api/promises?id=${id}`
  })));
  assert.equal(detail.promise.textEn, "The Lord is my strength");

  const updateRes = await readJson(await promises.onRequestPut(makeContext({
    db, body: { id, textEn: "The Lord is my strength and my shield" }
  })));
  assert.equal(updateRes.success, true);

  const afterUpdate = await readJson(await promises.onRequestGet(makeContext({
    db, url: `https://test.local/api/promises?id=${id}`
  })));
  assert.equal(afterUpdate.promise.textEn, "The Lord is my strength and my shield");

  const deleteRes = await readJson(await promises.onRequestDelete(makeContext({
    db, url: `https://test.local/api/promises?id=${id}`
  })));
  assert.equal(deleteRes.success, true);

  const afterDelete = await promises.onRequestGet(makeContext({
    db, url: `https://test.local/api/promises?id=${id}`
  }));
  assert.equal(afterDelete.status, 404);
});

test("promises: POST validates scope-specific required fields", async () => {
  const db = freshDb();
  const badScope = await readJson(await promises.onRequestPost(makeContext({
    db, body: { scope: "weekly", textEn: "x" }
  })));
  assert.equal(badScope.success, false);

  const missingText = await readJson(await promises.onRequestPost(makeContext({
    db, body: { scope: "yearly", year: 2026 }
  })));
  assert.equal(missingText.success, false);

  const missingOnDate = await readJson(await promises.onRequestPost(makeContext({
    db, body: { scope: "daily", textEn: "x" }
  })));
  assert.equal(missingOnDate.success, false);

  const missingMonthYear = await readJson(await promises.onRequestPost(makeContext({
    db, body: { scope: "monthly", textEn: "x" }
  })));
  assert.equal(missingMonthYear.success, false);
});

test("promises: PUT/DELETE nonexistent id -> 404, PUT missing id -> 400", async () => {
  const db = freshDb();
  const missingId = await promises.onRequestPut(makeContext({ db, body: { textEn: "x" } }));
  assert.equal(missingId.status, 400);

  const notFoundPut = await promises.onRequestPut(makeContext({ db, body: { id: 999, textEn: "x" } }));
  assert.equal(notFoundPut.status, 404);

  const notFoundDelete = await promises.onRequestDelete(makeContext({
    db, url: "https://test.local/api/promises?id=999"
  }));
  assert.equal(notFoundDelete.status, 404);
});
