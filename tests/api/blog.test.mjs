// Behavioral tests for /api/blog (milestone v2, Phase 5; also backs Youth Ministry
// content via ministryArea='youth').
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as blog from "../../functions/api/blog.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("blog: draft posts are never publicly visible; published ones are", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Draft post", bodyEn: "Body", status: "draft" }
  }));
  const published = await readJson(await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Published post", bodyEn: "Body", status: "published", category: "News" }
  })));

  const publicList = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/blog"
  })));
  assert.equal(publicList.posts.length, 1);
  assert.equal(publicList.posts[0].slug, published.slug);

  const bySlug = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/blog?slug=${published.slug}`
  })));
  assert.equal(bySlug.post.titleEn, "Published post");
});

test("blog: fetching a draft post by slug 404s for the public", async () => {
  const db = freshDb();
  const draft = await readJson(await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Hidden", bodyEn: "Body", status: "draft" }
  })));
  const res = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: `https://test.local/api/blog?slug=${draft.slug}`
  })));
  assert.equal(res.success, false);
});

test("blog: ministry filter backs the Youth Ministry hub", async () => {
  const db = freshDb();
  await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Youth camp recap", bodyEn: "Body", status: "published", ministryArea: "youth" }
  }));
  await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "General update", bodyEn: "Body", status: "published" }
  }));

  const youthOnly = await readJson(await blog.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/blog?ministry=youth"
  })));
  assert.equal(youthOnly.posts.length, 1);
  assert.equal(youthOnly.posts[0].titleEn, "Youth camp recap");
});

test("blog: mutations require manage_content; duplicate slugs are rejected", async () => {
  const db = freshDb();
  const denied = await readJson(await blog.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "X", bodyEn: "Y" }
  })));
  assert.equal(denied.success, false);

  await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Same slug", bodyEn: "Body", slug: "same-slug" }
  }));
  const dup = await readJson(await blog.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/blog",
    body: { titleEn: "Same slug again", bodyEn: "Body", slug: "same-slug" }
  })));
  assert.equal(dup.success, false);
});
