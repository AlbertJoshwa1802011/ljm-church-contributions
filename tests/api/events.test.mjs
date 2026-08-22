// Characterization tests for /api/events — church events + photo galleries.
// events.js had ZERO test coverage before this file (see docs/testing/COVERAGE-TRACKER.md).
// R2 is not bound in the mock env, so POST/PUT photo uploads exercise the
// base64-fallback branch of storePhoto() — the realistic default in local dev
// without an EVENT_PHOTOS binding. The real R2 upload branch is a tracked,
// accepted gap (needs an R2 mock helper that doesn't exist yet).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext, makeBadJsonContext } from "../helpers/mock-d1.mjs";
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

test("events: GET ?id= for a published event is public (no auth required)", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Published Detail", status: "published" }
  })));

  const res = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(res.event.title, "Published Detail");
  assert.equal(res.event.status, "published");
  assert.deepEqual(res.photos, []);
});

// IDOR regression: this used to return a draft event's full content (title,
// description, extra JSON, beneficiary counts, gallery photos) to ANY
// unauthenticated caller who guessed/incremented the numeric id — the id
// wasn't gated by status at all. Only the public listing filtered by
// status='published'; the single-event lookup didn't. Fixed to require
// manage_events for any non-published status, responding 404 either way so
// a probe can't even confirm a draft exists.
test("events: GET ?id= for a draft event requires manage_events (IDOR fix) — anonymous gets 404, admin sees it", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Secret Draft", status: "draft", description: "internal planning notes" }
  })));

  const anon = await readJson(await events.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(anon.success, false, "an anonymous caller must not see draft content");
  assert.equal(anon.event, undefined);

  const admin = await readJson(await events.onRequestGet(makeContext({
    db, url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(admin.event.title, "Secret Draft", "an authorized manage_events caller can still preview the draft");
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

  // No explicit status was supplied, so this event is a draft (manage_events-only detail lookup).
  const detail = await readJson(await events.onRequestGet(makeContext({
    db, url: `https://test.local/api/events?id=${res.id}`
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
  // Still a draft at this point, so the detail lookup needs manage_events auth (see IDOR test above).
  let detail = await readJson(await events.onRequestGet(makeContext({ db, url: `https://test.local/api/events?id=${create.id}` })));
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

test("events: POST normalizes an arbitrary/garbage status to 'draft' instead of storing it verbatim", async () => {
  const db = freshDb();
  const res = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Weird Status Event", status: "totally_not_a_real_status" }
  })));
  assert.equal(res.success, true, res.message);

  const detail = await readJson(await events.onRequestGet(makeContext({ db, url: `https://test.local/api/events?id=${res.id}` })));
  assert.equal(detail.event.status, "draft", "an unrecognized status must collapse to 'draft', not be stored as-is");
});

// Regression: a PUT that only touches photos (no `status` field in the body)
// used to silently flip a published event back to 'draft', because the old
// code treated a missing status as "set to draft" instead of "leave as-is".
test("events: PUT that omits `status` preserves the event's current status (does not silently unpublish)", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Published Event", status: "published" }
  })));

  const photoOnlyUpdate = await readJson(await events.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/events",
    body: { id: create.id, title: "Published Event", addPhotos: [{ dataUrl: TINY_PNG_DATA_URL }] }
  })));
  assert.equal(photoOnlyUpdate.success, true, photoOnlyUpdate.message);

  const detail = await readJson(await events.onRequestGet(makeContext({ db, url: `https://test.local/api/events?id=${create.id}` })));
  assert.equal(detail.event.status, "published", "omitting `status` on an update must not unpublish the event");
});

test("events: PUT also normalizes an arbitrary/garbage status the same way POST does", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events", body: { title: "T", status: "draft" }
  })));
  const res = await readJson(await events.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/events",
    body: { id: create.id, title: "T", status: "totally_not_a_real_status" }
  })));
  assert.equal(res.success, true, res.message);
  const detail = await readJson(await events.onRequestGet(makeContext({ db, url: `https://test.local/api/events?id=${create.id}` })));
  assert.equal(detail.event.status, "draft");
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

test("events: malformed JSON body on POST/PUT is a 400, not a 500", async () => {
  const db = freshDb();
  const post = await events.onRequestPost(makeBadJsonContext({ db, method: "POST", url: "https://test.local/api/events" }));
  assert.equal(post.status, 400);
  const put = await events.onRequestPut(makeBadJsonContext({ db, method: "PUT", url: "https://test.local/api/events" }));
  assert.equal(put.status, 400);
});

test("events: DELETE requires manage_events", async () => {
  const db = freshDb();
  const create = await readJson(await events.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/events", body: { title: "T" } })));
  const res = await readJson(await events.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/events?id=${create.id}`
  })));
  assert.equal(res.success, false);
});
