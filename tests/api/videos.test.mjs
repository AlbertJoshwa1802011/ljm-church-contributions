// Tests for /api/videos — admin-managed YouTube videos played inline on the
// site (issue 5 of docs/milestone-v2/13-home-experience-rework.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as videos from "../../functions/api/videos.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const ID = "dQw4w9WgXcQ";
const WATCH = "https://www.youtube.com/watch?v=" + ID;
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function url(qs) { return "https://test.local/api/videos" + (qs || ""); }

function fakeR2() {
  const store = new Map();
  return {
    store,
    async put(key, bytes) { store.set(key, bytes); },
    async get(key) { return store.has(key) ? { body: store.get(key) } : null; },
    async delete(key) { store.delete(key); }
  };
}

async function addVideo(db, body, env) {
  const ctx = makeContext({ db, method: "POST", url: url(), body });
  if (env) Object.assign(ctx.env, env);
  return readJson(await videos.onRequestPost(ctx));
}

test("videos: parseYouTubeId accepts every link form an admin might paste", () => {
  const accepted = [
    WATCH,
    "https://youtu.be/" + ID,
    "https://www.youtube.com/live/" + ID,
    "https://www.youtube.com/embed/" + ID,
    "https://www.youtube.com/shorts/" + ID,
    "https://m.youtube.com/watch?v=" + ID,
    "https://www.youtube-nocookie.com/embed/" + ID,
    "youtube.com/watch?v=" + ID,
    ID
  ];
  for (const link of accepted) {
    assert.equal(videos.parseYouTubeId(link), ID, `should parse ${link}`);
  }
});

test("videos: parseYouTubeId rejects non-YouTube and malformed links", () => {
  const rejected = [
    "https://vimeo.com/123456",
    "https://evil.example.com/watch?v=" + ID,
    "https://notyoutube.com/watch?v=" + ID,
    "https://www.youtube.com/watch?v=tooshort",
    "https://www.youtube.com/",
    "just some text",
    "",
    null,
    undefined
  ];
  for (const link of rejected) {
    assert.equal(videos.parseYouTubeId(link), null, `should reject ${link}`);
  }
});

test("videos: POST requires manage_content permission", async () => {
  const db = freshDb();
  const res = await readJson(await videos.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: url(), body: { titleEn: "Sermon", youtubeUrl: WATCH }
  })));
  assert.equal(res.success, false);
});

test("videos: PUT and DELETE require manage_content permission", async () => {
  const db = freshDb();
  const created = await addVideo(db, { titleEn: "Sermon", youtubeUrl: WATCH });

  const put = await readJson(await videos.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: url(), body: { id: created.id, titleEn: "x", youtubeUrl: WATCH }
  })));
  assert.equal(put.success, false);

  const del = await readJson(await videos.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: url("?id=" + created.id)
  })));
  assert.equal(del.success, false);
});

test("videos: ?all=1 requires auth; public GET does not", async () => {
  const db = freshDb();
  const gated = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url("?all=1") })));
  assert.equal(gated.success, false);

  const open = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(open.success, true);
  assert.deepEqual(open.videos, []);
});

test("videos: POST stores the normalised video id whatever link form was pasted", async () => {
  const db = freshDb();
  const res = await addVideo(db, { titleEn: "Sunday service", youtubeUrl: "https://youtu.be/" + ID });
  assert.equal(res.success, true);
  assert.equal(res.videoId, ID);

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.videos[0].videoId, ID);
});

test("videos: a non-YouTube link is a 400, not a broken embed", async () => {
  const db = freshDb();
  const res = await addVideo(db, { titleEn: "Sermon", youtubeUrl: "https://vimeo.com/12345" });
  assert.equal(res.success, false);
  assert.match(res.message, /YouTube/);
});

test("videos: title and url are both required", async () => {
  const db = freshDb();
  const noTitle = await addVideo(db, { youtubeUrl: WATCH });
  assert.equal(noTitle.success, false);
  assert.match(noTitle.message, /titleEn is required/);

  const noUrl = await addVideo(db, { titleEn: "Sermon" });
  assert.equal(noUrl.success, false);
  assert.match(noUrl.message, /youtubeUrl is required/);
});

