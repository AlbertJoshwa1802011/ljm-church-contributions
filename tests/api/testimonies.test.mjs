import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext, makeBadJsonContext } from "../helpers/mock-d1.mjs";
import * as testimonies from "../../functions/api/testimonies.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("testimonies: public submit lands 'pending' and is NOT publicly visible", async () => {
  const db = freshDb();
  const submit = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "God healed my son", bodyEn: "Full story here" }
  })));
  assert.equal(submit.success, true);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/testimonies" })));
  assert.equal(publicList.testimonies.length, 0);
});

test("testimonies: only 'published' rows show publicly; moderation requires manage_content", async () => {
  const db = freshDb();
  const submit = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "A miracle", bodyEn: "Story", kind: "miracle" }
  })));

  const deniedModerate = await readJson(await testimonies.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/testimonies",
    body: { id: submit.id, status: "published" }
  })));
  assert.equal(deniedModerate.success, false);

  const publish = await readJson(await testimonies.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/testimonies", body: { id: submit.id, status: "published" }
  })));
  assert.equal(publish.success, true);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/testimonies?kind=miracle" })));
  assert.equal(publicList.testimonies.length, 1);
  assert.equal(publicList.testimonies[0].titleEn, "A miracle");
});

test("testimonies: validation rejects missing required fields", async () => {
  const db = freshDb();
  const res = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies", body: { titleEn: "" }
  })));
  assert.equal(res.success, false);
});

test("testimonies: rejects extremely long text (regression: no length cap previously existed)", async () => {
  const db = freshDb();
  const tooLongTitle = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "x".repeat(301), bodyEn: "A normal testimony." }
  })));
  assert.equal(tooLongTitle.success, false);

  const tooLongBody = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "Healed", bodyEn: "x".repeat(10001) }
  })));
  assert.equal(tooLongBody.success, false);

  // A generous but reasonable submission is still accepted.
  const ok = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "Healed", bodyEn: "x".repeat(9000) }
  })));
  assert.equal(ok.success, true, ok.message);
});

test("testimonies: ?all=1 (admin queue) requires manage_content and shows every status", async () => {
  const db = freshDb();
  await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "T1", bodyEn: "B1" }
  }));

  const denied = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/testimonies?all=1" })));
  assert.equal(denied.success, false);

  const res = await readJson(await testimonies.onRequestGet(makeContext({ db, url: "https://test.local/api/testimonies?all=1" })));
  assert.equal(res.testimonies.length, 1);
  assert.equal(res.testimonies[0].status, "pending");
});

test("testimonies: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await testimonies.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/testimonies", body: { id: 999999, status: "published" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await testimonies.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/testimonies?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("testimonies: DELETE requires manage_content", async () => {
  const db = freshDb();
  const submit = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/testimonies",
    body: { titleEn: "T", bodyEn: "B" }
  })));

  const denied = await readJson(await testimonies.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/testimonies?id=${submit.id}`
  })));
  assert.equal(denied.success, false);

  const res = await readJson(await testimonies.onRequestDelete(makeContext({
    db, method: "DELETE", url: `https://test.local/api/testimonies?id=${submit.id}`
  })));
  assert.equal(res.success, true);
});

test("testimonies: malformed JSON body on POST/PUT is a 400, not a 500", async () => {
  const db = freshDb();
  const post = await testimonies.onRequestPost(makeBadJsonContext({ db, authToken: null, method: "POST", url: "https://test.local/api/testimonies" }));
  assert.equal(post.status, 400);
  const put = await testimonies.onRequestPut(makeBadJsonContext({ db, method: "PUT", url: "https://test.local/api/testimonies" }));
  assert.equal(put.status, 400);
});
