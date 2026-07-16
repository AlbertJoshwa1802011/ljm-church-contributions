// Characterization tests for /api/auth — the Google sign-in / member-linking
// endpoint. The happy path calls Google's tokeninfo over the network, so these
// tests cover only the deterministic, no-network guard branches to lock in the
// input-validation contract without depending on external services.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as auth from "../../functions/api/auth.js";

test("auth: POST without a token returns 400", async () => {
  const db = freshDb();
  const res = await auth.onRequestPost({ env: { DB: db }, request: { json: async () => ({}) } });
  assert.equal(res.status, 400);
});

test("auth: PUT without token or memberName returns 400", async () => {
  const db = freshDb();
  const res = await auth.onRequestPut({ env: { DB: db }, request: { json: async () => ({ token: "x" }) } });
  assert.equal(res.status, 400);
});

test("auth: a missing DB binding returns 500", async () => {
  const res = await auth.onRequestPost({ env: {}, request: { json: async () => ({ token: "x" }) } });
  assert.equal(res.status, 500);
});
