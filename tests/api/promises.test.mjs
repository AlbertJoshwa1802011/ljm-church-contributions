// Behavioral tests for /api/promises (milestone v2, Phase 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as promises from "../../functions/api/promises.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("promises: today-resolver falls back to the most recent published row per scope when nothing matches today", async () => {
  const db = freshDb();
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2020-01-01", textEn: "Old daily promise" }
  }));
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "monthly", year: 2020, month: 1, textEn: "Old monthly promise" }
  }));
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "yearly", year: 2020, textEn: "Old yearly promise" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  })));
  assert.equal(res.success, true);
  assert.equal(res.today.daily.textEn, "Old daily promise");
  assert.equal(res.today.monthly.textEn, "Old monthly promise");
  assert.equal(res.today.yearly.textEn, "Old yearly promise");
});

test("promises: today-resolver prefers an exact match for today's date over the fallback", async () => {
  const db = freshDb();
  const { istToday } = promises;
  const { dateStr, year, month } = istToday();

  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2020-01-01", textEn: "Fallback" }
  }));
  await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: dateStr, textEn: "Today's exact promise" }
  }));

  const res = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?when=today"
  })));
  assert.equal(res.today.daily.textEn, "Today's exact promise");
  assert.equal(res.today.daily.onDate, dateStr);
  assert.ok(year && month);
});

test("promises: unpublished rows never surface publicly, but do via ?all=1", async () => {
  const db = freshDb();
  const created = await readJson(await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2026-01-01", textEn: "Unpublished", isPublished: false }
  })));

  const publicList = await readJson(await promises.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/promises?scope=daily"
  })));
  assert.ok(!publicList.promises.some(p => p.id === created.id));

  const allList = await readJson(await promises.onRequestGet(makeContext({
    db, url: "https://test.local/api/promises?all=1"
  })));
  assert.ok(allList.promises.some(p => p.id === created.id));
});

test("promises: mutations require manage_content; validation rejects missing required fields", async () => {
  const db = freshDb();
  const denied = await readJson(await promises.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", onDate: "2026-01-01", textEn: "X" }
  })));
  assert.equal(denied.success, false);

  const missingDate = await readJson(await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "daily", textEn: "No date" }
  })));
  assert.equal(missingDate.success, false);
});

test("promises: delete removes the row", async () => {
  const db = freshDb();
  const created = await readJson(await promises.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/promises",
    body: { scope: "yearly", year: 2027, textEn: "To delete" }
  })));
  const deleted = await readJson(await promises.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/promises?id=${created.id}`
  })));
  assert.equal(deleted.success, true);
  const notFound = await readJson(await promises.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/promises?id=${created.id}`
  })));
  assert.equal(notFound.success, false);
});
