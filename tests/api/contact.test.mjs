// Behavioral tests for /api/contact (milestone v2, Phase 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as contact from "../../functions/api/contact.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("contact: a public submission persists even though mail is unconfigured", async () => {
  const db = freshDb();
  const res = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { name: "John", email: "john@example.com", subject: "Visiting", message: "When is Sunday service?" }
  })));
  assert.equal(res.success, true);

  const row = db._sqlite.prepare("SELECT * FROM contact_messages WHERE id = ?").get(res.id);
  assert.equal(row.message, "When is Sunday service?");
  assert.equal(row.ack_sent, 0);
  assert.equal(row.team_notified, 0);
});

test("contact: validation requires a valid email and a message", async () => {
  const db = freshDb();
  const badEmail = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "nope", message: "Hello" }
  })));
  assert.equal(badEmail.success, false);

  const noMessage = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "a@b.com", message: "" }
  })));
  assert.equal(noMessage.success, false);
});

test("contact: inbox requires manage_content and supports status filtering", async () => {
  const db = freshDb();
  await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "a@b.com", message: "First message" }
  }));

  const denied = await readJson(await contact.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/contact"
  })));
  assert.equal(denied.success, false);

  const inbox = await readJson(await contact.onRequestGet(makeContext({
    db, url: "https://test.local/api/contact?status=new"
  })));
  assert.equal(inbox.messages.length, 1);
});

test("contact: admin can update status", async () => {
  const db = freshDb();
  const created = await readJson(await contact.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/contact",
    body: { email: "a@b.com", message: "Hi" }
  })));
  const updated = await readJson(await contact.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/contact",
    body: { id: created.id, status: "replied" }
  })));
  assert.equal(updated.success, true);
  const row = db._sqlite.prepare("SELECT status FROM contact_messages WHERE id = ?").get(created.id);
  assert.equal(row.status, "replied");
});
