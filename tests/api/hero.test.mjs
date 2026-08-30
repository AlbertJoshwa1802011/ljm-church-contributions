// Tests for /api/hero — the admin-managed header carousel (issues 3 & 4 of
// docs/milestone-v2/13-home-experience-rework.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as hero from "../../functions/api/hero.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function url(qs) { return "https://test.local/api/hero" + (qs || ""); }

// A minimal in-memory stand-in for the EVENT_PHOTOS R2 binding.
function fakeR2() {
  const store = new Map();
  return {
    store,
    async put(key, bytes, opts) { store.set(key, { bytes, opts }); },
    async get(key) { return store.has(key) ? { body: store.get(key).bytes } : null; },
    async delete(key) { store.delete(key); }
  };
}

async function addSlide(db, body, env) {
  const ctx = makeContext({ db, method: "POST", url: url(), body });
  if (env) Object.assign(ctx.env, env);
  return readJson(await hero.onRequestPost(ctx));
}

test("hero: POST requires manage_content permission", async () => {
  const db = freshDb();
  const res = await readJson(await hero.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: url(), body: { imageLightUrl: PNG }
  })));
  assert.equal(res.success, false);
});

test("hero: PUT and DELETE require manage_content permission", async () => {
  const db = freshDb();
  const created = await addSlide(db, { imageLightUrl: PNG, titleEn: "Slide" });

  const put = await readJson(await hero.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: url(), body: { id: created.id, imageLightUrl: PNG }
  })));
  assert.equal(put.success, false);

  const del = await readJson(await hero.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: url("?id=" + created.id)
  })));
  assert.equal(del.success, false);
});

test("hero: ?all=1 admin listing requires auth; public GET does not", async () => {
  const db = freshDb();
  const gated = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url("?all=1") })));
  assert.equal(gated.success, false);

  const open = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(open.success, true);
  assert.deepEqual(open.slides, []);
});

test("hero: POST creates a slide and public GET returns it in sort order", async () => {
  const db = freshDb();
  await addSlide(db, { imageLightUrl: "https://cdn.test/b.jpg", titleEn: "Second", sortOrder: 2 });
  await addSlide(db, { imageLightUrl: "https://cdn.test/a.jpg", titleEn: "First", sortOrder: 1 });

  const res = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(res.success, true);
  assert.deepEqual(res.slides.map(s => s.titleEn), ["First", "Second"]);
});

test("hero: a light-mode image is required", async () => {
  const db = freshDb();
  const res = await addSlide(db, { titleEn: "No image" });
  assert.equal(res.success, false);
  assert.match(res.message, /light-mode image is required/);
});

test("hero: dark image is optional and reported as null when absent", async () => {
  const db = freshDb();
  await addSlide(db, { imageLightUrl: "https://cdn.test/light.jpg", titleEn: "Light only" });

  const res = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(res.slides[0].imageLightUrl, "https://cdn.test/light.jpg");
  assert.equal(res.slides[0].imageDarkUrl, null);
});

test("hero: archived slides are hidden from the public listing but visible to admin", async () => {
  const db = freshDb();
  const created = await addSlide(db, { imageLightUrl: "https://cdn.test/a.jpg", titleEn: "Visible" });

  const archived = await readJson(await hero.onRequestDelete(makeContext({
    db, method: "DELETE", url: url("?id=" + created.id)
  })));
  assert.equal(archived.success, true);

  const pub = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(pub.slides, []);

  const admin = await readJson(await hero.onRequestGet(makeContext({ db, url: url("?all=1") })));
  assert.equal(admin.slides.length, 1);
  assert.equal(admin.slides[0].status, "archived");
});

test("hero: slides outside their scheduled window are hidden from the public listing", async () => {
  const db = freshDb();
  await addSlide(db, { imageLightUrl: "https://cdn.test/past.jpg", titleEn: "Expired", startsOn: "2020-01-01", endsOn: "2020-12-31" });
  await addSlide(db, { imageLightUrl: "https://cdn.test/future.jpg", titleEn: "Not yet", startsOn: "2999-01-01" });
  await addSlide(db, { imageLightUrl: "https://cdn.test/now.jpg", titleEn: "Running", startsOn: "2020-01-01", endsOn: "2999-12-31" });
  await addSlide(db, { imageLightUrl: "https://cdn.test/always.jpg", titleEn: "Always" });

  const res = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(res.slides.map(s => s.titleEn).sort(), ["Always", "Running"]);
});

