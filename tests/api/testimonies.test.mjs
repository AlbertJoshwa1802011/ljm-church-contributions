// Behavioral tests for /api/testimonies (milestone v2, Phase 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as testimonies from "../../functions/api/testimonies.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("testimonies: public submission lands 'pending' and is not publicly visible", async () => {
  const db = freshDb();
  const submitted = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "God healed me", bodyEn: "The full story of my healing." }
  })));
  assert.equal(submitted.success, true);
  assert.ok(submitted.id);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies"
  })));
  assert.equal(publicList.testimonies.length, 0, "a pending submission must not be publicly visible");
});

test("testimonies: moderation queue (?all=1) requires manage_content and shows every status", async () => {
  const db = freshDb();
  await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "T1", bodyEn: "Body 1" }
  }));

  const denied = await readJson(await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies?all=1"
  })));
  assert.equal(denied.success, false);

  const allowed = await readJson(await testimonies.onRequestGet(makeContext({
    db, url: "https://test.local/api/testimonies?all=1"
  })));
  assert.equal(allowed.testimonies.length, 1);
  assert.equal(allowed.testimonies[0].status, "pending");
});

test("testimonies: a moderator publishing a submission makes it publicly visible", async () => {
  const db = freshDb();
  const submitted = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "Miracle story", bodyEn: "Full account.", kind: "miracle" }
  })));

  const denied = await readJson(await testimonies.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/testimonies",
    body: { id: submitted.id, status: "published" }
  })));
  assert.equal(denied.success, false, "publishing requires manage_content");

  const moderated = await readJson(await testimonies.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/testimonies",
    body: { id: submitted.id, status: "published" }
  })));
  assert.equal(moderated.success, true);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies?kind=miracle"
  })));
  assert.equal(publicList.testimonies.length, 1);
  assert.equal(publicList.testimonies[0].titleEn, "Miracle story");
  assert.ok(publicList.testimonies[0].publishedAt);
});

test("testimonies: validation rejects missing required fields", async () => {
  const db = freshDb();
  const res = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "", bodyEn: "" }
  })));
  assert.equal(res.success, false);
});

test("testimonies: delete requires manage_content", async () => {
  const db = freshDb();
  const submitted = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "To delete", bodyEn: "Body" }
  })));
  const denied = await readJson(await testimonies.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/testimonies?id=${submitted.id}`
  })));
  assert.equal(denied.success, false);
  const deleted = await readJson(await testimonies.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/testimonies?id=${submitted.id}`
  })));
  assert.equal(deleted.success, true);
});