test("videos: with no custom thumbnail, YouTube's own still is used", async () => {
  const db = freshDb();
  await addVideo(db, { titleEn: "Sermon", youtubeUrl: WATCH });

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.videos[0].hasCustomThumbnail, false);
  assert.equal(list.videos[0].thumbnailUrl, `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
});

test("videos: an uploaded thumbnail goes to R2 under videos/ and wins over the default", async () => {
  const db = freshDb();
  const r2 = fakeR2();
  await addVideo(db, { titleEn: "Sermon", youtubeUrl: WATCH, thumbnailUrl: PNG }, { EVENT_PHOTOS: r2 });

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.videos[0].hasCustomThumbnail, true);
  assert.match(list.videos[0].thumbnailUrl, /^\/api\/media\?key=videos%2F/);
  assert.ok([...r2.store.keys()][0].startsWith("videos/"));
});

test("videos: draft videos are hidden from the public listing but visible to admin", async () => {
  const db = freshDb();
  await addVideo(db, { titleEn: "Published", youtubeUrl: WATCH });
  await addVideo(db, { titleEn: "Draft", youtubeUrl: WATCH, status: "draft" });

  const pub = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(pub.videos.map(v => v.titleEn), ["Published"]);

  const admin = await readJson(await videos.onRequestGet(makeContext({ db, url: url("?all=1") })));
  assert.equal(admin.videos.length, 2);
});

test("videos: the live video sorts to the front of the public listing", async () => {
  const db = freshDb();
  await addVideo(db, { titleEn: "Archive message", youtubeUrl: WATCH, sortOrder: 1 });
  await addVideo(db, { titleEn: "Sunday live", youtubeUrl: WATCH, sortOrder: 9, isLive: true });

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.videos[0].titleEn, "Sunday live");
  assert.equal(list.videos[0].isLive, true);
});

test("videos: PUT updates a video; unknown id is a 404 and missing id a 400", async () => {
  const db = freshDb();
  const created = await addVideo(db, { titleEn: "Before", youtubeUrl: WATCH });

  const noId = await readJson(await videos.onRequestPut(makeContext({ db, method: "PUT", url: url(), body: { titleEn: "x", youtubeUrl: WATCH } })));
  assert.equal(noId.success, false);

  const missing = await videos.onRequestPut(makeContext({ db, method: "PUT", url: url(), body: { id: 9999, titleEn: "x", youtubeUrl: WATCH } }));
  assert.equal(missing.status, 404);

  const ok = await readJson(await videos.onRequestPut(makeContext({
    db, method: "PUT", url: url(), body: { id: created.id, titleEn: "After", youtubeUrl: WATCH }
  })));
  assert.equal(ok.success, true);

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.equal(list.videos[0].titleEn, "After");
});

test("videos: editing a draft video leaves it a draft", async () => {
  const db = freshDb();
  const created = await addVideo(db, { titleEn: "Draft", youtubeUrl: WATCH, status: "draft" });

  await videos.onRequestPut(makeContext({
    db, method: "PUT", url: url(), body: { id: created.id, titleEn: "Draft renamed", youtubeUrl: WATCH }
  }));

  const pub = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(pub.videos, [], "an edit must not silently publish a draft");
});

test("videos: DELETE removes the row and its uploaded thumbnail; unknown id is a 404", async () => {
  const db = freshDb();
  const r2 = fakeR2();
  const created = await addVideo(db, { titleEn: "Sermon", youtubeUrl: WATCH, thumbnailUrl: PNG }, { EVENT_PHOTOS: r2 });
  assert.equal(r2.store.size, 1);

  const missing = await videos.onRequestDelete(makeContext({ db, method: "DELETE", url: url("?id=9999") }));
  assert.equal(missing.status, 404);

  const ctx = makeContext({ db, method: "DELETE", url: url("?id=" + created.id) });
  ctx.env.EVENT_PHOTOS = r2;
  const res = await readJson(await videos.onRequestDelete(ctx));
  assert.equal(res.success, true);
  assert.equal(r2.store.size, 0, "the orphaned thumbnail should be cleaned up");

  const list = await readJson(await videos.onRequestGet(makeContext({ db, authToken: null, url: url() })));
  assert.deepEqual(list.videos, []);
});

test("videos: OPTIONS preflight is allowed", async () => {
  const res = await videos.onRequestOptions();
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
