import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contact from "../../functions/api/contact.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("contact: public submission persists with no mail configured; ackSent/teamNotified false", async () => {
  const db = freshDb();
  const res = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "visitor@example.com", message: "Tell me more about LJM" }
  })));
  assert.equal(res.success, true);

  const list = await readJson(await contact.onRequestGet(makeContext({ db })));
  assert.equal(list.messages.length, 1);
  assert.equal(list.messages[0].email, "visitor@example.com");
  assert.equal(list.messages[0].ackSent, false);
  assert.equal(list.messages[0].teamNotified, false);
  assert.equal(list.messages[0].status, "new");
});

test("contact: submission persists AND acknowledgement/team-notify fire when mail is configured", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, status: 200 }; };
  try {
    const context = makeContext({
      db, authToken: null, body: { email: "visitor@example.com", message: "Hello", name: "Visitor", subject: "Question" }
    });
    context.env.RESEND_API_KEY = "test-key";
    context.env.TEAM_NOTIFY_EMAIL = "team@ljm.org";

    const res = await readJson(await contact.onRequestPost(context));
    assert.equal(res.success, true);
    assert.equal(calls, 2); // one ack email + one team notification

    const list = await readJson(await contact.onRequestGet(makeContext({ db })));
    assert.equal(list.messages[0].ackSent, true);
    assert.equal(list.messages[0].teamNotified, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("contact: submission still persists even when the mail provider fails", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("mail down"); };
  try {
    const context = makeContext({
      db, authToken: null, body: { email: "visitor@example.com", message: "Hello" }
    });
    context.env.RESEND_API_KEY = "test-key";

    const res = await readJson(await contact.onRequestPost(context));
    assert.equal(res.success, true);

    const list = await readJson(await contact.onRequestGet(makeContext({ db })));
    assert.equal(list.messages.length, 1);
    assert.equal(list.messages[0].ackSent, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("contact: POST validates email and message", async () => {
  const db = freshDb();
  const badEmail = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "not-an-email", message: "hi" }
  })));
  assert.equal(badEmail.success, false);

  const noMessage = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "a@b.com", message: "" }
  })));
  assert.equal(noMessage.success, false);
});

test("contact: GET (inbox) requires manage_content permission", async () => {
  const db = freshDb();
  const res = await contact.onRequestGet(makeContext({ db, authToken: null }));
  assert.equal(res.status, 401);
});

test("contact: PUT requires manage_content permission", async () => {
  const db = freshDb();
  const addRes = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "a@b.com", message: "hi" }
  })));
  const res = await contact.onRequestPut(makeContext({
    db, authToken: null, body: { id: addRes.id, status: "replied" }
  }));
  assert.equal(res.status, 401);
});

test("contact: full status-flow round trip and per-status filtering", async () => {
  const db = freshDb();
  const addRes = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "a@b.com", message: "hi" }
  })));

  const ackRes = await readJson(await contact.onRequestPut(makeContext({
    db, body: { id: addRes.id, status: "acknowledged" }
  })));
  assert.equal(ackRes.success, true);

  const repliedRes = await readJson(await contact.onRequestPut(makeContext({
    db, body: { id: addRes.id, status: "replied" }
  })));
  assert.equal(repliedRes.success, true);

  const filtered = await readJson(await contact.onRequestGet(makeContext({
    db, url: "https://test.local/api/contact?status=replied"
  })));
  assert.equal(filtered.messages.length, 1);
  assert.ok(filtered.messages[0].handledBy);

  const filteredEmpty = await readJson(await contact.onRequestGet(makeContext({
    db, url: "https://test.local/api/contact?status=new"
  })));
  assert.equal(filteredEmpty.messages.length, 0);
});

test("contact: PUT rejects an invalid status and a nonexistent id", async () => {
  const db = freshDb();
  const addRes = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, body: { email: "a@b.com", message: "hi" }
  })));

  const badStatus = await readJson(await contact.onRequestPut(makeContext({
    db, body: { id: addRes.id, status: "not-a-real-status" }
  })));
  assert.equal(badStatus.success, false);

  const notFound = await contact.onRequestPut(makeContext({ db, body: { id: 999, status: "replied" } }));
  assert.equal(notFound.status, 404);
});
