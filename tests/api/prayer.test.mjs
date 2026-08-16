// Behavioral tests for /api/prayer (milestone v2, Phase 3).
// No RESEND_API_KEY in the mock env, so mail sends are a soft no-op (ack_sent/
// team_notified stay 0) — this exercises exactly the "mail provider unavailable"
// path and proves the submission still persists (SAFETY-AND-TESTS.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as prayer from "../../functions/api/prayer.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("prayer: a public submission persists even though mail is unconfigured", async () => {
  const db = freshDb();
  const res = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "Please pray for my family", name: "Jane", email: "jane@example.com", wantsCallback: true }
  })));
  assert.equal(res.success, true);
  assert.ok(res.id);

  const row = db._sqlite.prepare("SELECT * FROM prayer_requests WHERE id = ?").get(res.id);
  assert.equal(row.request, "Please pray for my family");
  assert.equal(row.wants_callback, 1);
  assert.equal(row.ack_sent, 0);
  assert.equal(row.team_notified, 0);
});

test("prayer: request is never publicly readable — GET requires manage_content", async () => {
  const db = freshDb();
  await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "Private request" }
  }));

  const denied = await readJson(await prayer.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/prayer"
  })));
  assert.equal(denied.success, false);

  const inbox = await readJson(await prayer.onRequestGet(makeContext({
    db, url: "https://test.local/api/prayer"
  })));
  assert.equal(inbox.requests.length, 1);
  assert.equal(inbox.requests[0].status, "new");
});

test("prayer: admin can move a request through the status flow", async () => {
  const db = freshDb();
  const created = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "Need prayer" }
  })));

  const updated = await readJson(await prayer.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/prayer",
    body: { id: created.id, status: "praying" }
  })));
  assert.equal(updated.success, true);

  const row = db._sqlite.prepare("SELECT status, handled_by FROM prayer_requests WHERE id = ?").get(created.id);
  assert.equal(row.status, "praying");
  assert.ok(row.handled_by);
});

test("prayer: validation rejects an empty request and a malformed email", async () => {
  const db = freshDb();
  const empty = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer", body: { request: "" }
  })));
  assert.equal(empty.success, false);

  const badEmail = await readJson(await prayer.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/prayer",
    body: { request: "Pray for me", email: "not-an-email" }
  })));
  assert.equal(badEmail.success, false);
});
