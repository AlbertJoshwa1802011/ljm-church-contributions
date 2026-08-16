// Behavioral tests for /api/churches (milestone v2, Phase 0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as churches from "../../functions/api/churches.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("churches: fresh schema seeds the two known churches, active + public", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/churches"
  })));
  assert.equal(res.success, true);
  assert.equal(res.churches.length, 2);
  const slugs = res.churches.map(c => c.slug).sort();
  assert.deepEqual(slugs, ["church-of-light", "city-worship-center"]);
  assert.equal(res.churches.find(c => c.slug === "church-of-light").isMotherChurch, true);
});

test("churches: POST/PUT/DELETE require manage_funds", async () => {
  const db = freshDb();
  const denied = await readJson(await churches.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "x", nameEn: "X" }
  })));
  assert.equal(denied.success, false);
});

test("churches: admin can create, update, and archive (soft delete)", async () => {
  const db = freshDb();
  const created = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "third-church", nameEn: "Third Church" }
  })));
  assert.equal(created.success, true);

  const updated = await readJson(await churches.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/churches",
    body: { id: created.id, nameEn: "Third Church Renamed" }
  })));
  assert.equal(updated.success, true);

  const archived = await readJson(await churches.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/churches?id=${created.id}`
  })));
  assert.equal(archived.success, true);

  const publicList = await readJson(await churches.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/churches"
  })));
  assert.ok(!publicList.churches.some(c => c.id === created.id), "archived church must not appear publicly");

  const allList = await readJson(await churches.onRequestGet(makeContext({
    db, url: "https://test.local/api/churches?all=1"
  })));
  assert.ok(allList.churches.some(c => c.id === created.id && c.status === "archived"));
});

test("churches: duplicate slug is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await churches.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/churches",
    body: { slug: "church-of-light", nameEn: "Dup" }
  })));
  assert.equal(res.success, false);
});
