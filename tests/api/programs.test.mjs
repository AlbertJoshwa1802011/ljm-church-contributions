// Behavioral tests for /api/programs (milestone v2, Phase 4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as programs from "../../functions/api/programs.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("programs: public GET shows only active programs, filterable by church and ministry", async () => {
  const db = freshDb();
  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Sunday Service", churchId: 1, dayOfWeek: 0 }
  }));
  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Youth Fellowship", ministryArea: "youth", dayOfWeek: 5, status: "archived" }
  }));

  const publicList = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs"
  })));
  assert.equal(publicList.programs.length, 1, "archived programs must not show publicly");

  const byChurch = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs?church=1"
  })));
  assert.equal(byChurch.programs.length, 1);
  assert.equal(byChurch.programs[0].titleEn, "Sunday Service");
});

test("programs: mutations require manage_content", async () => {
  const db = freshDb();
  const denied = await readJson(await programs.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "X" }
  })));
  assert.equal(denied.success, false);
});

test("programs: admin can update and delete", async () => {
  const db = freshDb();
  const created = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Bible Study", dayOfWeek: 3 }
  })));
  const updated = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs",
    body: { id: created.id, titleEn: "Bible Study (updated)" }
  })));
  assert.equal(updated.success, true);
  const deleted = await readJson(await programs.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/programs?id=${created.id}`
  })));
  assert.equal(deleted.success, true);
});

test("programs: dayOfWeek must be within 0-6", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Bad day", dayOfWeek: 9 }
  })));
  assert.equal(res.success, false);
});
