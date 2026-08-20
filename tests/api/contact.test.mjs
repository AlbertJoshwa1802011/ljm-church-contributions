import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contact from "../../functions/api/contact.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("contact: public POST persists the message even with no mail provider configured", async () => {
  const db = freshDb();
  const res = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { name: "Visitor", email: "visitor@example.com", message: "Hello, how do I find your service times?" }
  })));
  assert.equal(res.success, true);
  assert.ok(res.id);

  const list = await readJson(await contact.onRequestGet(makeContext({ db, url: "https://test.local/api/contact" })));
  assert.equal(list.messages.length, 1);
  assert.equal(list.messages[0].ackSent, false); // no RESEND_API_KEY in test env — never blocks the submission
});

test("contact: validation rejects an invalid email or empty message", async () => {
  const db = freshDb();
  const badEmail = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "not-an-email", message: "hi" }
  })));
  assert.equal(badEmail.success, false);

  const emptyMessage = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "a@b.com", message: "" }
  })));
  assert.equal(emptyMessage.success, false);
});

test("contact: rejects extremely long text (regression: no length cap previously existed)", async () => {
  const db = freshDb();
  const tooLongSubject = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "visitor@example.com", subject: "x".repeat(301), message: "Hello there" }
  })));
  assert.equal(tooLongSubject.success, false);

  const tooLongMessage = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "visitor@example.com", message: "x".repeat(10001) }
  })));
  assert.equal(tooLongMessage.success, false);

  const ok = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "visitor@example.com", message: "x".repeat(9000) }
  })));
  assert.equal(ok.success, true, ok.message);
});

test("contact: PUT on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await contact.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/contact", body: { id: 999999, status: "replied" }
  })));
  assert.equal(res.success, false);
});

test("contact: inbox (GET) and status update (PUT) require manage_content", async () => {
  const db = freshDb();
  const submit = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "a@b.com", message: "Question about giving" }
  })));

  const denied = await readJson(await contact.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/contact" })));
  assert.equal(denied.success, false);

  const ok = await readJson(await contact.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/contact", body: { id: submit.id, status: "replied" }
  })));
  assert.equal(ok.success, true);

  const filtered = await readJson(await contact.onRequestGet(makeContext({ db, url: "https://test.local/api/contact?status=replied" })));
  assert.equal(filtered.messages.length, 1);
});
