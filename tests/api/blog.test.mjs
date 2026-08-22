import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext, makeBadJsonContext } from "../helpers/mock-d1.mjs";
import * as blog from "../../functions/api/blog.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("blog: draft posts are excluded from public list and slug lookup", async () => {
  const db = freshDb();
  const create = await readJson(await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog", body: { titleEn: "A Reflection", bodyEn: "Full text" }
  })));
  assert.equal(create.success, true);

  const list = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/blog" })));
  assert.equal(list.posts.length, 0);

  const bySlug = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/blog?slug=${create.slug}` })));
  assert.equal(bySlug.success, false);
});

test("blog: publishing makes a post visible publicly by slug and in the list", async () => {
  const db = freshDb();
  const create = await readJson(await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Youth Camp Recap", bodyEn: "It was great", ministryArea: "youth", status: "published" }
  })));

  const bySlug = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/blog?slug=${create.slug}` })));
  assert.equal(bySlug.success, true);
  assert.equal(bySlug.post.titleEn, "Youth Camp Recap");

  const filtered = await readJson(await blog.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/blog?ministryArea=youth" })));
  assert.equal(filtered.posts.length, 1);
});

test("blog: POST/PUT/DELETE require manage_content", async () => {
  const db = freshDb();
  const denied = await readJson(await blog.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/blog", body: { titleEn: "X", bodyEn: "Y" }
  })));
  assert.equal(denied.success, false);
});

test("blog: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await blog.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/blog", body: { id: 999999, titleEn: "X" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await blog.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/blog?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("blog: duplicate slugs are rejected with a friendly message", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog", body: { slug: "same-slug", titleEn: "One", bodyEn: "A" }
  }));
  const dupRes = await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog", body: { slug: "same-slug", titleEn: "Two", bodyEn: "B" }
  }));
  assert.equal(dupRes.status, 409, "a duplicate slug is a client-caused conflict, not a server error");
  const dup = await readJson(dupRes);
  assert.equal(dup.success, false);
});

test("blog: malformed JSON body on POST/PUT is a 400, not a 500", async () => {
  const db = freshDb();
  const post = await blog.onRequestPost(makeBadJsonContext({ db, method: "POST", url: "https://test.local/api/blog" }));
  assert.equal(post.status, 400);
  const put = await blog.onRequestPut(makeBadJsonContext({ db, method: "PUT", url: "https://test.local/api/blog" }));
  assert.equal(put.status, 400);
});
