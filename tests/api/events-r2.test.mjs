// OFFLINE R2 MOCK TEST — exercises functions/api/events.js's real R2 branch
// (env.EVENT_PHOTOS.put/get/delete) using the in-memory mock from
// tests/helpers/mock-r2.mjs, instead of the base64-fallback branch that
// tests/api/events.test.mjs covers when no R2 binding is present.
//
// This is NOT a real Cloudflare R2 integration test — no network, no
// Cloudflare credentials, no real bucket. It only proves the application
// code's put/get/delete call shape and best-effort-cleanup contract behave
// as written. See docs/testing/COVERAGE-TRACKER.md for the gap this closes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import { makeMockR2 } from "../helpers/mock-r2.mjs";
import * as events from "../../functions/api/events.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const TINY_JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

test("OFFLINE R2 MOCK TEST: POST create stores hero/cover photo through EVENT_PHOTOS", async () => {
  const db = freshDb();
  const r2 = makeMockR2();

  const res = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: { title: "R2 Cover Event", status: "published", coverPhoto: TINY_PNG_DATA_URL }
  })));
  assert.equal(res.success, true);

  // put() was actually invoked against the mock bucket, not skipped.
  assert.equal(r2._calls.put.length, 1);
  const key = r2._calls.put[0];
  assert.match(key, new RegExp(`^events/${res.id}/[a-f0-9-]+\\.png$`));

  // The stored object carries the content type through httpMetadata.
  const stored = r2._store.get(key);
  assert.ok(stored);
  assert.equal(stored.httpMetadata.contentType, "image/png");
});

test("OFFLINE R2 MOCK TEST: returned/persisted cover photo path matches the R2 key", async () => {
  const db = freshDb();
  const r2 = makeMockR2();

  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: { title: "Path Check Event", status: "published", coverPhoto: TINY_PNG_DATA_URL }
  })));

  const detail = await readJson(await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));

  const key = r2._calls.put[0];
  assert.equal(detail.event.coverPhoto, "/api/events/photo?key=" + encodeURIComponent(key));
});

test("OFFLINE R2 MOCK TEST: PUT replacing a gallery photo cleans up the previous R2 object", async () => {
  const db = freshDb();
  const r2 = makeMockR2();

  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: {
      title: "Gallery Event", status: "published",
      photos: [{ dataUrl: TINY_PNG_DATA_URL, caption: "old" }]
    }
  })));

  const detailBefore = await readJson(await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  const oldPhotoId = detailBefore.photos[0].id;
  const oldKey = r2._calls.put[0];
  assert.ok(r2._store.has(oldKey));

  // Replace: remove the old gallery photo, add a new one, in the same PUT —
  // this is the "replace an existing image" flow the admin UI drives.
  const putRes = await readJson(await events.onRequestPut(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "PUT", url: "https://test.local/api/events",
    body: {
      id: create.id, title: "Gallery Event", status: "published",
      removePhotoIds: [oldPhotoId],
      addPhotos: [{ dataUrl: TINY_JPEG_DATA_URL, caption: "new" }]
    }
  })));
  assert.equal(putRes.success, true);

  // Cleanup of the previous object was attempted (and, in this mock, succeeded).
  assert.deepEqual(r2._calls.delete, [oldKey]);
  assert.equal(r2._store.has(oldKey), false);

  // The new object was actually written.
  assert.equal(r2._calls.put.length, 2);
  const newKey = r2._calls.put[1];
  assert.ok(r2._store.has(newKey));
  assert.equal(r2._store.get(newKey).httpMetadata.contentType, "image/jpeg");
});

test("OFFLINE R2 MOCK TEST: PUT removePhotoIds alone attempts deletion of the R2 object", async () => {
  const db = freshDb();
  const r2 = makeMockR2();

  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: { title: "Remove-only Event", status: "published", photos: [{ dataUrl: TINY_PNG_DATA_URL }] }
  })));
  const detail = await readJson(await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  const photoId = detail.photos[0].id;
  const key = r2._calls.put[0];

  const putRes = await readJson(await events.onRequestPut(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "PUT", url: "https://test.local/api/events",
    body: { id: create.id, title: "Remove-only Event", status: "published", removePhotoIds: [photoId] }
  })));
  assert.equal(putRes.success, true);
  assert.deepEqual(r2._calls.delete, [key]);
  assert.equal(r2._store.has(key), false);
});

test("OFFLINE R2 MOCK TEST: DELETE cascades R2 cleanup for every event_photos row", async () => {
  const db = freshDb();
  const r2 = makeMockR2();

  // Two gallery photos, both persisted as event_photos rows — DELETE's cascade
  // walks that table (see events.js onRequestDelete). Note: a coverPhoto passed
  // standalone (not also present as a gallery row) is stored only in the events
  // table's cover_photo column and is NOT tracked/cleaned up by this cascade —
  // that's a pre-existing events.js characteristic, not something this test
  // asserts should be different (see Task 3 / COVERAGE-TRACKER follow-up note).
  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: {
      title: "Delete Cascade Event", status: "published",
      photos: [{ dataUrl: TINY_PNG_DATA_URL }, { dataUrl: TINY_JPEG_DATA_URL }]
    }
  })));
  assert.equal(r2._calls.put.length, 2);

  const delRes = await readJson(await events.onRequestDelete(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "DELETE", url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(delRes.success, true);
  assert.equal(r2._calls.delete.length, 2);
  assert.equal(r2._store.size, 0);
});

test("OFFLINE R2 MOCK TEST: a failed best-effort R2 delete does not break the PUT that triggered it", async () => {
  const db = freshDb();
  const r2 = makeMockR2({ failOn: { delete: true } });

  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: { title: "Cleanup Failure Event", status: "published", photos: [{ dataUrl: TINY_PNG_DATA_URL }] }
  })));
  const detail = await readJson(await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  const photoId = detail.photos[0].id;

  // deletePhotoObject() in events.js wraps the R2 .delete() call in try/catch
  // and swallows failures — the primary operation (removing the DB row) must
  // still succeed even though the mock's delete() throws.
  const putRes = await readJson(await events.onRequestPut(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "PUT", url: "https://test.local/api/events",
    body: { id: create.id, title: "Cleanup Failure Event", status: "published", removePhotoIds: [photoId] }
  })));
  assert.equal(putRes.success, true);
  assert.equal(r2._calls.delete.length, 1);

  const detailAfter = await readJson(await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(detailAfter.photos.length, 0);
});

test("OFFLINE R2 MOCK TEST: a failed best-effort R2 delete does not break DELETE of the event", async () => {
  const db = freshDb();
  const r2 = makeMockR2({ failOn: { delete: true } });

  const create = await readJson(await events.onRequestPost(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "POST", url: "https://test.local/api/events",
    body: { title: "Delete Failure Event", status: "published", coverPhoto: TINY_PNG_DATA_URL }
  })));

  const delRes = await readJson(await events.onRequestDelete(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, method: "DELETE", url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(delRes.success, true);

  const getRes = await events.onRequestGet(makeContext({
    db, env: { EVENT_PHOTOS: r2 }, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  }));
  assert.equal(getRes.status, 404);
});
