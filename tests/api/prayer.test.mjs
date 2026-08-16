import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as prayer from "../../functions/api/prayer.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("prayer: public submission persists even with no mail configured (RESEND_API_KEY unset)", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, body: { request: "Please pray for my family", name: "Anon" }
  })));
  assert.equal(res.success, true);

  const list = await readJson(await prayer.onRequestGet(makeContext({ db })));
  assert.equal(list.requests.length, 1);
  assert.equal(list.requests[0].request, "Please pray for my family");
  assert.equal(list.requests[0].status, "new");
});

test("prayer: submission persists even when the mail provider is configured but fails", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("mail provider down"); };
  try {
    const context = makeContext({
      db, authToken: null, body: { request: "Urgent prayer needed", wantsCallback: true }
    });
    context.env.RESEND_API_KEY = "test-key";
    context.env.TEAM_NOTIFY_EMAIL = "team@ljm.org";

    const res = await readJson(await prayer.onRequestPost(context));
    assert.equal(res.success, true);

    const list = await readJson(await prayer.onRequestGet(makeContext({ db })));
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0].wantsCallback, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("prayer: POST requires request text", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPost(makeContext({ db, authToken: null, body: {} })));
  assert.equal(res.success, false);
});

test("prayer: GET (inbox) requires manage_content permission", async () => {
  const db = freshDb();
  const res = await prayer.onRequestGet(makeContext({ db, authToken: null }));
  assert.equal(res.status, 401);
});

test("prayer: GET is never reachable without permission, even though POST is public", async () => {
  const db = freshDb();
  await prayer.onRequestPost(makeContext({ db, authToken: null, body: { request: "x" } }));
  const res = await prayer.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/prayer?status=new" }));
  assert.equal(res.status, 401);
});

test("prayer: PUT requires manage_content permission", async () => {
  const db = freshDb();
  const addRes = await readJson(await prayer.onRequestPost(makeContext({ db, authToken: null, body: { request: "x" } })));
  const res = await prayer.onRequestPut(makeContext({
    db, authToken: null, body: { id: addRes.id, status: "praying" }
  }));
  assert.equal(res.status, 401);
});

test("prayer: full status-flow round trip (new -> praying -> contacted -> closed)", async () => {
  const db = freshDb();
  const addRes = await readJson(await prayer.onRequestPost(makeContext({ db, authToken: null, body: { request: "x" } })));

  for (const status of ["praying", "contacted", "closed"]) {
    const putRes = await readJson(await prayer.onRequestPut(makeContext({
      db, body: { id: addRes.id, status }
    })));
    assert.equal(putRes.success, true);
  }

  const list = await readJson(await prayer.onRequestGet(makeContext({ db })));
  assert.equal(list.requests[0].status, "closed");
  assert.ok(list.requests[0].handledBy);

  const filtered = await readJson(await prayer.onRequestGet(makeContext({
    db, url: "https://test.local/api/prayer?status=closed"
  })));
  assert.equal(filtered.requests.length, 1);

  const filteredEmpty = await readJson(await prayer.onRequestGet(makeContext({
    db, url: "https://test.local/api/prayer?status=new"
  })));
  assert.equal(filteredEmpty.requests.length, 0);
});

test("prayer: PUT rejects an invalid status and a nonexistent id", async () => {
  const db = freshDb();
  const addRes = await readJson(await prayer.onRequestPost(makeContext({ db, authToken: null, body: { request: "x" } })));

  const badStatus = await readJson(await prayer.onRequestPut(makeContext({
    db, body: { id: addRes.id, status: "not-a-real-status" }
  })));
  assert.equal(badStatus.success, false);

  const notFound = await prayer.onRequestPut(makeContext({ db, body: { id: 999, status: "praying" } }));
  assert.equal(notFound.status, 404);
});
