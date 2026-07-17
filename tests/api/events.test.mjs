// Characterization tests for /api/events — church events + photo galleries.
// events.js had ZERO test coverage before this file (see docs/testing/COVERAGE-TRACKER.md).
// R2 is not bound in the mock env, so POST/PUT photo uploads exercise the
// base64-fallback branch of storePhoto() — the realistic default in local dev
// without an EVENT_PHOTOS binding. The real R2 upload branch is a tracked,
// accepted gap (needs an R2 mock helper that doesn't exist yet).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as events from "../../functions/api/events.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("events: public GET listing shows only published events, with categories", async () => {
  const db = freshDb();
  await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Draft Event", status: "draft", category: "Outreach" }
  }));
  await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Published Event", status: "published", category: "Youth" }
  }));

  const res = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/events"
  })));
  assert.equal(res.events.length, 1);
  assert.equal(res.events[0].title, "Published Event");
  assert.deepEqual(res.categories, ["Youth"]);
});

test("events: GET ?id= returns any status (not just published) plus its photos", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Draft Detail", status: "draft" }
  })));

  const res = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(res.event.title, "Draft Detail");
  assert.equal(res.event.status, "draft");
  assert.deepEqual(res.photos, []);
});

test("events: GET ?id= for a nonexistent event is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/events?id=999999"
  })));
  assert.equal(res.success, false);
});

test("events: GET ?all=1 requires manage_events and returns every status", async () => {
  const db = freshDb();
  await events.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/events", body: { title: "A", status: "draft" } }));
  await events.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/events", body: { title: "B", status: "published" } }));

  const denied = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/events?all=1"
  })));
  assert.equal(denied.success, false);

  const res = await readJson(await events.onRequestGet(makeContext({ db, url: "https://test.local/api/events?all=1" })));
  assert.equal(res.events.length, 2);
});

test("events: POST creates an event with a cover photo (base64-fallback storage) and requires manage_events", async () => {
  const db = freshDb();
  const denied = await readJson(await events.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/events", body: { title: "X" }
  })));
  assert.equal(denied.success, false);

  const res = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Christmas Outreach", status: "published", coverPhoto: TINY_PNG_DATA_URL, extra: { note: "great day" } }
  })));
  assert.equal(res.success, true, res.message);

  const detail = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/events?id=${res.id}`
  })));
  assert.ok(detail.event.coverPhoto.startsWith("data:image/png;base64,"), "no R2 binding in the mock env, so base64 is stored as-is");
  assert.deepEqual(detail.event.extra, { note: "great day" });
});

test("events: POST requires a title", async () => {
  const db = freshDb();
  const res = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events", body: { status: "published" }
  })));
  assert.equal(res.success, false);
});

test("events: POST with gallery photos but no cover photo falls back to the first gallery photo as the cover", async () => {
  const db = freshDb();
  const res = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: {
      title: "Gallery Event",
      photos: [
        { dataUrl: TINY_PNG_DATA_URL, caption: "first" },
        { dataUrl: TINY_PNG_DATA_URL, caption: "second" }
      ]
    }
  })));
  assert.equal(res.success, true, res.message);

  const detail = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/events?id=${res.id}`
  })));
  assert.ok(detail.event.coverPhoto, "cover should be backfilled from the first gallery photo");
  assert.equal(detail.photos.length, 2);
  assert.equal(detail.photos[0].caption, "first");
});

test("events: PUT updates fields, adds and removes photos, and 404s for a nonexistent id", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Original Title", status: "draft", photos: [{ dataUrl: TINY_PNG_DATA_URL, caption: "keep" }] }
  })));
  let detail = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/events?id=${create.id}` })));
  const keepPhotoId = detail.photos[0].id;

  const update = await readJson(await events.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/events",
    body: {
      id: create.id, title: "Updated Title", status: "published",
      removePhotoIds: [],
      addPhotos: [{ dataUrl: TINY_PNG_DATA_URL, caption: "new" }]
    }
  })));
  assert.equal(update.success, true, update.message);

  detail = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/events?id=${create.id}` })));
  assert.equal(detail.event.title, "Updated Title");
  assert.equal(detail.event.status, "published");
  assert.equal(detail.photos.length, 2, "one kept + one added");

  const removeUpdate = await readJson(await events.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/events",
    body: { id: create.id, title: "Updated Title", removePhotoIds: [keepPhotoId] }
  })));
  assert.equal(removeUpdate.success, true, removeUpdate.message);
  detail = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/events?id=${create.id}` })));
  assert.equal(detail.photos.length, 1, "removed photo should be gone, added one remains");

  const missing = await readJson(await events.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/events", body: { id: 999999, title: "Nope" }
  })));
  assert.equal(missing.success, false);
});

test("events: PUT requires manage_events", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/events", body: { title: "T" } })));
  const res = await readJson(await events.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/events", body: { id: create.id, title: "Hacked" }
  })));
  assert.equal(res.success, false);
});

test("events: DELETE removes the event and its photos, and 404s for a nonexistent id", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "To Delete", photos: [{ dataUrl: TINY_PNG_DATA_URL }] }
  })));

  const del = await readJson(await events.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(del.success, true, del.message);

  const gone = await db.prepare("SELECT id FROM events WHERE id = ?").bind(create.id).first();
  assert.equal(gone, null);
  const photosGone = await db.prepare("SELECT COUNT(*) AS n FROM event_photos WHERE event_id = ?").bind(create.id).first();
  assert.equal(photosGone.n, 0, "photos must be cleaned up alongside the event");

  const missing = await readJson(await events.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/events?id=999999"
  })));
  assert.equal(missing.success, false);
});

test("events: DELETE requires manage_events", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/events", body: { title: "T" } })));
  const res = await readJson(await events.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(res.success, false);
});
