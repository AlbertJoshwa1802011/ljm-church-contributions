// Tests for /api/beta-testers — admin CRUD for the flag-gated "v2" flow's
// allowlist. Gated on the existing manage_roles permission scope.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as betaTesters from "../../functions/api/beta-testers.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("beta-testers: missing DB binding returns 500", async () => {
  const res = await betaTesters.onRequestGet({ env: {}, request: { headers: { get: () => null }, url: "https://test.local/api/beta-testers" } });
  assert.equal(res.status, 500);
});

test("beta-testers: GET without credentials is unauthorized", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(res.success, false);
});

test("beta-testers: GET with admin auth lists the migration-seeded tester", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestGet(makeContext({ db })));
  assert.equal(res.success, true);
  assert.ok(res.testers.some(t => t.email === "albertjoshrock101@gmail.com"));
});

test("beta-testers: POST add without admin auth is unauthorized and does not add", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestPost(makeContext({
    db, authToken: null, body: { action: "add", email: "sneaky@example.com" }
  })));
  assert.equal(res.success, false);

  const list = await readJson(await betaTesters.onRequestGet(makeContext({ db })));
  assert.ok(!list.testers.some(t => t.email === "sneaky@example.com"));
});

test("beta-testers: POST add with a valid email succeeds and appears in the list", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestPost(makeContext({
    db, body: { action: "add", email: "New.Tester@Example.com", note: "pastor's request" }
  })));
  assert.equal(res.success, true);

  const list = await readJson(await betaTesters.onRequestGet(makeContext({ db })));
  const row = list.testers.find(t => t.email === "new.tester@example.com");
  assert.ok(row, "email should be stored lowercase/trimmed");
  assert.equal(row.note, "pastor's request");
});

test("beta-testers: POST add rejects an invalid email", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestPost(makeContext({
    db, body: { action: "add", email: "not-an-email" }
  })));
  assert.equal(res.success, false);
});

test("beta-testers: POST remove deletes an existing tester", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO beta_testers (email, added_by) VALUES ('remove.me@example.com', 'test')").run();

  const res = await readJson(await betaTesters.onRequestPost(makeContext({
    db, body: { action: "remove", email: "remove.me@example.com" }
  })));
  assert.equal(res.success, true);

  const list = await readJson(await betaTesters.onRequestGet(makeContext({ db })));
  assert.ok(!list.testers.some(t => t.email === "remove.me@example.com"));
});

test("beta-testers: POST with an unknown action returns success:false", async () => {
  const db = freshDb();
  const res = await readJson(await betaTesters.onRequestPost(makeContext({
    db, body: { action: "not_a_real_action" }
  })));
  assert.equal(res.success, false);
});

test("beta-testers: onRequestOptions returns a 204 CORS preflight response", async () => {
  const res = await betaTesters.onRequestOptions();
  assert.equal(res.status, 204);
  assert.match(res.headers.get("Access-Control-Allow-Methods"), /GET/);
});
