import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as testimonies from "../../functions/api/testimonies.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("testimonies: public submission lands 'pending' and is not publicly visible", async () => {
  const db = freshDb();
  const addRes = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "God healed my mother", bodyEn: "She was sick and now she is well." }
  })));
  assert.equal(addRes.success, true);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(publicList.testimonies.length, 0);
});

test("testimonies: only published rows are shown publicly; pending/rejected are hidden", async () => {
  const db = freshDb();
  const pending = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "Pending one", bodyEn: "body" }
  })));
  const toReject = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "Will be rejected", bodyEn: "body" }
  })));
  const toPublish = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "Will be published", bodyEn: "body", kind: "miracle" }
  })));

  await testimonies.onRequestPut(makeContext({ db, body: { id: toReject.id, status: "rejected" } }));
  await testimonies.onRequestPut(makeContext({ db, body: { id: toPublish.id, status: "published" } }));

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(publicList.testimonies.length, 1);
  assert.equal(publicList.testimonies[0].titleEn, "Will be published");
  assert.ok(publicList.testimonies[0].publishedAt);

  const kindFiltered = await readJson(await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies?kind=miracle"
  })));
  assert.equal(kindFiltered.testimonies.length, 1);

  const testimonyKind = await readJson(await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies?kind=testimony"
  })));
  assert.equal(testimonyKind.testimonies.length, 0);

  // ?all=1 (admin) sees every status, including the still-pending one.
  const allList = await readJson(await testimonies.onRequestGet(makeContext({
    db, url: "https://test.local/api/testimonies?all=1"
  })));
  assert.equal(allList.testimonies.length, 3);
  const stillPending = allList.testimonies.find(t => t.id === pending.id);
  assert.equal(stillPending.status, "pending");
});

test("testimonies: a public submitter cannot self-publish via the status field", async () => {
  const db = freshDb();
  const addRes = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "Sneaky", bodyEn: "body", status: "published" }
  })));
  const allList = await readJson(await testimonies.onRequestGet(makeContext({
    db, url: "https://test.local/api/testimonies?all=1"
  })));
  const row = allList.testimonies.find(t => t.id === addRes.id);
  assert.equal(row.status, "pending");
});

test("testimonies: ?all=1 requires manage_content permission", async () => {
  const db = freshDb();
  const res = await testimonies.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/testimonies?all=1"
  }));
  assert.equal(res.status, 401);
});

test("testimonies: PUT/DELETE require manage_content permission", async () => {
  const db = freshDb();
  const addRes = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "X", bodyEn: "Y" }
  })));

  const putRes = await testimonies.onRequestPut(makeContext({
    db, authToken: null, body: { id: addRes.id, status: "published" }
  }));
  assert.equal(putRes.status, 401);

  const deleteRes = await testimonies.onRequestDelete(makeContext({
    db, authToken: null, url: `https://test.local/api/testimonies?id=${addRes.id}`
  }));
  assert.equal(deleteRes.status, 401);
});

test("testimonies: POST validation — missing titleEn/bodyEn is rejected", async () => {
  const db = freshDb();
  const noTitle = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { bodyEn: "body" }
  })));
  assert.equal(noTitle.success, false);

  const noBody = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "title" }
  })));
  assert.equal(noBody.success, false);
});

test("testimonies: PUT/DELETE nonexistent id -> 404", async () => {
  const db = freshDb();
  const putRes = await testimonies.onRequestPut(makeContext({ db, body: { id: 999, status: "published" } }));
  assert.equal(putRes.status, 404);

  const deleteRes = await testimonies.onRequestDelete(makeContext({
    db, url: "https://test.local/api/testimonies?id=999"
  }));
  assert.equal(deleteRes.status, 404);
});

test("testimonies: full moderate -> delete round trip", async () => {
  const db = freshDb();
  const addRes = await readJson(await testimonies.onRequestPost(makeContext({
    db, authToken: null, body: { titleEn: "Round trip", bodyEn: "body" }
  })));

  const publishRes = await readJson(await testimonies.onRequestPut(makeContext({
    db, body: { id: addRes.id, status: "published", titleEn: "Round trip (edited)" }
  })));
  assert.equal(publishRes.success, true);

  const publicList = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(publicList.testimonies[0].titleEn, "Round trip (edited)");

  const deleteRes = await readJson(await testimonies.onRequestDelete(makeContext({
    db, url: `https://test.local/api/testimonies?id=${addRes.id}`
  })));
  assert.equal(deleteRes.success, true);

  const afterDelete = await readJson(await testimonies.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(afterDelete.testimonies.length, 0);
});
