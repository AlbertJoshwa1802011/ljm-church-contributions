import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext, makeBadJsonContext } from "../helpers/mock-d1.mjs";
import * as prayer from "../../functions/api/prayer.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("prayer: public POST persists the request even with no mail provider configured", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { name: "Ruth", email: "ruth@example.com", request: "Please pray for my family" }
  })));
  assert.equal(res.success, true);
  assert.ok(res.id);

  // env has no RESEND_API_KEY/TEAM_NOTIFY_EMAIL in this test env — submission
  // must still succeed and be readable by an admin (this is the whole point
  // of "persist first" from the TRD).
  const list = await readJson(await prayer.onRequestGet(makeContext({ db, url: "https://test.local/api/prayer" })));
  assert.equal(list.requests.length, 1);
  assert.equal(list.requests[0].request, "Please pray for my family");
});

test("prayer: validation rejects an empty request", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer", body: { request: "  " }
  })));
  assert.equal(res.success, false);
});

test("prayer: rejects extremely long text (regression: no length cap previously existed)", async () => {
  const db = freshDb();
  const tooLongName = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { name: "x".repeat(301), request: "Please pray for my family." }
  })));
  assert.equal(tooLongName.success, false);

  const tooLongRequest = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "x".repeat(10001) }
  })));
  assert.equal(tooLongRequest.success, false);

  const ok = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "x".repeat(9000) }
  })));
  assert.equal(ok.success, true, ok.message);
});

test("prayer: inbox (GET) and status update (PUT) require manage_content", async () => {
  const db = freshDb();
  const submit = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer", body: { request: "Pray for healing" }
  })));

  const deniedList = await readJson(await prayer.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/prayer" })));
  assert.equal(deniedList.success, false);

  const deniedPut = await readJson(await prayer.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/prayer", body: { id: submit.id, status: "praying" }
  })));
  assert.equal(deniedPut.success, false);

  const ok = await readJson(await prayer.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/prayer", body: { id: submit.id, status: "praying" }
  })));
  assert.equal(ok.success, true);

  const filtered = await readJson(await prayer.onRequestGet(makeContext({ db, url: "https://test.local/api/prayer?status=praying" })));
  assert.equal(filtered.requests.length, 1);
});

test("prayer: PUT on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/prayer", body: { id: 999999, status: "praying" }
  })));
  assert.equal(res.success, false);
});

test("prayer: PUT rejects an invalid status", async () => {
  const db = freshDb();
  const submit = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer", body: { request: "X" }
  })));
  const res = await readJson(await prayer.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/prayer", body: { id: submit.id, status: "bogus" }
  })));
  assert.equal(res.success, false);
});

test("prayer: malformed JSON body on POST/PUT is a 400, not a 500", async () => {
  const db = freshDb();
  const post = await prayer.onRequestPost(makeBadJsonContext({ db, authToken: null, method: "POST", url: "https://test.local/api/prayer" }));
  assert.equal(post.status, 400);
  const put = await prayer.onRequestPut(makeBadJsonContext({ db, method: "PUT", url: "https://test.local/api/prayer" }));
  assert.equal(put.status, 400);
});
