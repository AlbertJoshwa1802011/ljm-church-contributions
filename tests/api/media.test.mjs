// Tests for /api/media — the R2 serve endpoint for admin-uploaded hero slides,
// video thumbnails and church photos, and the key allowlist that keeps it
// scoped to those prefixes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeContext } from "../helpers/mock-d1.mjs";
import * as media from "../../functions/api/media.js";
import { isValidMediaKey, storeMedia, deleteMedia } from "../../functions/api/_media.js";

function url(qs) { return "https://test.local/api/media" + (qs || ""); }

function fakeR2(seed) {
  const store = new Map(Object.entries(seed || {}));
  return {
    store,
    async put(key, bytes, opts) { store.set(key, { bytes, opts }); },
    async get(key) {
      if (!store.has(key)) return null;
      const v = store.get(key);
      return { body: v.bytes || v, httpMetadata: (v.opts && v.opts.httpMetadata) || {} };
    },
    async delete(key) { store.delete(key); }
  };
}

test("media: only the hero/, videos/ and churches/ prefixes are valid keys", () => {
  assert.ok(isValidMediaKey("hero/abc-123.jpg"));
  assert.ok(isValidMediaKey("videos/abc_123.png"));
  assert.ok(isValidMediaKey("churches/a.webp"));

  // Event photos live in the same bucket but are served by their own endpoint.
  assert.equal(isValidMediaKey("events/12/abc.jpg"), false);
  assert.equal(isValidMediaKey("hero/../events/12/abc.jpg"), false);
  assert.equal(isValidMediaKey("hero/nested/abc.jpg"), false);
  assert.equal(isValidMediaKey("../secrets.txt"), false);
  assert.equal(isValidMediaKey("hero/"), false);
  assert.equal(isValidMediaKey(""), false);
  assert.equal(isValidMediaKey(null), false);
});

test("media: a missing key is a 404", async () => {
  const res = await media.onRequestGet(makeContext({ url: url() }));
  assert.equal(res.status, 404);
});

test("media: a key outside the allowlist is rejected before touching R2", async () => {
  const r2 = fakeR2({ "events/12/secret.jpg": { bytes: new Uint8Array([1]) } });
  const ctx = makeContext({ url: url("?key=events/12/secret.jpg") });
  ctx.env.EVENT_PHOTOS = r2;

  const res = await media.onRequestGet(ctx);
  assert.equal(res.status, 400);
  assert.match(JSON.parse(await res.text()).error, /Invalid media key/);
});

test("media: an unbound bucket is a 404, not a 500", async () => {
  const res = await media.onRequestGet(makeContext({ url: url("?key=hero/a.jpg") }));
  assert.equal(res.status, 404);
  assert.match(JSON.parse(await res.text()).error, /not configured/);
});

test("media: an unknown key in a bound bucket is a 404", async () => {
  const ctx = makeContext({ url: url("?key=hero/nope.jpg") });
  ctx.env.EVENT_PHOTOS = fakeR2();
  const res = await media.onRequestGet(ctx);
  assert.equal(res.status, 404);
});

test("media: a stored object is served with its content type and an immutable cache", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const r2 = fakeR2({ "hero/a.png": { bytes, opts: { httpMetadata: { contentType: "image/png" } } } });
  const ctx = makeContext({ url: url("?key=hero/a.png") });
  ctx.env.EVENT_PHOTOS = r2;

  const res = await media.onRequestGet(ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/png");
  assert.match(res.headers.get("Cache-Control"), /immutable/);
});

test("media: storeMedia routes data URLs to R2 and passes through hosted URLs", async () => {
  const r2 = fakeR2();
  const uploaded = await storeMedia({ EVENT_PHOTOS: r2 }, "hero", "data:image/jpeg;base64,/9j/4AAQ");
  assert.equal(uploaded.storage, "r2");
  assert.ok(isValidMediaKey(decodeURIComponent(uploaded.url.split("key=")[1])));

  const external = await storeMedia({ EVENT_PHOTOS: r2 }, "hero", "https://cdn.example.com/a.jpg");
  assert.deepEqual(external, { url: "https://cdn.example.com/a.jpg", storage: "external" });

  // An already-stored URL round-trips unchanged so an edit doesn't re-upload.
  const existing = await storeMedia({ EVENT_PHOTOS: r2 }, "hero", uploaded.url);
  assert.deepEqual(existing, { url: uploaded.url, storage: "r2" });

  assert.equal(await storeMedia({}, "hero", ""), null);
});

test("media: storeMedia falls back to base64 when no bucket is bound", async () => {
  const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
  const stored = await storeMedia({}, "hero", dataUrl);
  assert.deepEqual(stored, { url: dataUrl, storage: "base64" });
});

test("media: storeMedia refuses an unknown prefix", async () => {
  await assert.rejects(() => storeMedia({}, "events", "data:image/jpeg;base64,AA"), /Unsupported media prefix/);
});

test("media: deleteMedia only removes r2-backed objects and never throws", async () => {
  const r2 = fakeR2({ "hero/a.jpg": { bytes: new Uint8Array([1]) } });
  const env = { EVENT_PHOTOS: r2 };

  await deleteMedia(env, "https://cdn.example.com/a.jpg", "external");
  assert.equal(r2.store.size, 1, "external URLs have no object to delete");

  await deleteMedia(env, "/api/media?key=hero/a.jpg", "r2");
  assert.equal(r2.store.size, 0);

  // Garbage in must not throw — cleanup is best-effort by design.
  await deleteMedia(env, "not a url", "r2");
  await deleteMedia(env, null, "r2");
  await deleteMedia({}, "/api/media?key=hero/a.jpg", "r2");
});

test("media: OPTIONS preflight is allowed", async () => {
  const res = await media.onRequestOptions();
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
