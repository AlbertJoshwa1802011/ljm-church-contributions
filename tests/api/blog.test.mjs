import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as blog from "../../functions/api/blog.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("blog: draft posts are hidden from every public view (list, slug lookup) until published", async () => {
  const db = freshDb();
  const addRes = await readJson(await blog.onRequestPost(makeContext({
    db, body: { titleEn: "Draft article", bodyEn: "Not ready yet" }
  })));
  assert.equal(addRes.success, true);

  const list = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(list.posts.length, 0);

  const bySlug = await blog.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/blog?slug=draft-article`
  }));
  assert.equal(bySlug.status, 404);
});

test("blog: published posts are publicly visible by list and by slug", async () => {
  const db = freshDb();
  const addRes = await readJson(await blog.onRequestPost(makeContext({
    db, body: { titleEn: "God is Faithful", bodyEn: "A reflection...", status: "published" }
  })));
  assert.equal(addRes.slug, "god-is-faithful");

  const list = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(list.posts.length, 1);
  assert.ok(list.posts[0].publishedAt);

  const bySlug = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/blog?slug=god-is-faithful"
  })));
  assert.equal(bySlug.post.titleEn, "God is Faithful");
});

test("blog: ministryArea filter (youth ministry reuses blog)", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({
    db, body: { titleEn: "Youth Camp Recap", bodyEn: "...", status: "published", ministryArea: "youth" }
  }));
  await blog.onRequestPost(makeContext({
    db, body: { titleEn: "General Update", bodyEn: "...", status: "published" }
  }));

  const youthOnly = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/blog?ministryArea=youth"
  })));
  assert.equal(youthOnly.posts.length, 1);
  assert.equal(youthOnly.posts[0].titleEn, "Youth Camp Recap");
});

test("blog: ?all=1 requires manage_content and shows every status", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({ db, body: { titleEn: "Draft one", bodyEn: "x" } }));
  await blog.onRequestPost(makeContext({ db, body: { titleEn: "Published one", bodyEn: "x", status: "published" } }));

  const denied = await blog.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/blog?all=1" }));
  assert.equal(denied.status, 401);

  const allList = await readJson(await blog.onRequestGet(makeContext({ db, url: "https://test.local/api/blog?all=1" })));
  assert.equal(allList.posts.length, 2);
});

test("blog: write operations require manage_content permission", async () => {
  const db = freshDb();
  const res = await blog.onRequestPost(makeContext({ db, authToken: null, body: { titleEn: "X", bodyEn: "Y" } }));
  assert.equal(res.status, 401);
});

test("blog: POST rejects duplicate slug with 409", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({ db, body: { titleEn: "Same Title", bodyEn: "x" } }));
  const res = await blog.onRequestPost(makeContext({ db, body: { titleEn: "Same Title", bodyEn: "y" } }));
  assert.equal(res.status, 409);
});

test("blog: POST validates required fields", async () => {
  const db = freshDb();
  const noTitle = await readJson(await blog.onRequestPost(makeContext({ db, body: { bodyEn: "x" } })));
  assert.equal(noTitle.success, false);
  const noBody = await readJson(await blog.onRequestPost(makeContext({ db, body: { titleEn: "x" } })));
  assert.equal(noBody.success, false);
});

test("blog: full draft -> publish -> edit -> delete round trip", async () => {
  const db = freshDb();
  const addRes = await readJson(await blog.onRequestPost(makeContext({
    db, body: { titleEn: "Round Trip Post", bodyEn: "v1" }
  })));
  const id = addRes.id;

  const publishRes = await readJson(await blog.onRequestPut(makeContext({
    db, body: { id, status: "published", bodyEn: "v2" }
  })));
  assert.equal(publishRes.success, true);

  const afterPublish = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/blog?slug=round-trip-post`
  })));
  assert.equal(afterPublish.post.bodyEn, "v2");
  assert.ok(afterPublish.post.publishedAt);

  const deleteRes = await readJson(await blog.onRequestDelete(makeContext({
    db, url: `https://test.local/api/blog?id=${id}`
  })));
  assert.equal(deleteRes.success, true);

  const afterDelete = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(afterDelete.posts.length, 0);
});

test("blog: PUT rejects a slug change that collides with another post", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({ db, body: { titleEn: "First Post", bodyEn: "x" } }));
  const second = await readJson(await blog.onRequestPost(makeContext({ db, body: { titleEn: "Second Post", bodyEn: "x" } })));

  const res = await blog.onRequestPut(makeContext({
    db, body: { id: second.id, slug: "first-post" }
  }));
  assert.equal(res.status, 409);
});

test("blog: PUT/DELETE nonexistent id -> 404, PUT missing id -> 400", async () => {
  const db = freshDb();
  const missingId = await blog.onRequestPut(makeContext({ db, body: { titleEn: "X" } }));
  assert.equal(missingId.status, 400);

  const notFoundPut = await blog.onRequestPut(makeContext({ db, body: { id: 999, titleEn: "X" } }));
  assert.equal(notFoundPut.status, 404);

  const notFoundDelete = await blog.onRequestDelete(makeContext({ db, url: "https://test.local/api/blog?id=999" }));
  assert.equal(notFoundDelete.status, 404);
});
