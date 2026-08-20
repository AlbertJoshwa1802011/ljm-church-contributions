import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as promises from "../../functions/api/promises.js";

async function readJson(res) { return JSON.parse(await res.text()); }

function istToday() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return { date: ist.toISOString().slice(0, 10), month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() };
}

test("promises: ?when=today resolves the exact daily/monthly/yearly rows for right now", async () => {
  const db = freshDb();
  const now = istToday();

  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: now.date, textEn: "Today's word" }
  }));
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "monthly", month: now.month, year: now.year, textEn: "This month's word" }
  }));
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "yearly", year: now.year, textEn: "This year's word" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/promises?when=today" })));
  assert.equal(res.today.daily.textEn, "Today's word");
  assert.equal(res.today.monthly.textEn, "This month's word");
  assert.equal(res.today.yearly.textEn, "This year's word");
});

test("promises: falls back to most recent published row of a scope when nothing is assigned for right now", async () => {
  const db = freshDb();
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2020-01-01", textEn: "An old promise" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/promises?when=today" })));
  assert.equal(res.today.daily.textEn, "An old promise");
  assert.equal(res.today.monthly, null);
});

test("promises: unpublished rows never surface in the today-resolver", async () => {
  const db = freshDb();
  const now = istToday();
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: now.date, textEn: "Draft", isPublished: false }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/promises?when=today" })));
  assert.equal(res.today.daily, null);
});

test("promises: admin listing (no ?when=) requires manage_content", async () => {
  const db = freshDb();
  const denied = await readJson(await promises.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/promises" })));
  assert.equal(denied.success, false);

  const res = await readJson(await promises.onRequestGet(makeContext({ db, url: "https://test.local/api/promises" })));
  assert.equal(res.success, true);
});

test("promises: POST validates scope-specific required fields and permission", async () => {
  const db = freshDb();
  const denied = await readJson(await promises.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2026-01-01", textEn: "X" }
  })));
  assert.equal(denied.success, false);

  const missingDate = await readJson(await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises", body: { scope: "daily", textEn: "X" }
  })));
  assert.equal(missingDate.success, false);
});

test("promises: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await promises.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/promises", body: { id: 999999, scope: "yearly", year: 2026, textEn: "X" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await promises.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/promises?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("promises: PUT edits and DELETE removes", async () => {
  const db = freshDb();
  const create = await readJson(await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "yearly", year: 2026, textEn: "Original" }
  })));

  await promises.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/promises",
    body: { id: create.id, scope: "yearly", year: 2026, textEn: "Edited" }
  }));

  const list = await readJson(await promises.onRequestGet(makeContext({ db, url: "https://test.local/api/promises" })));
  assert.equal(list.promises[0].textEn, "Edited");

  const del = await readJson(await promises.onRequestDelete(makeContext({ db, method: "DELETE", url: `https://test.local/api/promises?id=${create.id}` })));
  assert.equal(del.success, true);

  const after = await readJson(await promises.onRequestGet(makeContext({ db, url: "https://test.local/api/promises" })));
  assert.equal(after.promises.length, 0);
});

test("promises: malformed JSON body returns 400, not a 500 with a leaked parser error", async () => {
  const db = freshDb();
  const ctx = makeContext({ db, method: "POST", url: "https://test.local/api/promises" });
  ctx.request.json = async () => { throw new SyntaxError("Unexpected token"); };
  const res = await promises.onRequestPost(ctx);
  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
});
