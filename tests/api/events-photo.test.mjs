// Characterization tests for /api/events/photo — serves R2-stored event photos.
// Covers the testable subset without a real R2 mock (see docs/testing/COVERAGE-TRACKER.md
// for the accepted-gap note on the real R2 object-fetch branch).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as photo from "../../functions/api/events/photo.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("events/photo: missing key query param is a 404", async () => {
  const res = await photo.onRequestGet({
    env: {}, request: { url: "https://test.local/api/events/photo" }
  });
  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.match(body.error, /Missing key/);
});

test("events/photo: no EVENT_PHOTOS binding configured is a 404", async () => {
  const res = await photo.onRequestGet({
    env: {}, request: { url: "https://test.local/api/events/photo?key=events/1/x.jpg" }
  });
  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.match(body.error, /not configured/);
});

test("events/photo: an R2 binding that returns null for the key is a 404", async () => {
  const fakeR2 = { get: async () => null };
  const res = await photo.onRequestGet({
    env: { EVENT_PHOTOS: fakeR2 },
    request: { url: "https://test.local/api/events/photo?key=events/1/missing.jpg" }
  });
  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.match(body.error, /not found/);
});

test("events/photo: a found R2 object is streamed back with its content type", async () => {
  const fakeR2 = {
    get: async (key) => key === "events/1/x.jpg"
      ? { body: "fake-bytes", httpMetadata: { contentType: "image/png" } }
      : null
  };
  const res = await photo.onRequestGet({
    env: { EVENT_PHOTOS: fakeR2 },
    request: { url: "https://test.local/api/events/photo?key=events/1/x.jpg" }
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/png");
});

test("events/photo: OPTIONS responds with CORS headers", async () => {
  const res = await photo.onRequestOptions();
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