test("hero: malformed and contradictory dates are rejected", async () => {
  const db = freshDb();
  const bad = await addSlide(db, { imageLightUrl: PNG, startsOn: "31-12-2026" });
  assert.equal(bad.success, false);
  assert.match(bad.message, /YYYY-MM-DD/);

  const backwards = await addSlide(db, { imageLightUrl: PNG, startsOn: "2026-12-01", endsOn: "2026-01-01" });
  assert.equal(backwards.success, false);
  assert.match(backwards.message, /before startsOn/);
});

test("hero: PUT updates a slide; a missing id is a 400 and an unknown id a 404", async () => {
  const db = freshDb();
  const created = await addSlide(db, { imageLightUrl: "https://cdn.test/a.jpg", titleEn: "Before" });

  const noId = await readJson(await hero.onRequestPut(makeContext({ db, method: "PUT", url: url(), body: { imageLightUrl: PNG } })));
  assert.equal(noId.success, false);
  assert.match(noId.message, /id is required/);

  const missing = await hero.onRequestPut(makeContext({ db, method: "PUT", url: url(), body: { id: 9999, imageLightUrl: PNG } }));
  assert.equal(missing.status, 404);

  const ok = await readJson(await hero.onRequestPut(makeContext({
    db, method: "PUT", url: url(), body: { id: created.id, imageLightUrl: "https://cdn.test/a.jpg", titleEn: "After" }
  })));
  assert.equal(ok.success, true);

  const list = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.slides[0].titleEn, "After");
});

test("hero: editing an archived slide leaves it archived", async () => {
  const db = freshDb();
  const created = await addSlide(db, { imageLightUrl: "https://cdn.test/a.jpg", titleEn: "Slide" });
  await hero.onRequestDelete(makeContext({ db, method: "DELETE", url: url("?id=" + created.id) }));

  await hero.onRequestPut(makeContext({
    db, method: "PUT", url: url(), body: { id: created.id, imageLightUrl: "https://cdn.test/a.jpg", titleEn: "Renamed" }
  }));

  const admin = await readJson(await hero.onRequestGet(makeContext({ db, url: url("?all=1") })));
  assert.equal(admin.slides[0].status, "archived", "an edit must not silently republish an archived slide");

  const pub = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(pub.slides, []);
});

test("hero: DELETE of an unknown id is a 404", async () => {
  const db = freshDb();
  const res = await hero.onRequestDelete(makeContext({ db, method: "DELETE", url: url("?id=4242") }));
  assert.equal(res.status, 404);
});

test("hero: uploads go to R2 when bound, and fall back to base64 when not", async () => {
  const withR2 = freshDb();
  const r2 = fakeR2();
  await addSlide(withR2, { imageLightUrl: PNG, titleEn: "R2" }, { EVENT_PHOTOS: r2 });
  const stored = await readJson(await hero.onRequestGet(makeContext({ db: withR2, authToken: null, url: url() })));
  assert.match(stored.slides[0].imageLightUrl, /^\/api\/media\?key=hero%2F/);
  assert.equal(r2.store.size, 1);
  assert.ok([...r2.store.keys()][0].startsWith("hero/"), "objects must be namespaced under hero/");

  const noR2 = freshDb();
  await addSlide(noR2, { imageLightUrl: PNG, titleEn: "Inline" });
  const inline = await readJson(await hero.onRequestGet(makeContext({ db: noR2, authToken: null, url: url() })));
  assert.equal(inline.slides[0].imageLightUrl, PNG);
});

test("hero: re-saving a slide keeps its stored R2 image instead of orphaning it", async () => {
  const db = freshDb();
  const r2 = fakeR2();
  const created = await addSlide(db, { imageLightUrl: PNG, titleEn: "Slide" }, { EVENT_PHOTOS: r2 });
  const first = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  const storedUrl = first.slides[0].imageLightUrl;

  const ctx = makeContext({ db, method: "PUT", url: url(), body: { id: created.id, imageLightUrl: storedUrl, titleEn: "Renamed" } });
  ctx.env.EVENT_PHOTOS = r2;
  await hero.onRequestPut(ctx);

  const after = await readJson(await hero.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(after.slides[0].imageLightUrl, storedUrl);
  assert.equal(r2.store.size, 1, "the existing object must survive an edit that didn't replace it");
});

test("hero: OPTIONS preflight is allowed", async () => {
  const res = await hero.onRequestOptions();
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
