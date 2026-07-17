// Characterization tests for /api/auth — the Google sign-in / member-linking
// endpoint. auth.js calls Google's tokeninfo endpoint directly via fetch (not
// through _lib.js's verifyGoogleToken), so the network-dependent flows below
// stub globalThis.fetch — the same pattern used in webhook.test.mjs and
// appearance.test.mjs — to exercise the real success/failure branches without
// any real network access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as auth from "../../functions/api/auth.js";

async function readJson(res) { return JSON.parse(await res.text()); }

function withGoogleStub(payload, fn) {
  return async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("tokeninfo")) {
        return { ok: true, json: async () => payload };
      }
      return realFetch(url);
    };
    try { await fn(); } finally { globalThis.fetch = realFetch; }
  };
}

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

test("auth: POST resolves a signed-in member by matching Google email", withGoogleStub(
  { email: "linked@example.com", name: "Linked Person" },
  async () => {
    const db = freshDb();
    await db.prepare("INSERT INTO members (name, email, phone, is_verified) VALUES ('Linked Person','linked@example.com','111',1)").run();

    const res = await readJson(await auth.onRequestPost({ env: { DB: db }, request: { json: async () => ({ token: "fake" }) } }));
    assert.equal(res.status, "success");
    assert.equal(res.user.email, "linked@example.com");
    assert.equal(res.member.name, "Linked Person");
    assert.equal(res.isAdmin, false);
  }
));

test("auth: POST with no email match falls back to a name match and offers the unclaimed-member picker", withGoogleStub(
  { email: "newgoogle@example.com", name: "Unclaimed Believer" },
  async () => {
    const db = freshDb();
    await db.prepare("INSERT INTO members (name) VALUES ('Unclaimed Believer')").run();
    await db.prepare("INSERT INTO members (name) VALUES ('Another Unclaimed')").run();

    const res = await readJson(await auth.onRequestPost({ env: { DB: db }, request: { json: async () => ({ token: "fake" }) } }));
    assert.equal(res.member, null, "no member is email-linked yet");
    assert.equal(res.mappingRecommendation, "Unclaimed Believer", "exact name match should be suggested");
    assert.ok(res.unclaimedMembers.includes("Unclaimed Believer"));
    assert.ok(res.unclaimedMembers.includes("Another Unclaimed"));
  }
));

test("auth: POST reports isAdmin/permissions for a hardcoded super admin email", withGoogleStub(
  { email: "albertjoshrock101@gmail.com", name: "Super Admin" },
  async () => {
    const db = freshDb();
    const res = await readJson(await auth.onRequestPost({ env: { DB: db }, request: { json: async () => ({ token: "fake" }) } }));
    assert.equal(res.isAdmin, true);
    assert.ok(res.permissions.includes("*"));
  }
));

test("auth: POST rejects when Google verification fails or the audience doesn't match", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const res = await auth.onRequestPost({ env: { DB: db }, request: { json: async () => ({ token: "fake" }) } });
    assert.equal(res.status, 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("auth: PUT links a Google email to an unclaimed member and 400s if already linked", withGoogleStub(
  { email: "willlink@example.com", name: "Will Link" },
  async () => {
    const db = freshDb();
    await db.prepare("INSERT INTO members (name) VALUES ('Will Link')").run();

    const res = await readJson(await auth.onRequestPut({
      env: { DB: db }, request: { json: async () => ({ token: "fake", memberName: "Will Link" }) }
    }));
    assert.equal(res.status, "success");
    assert.equal(res.member.email, "willlink@example.com");

    // Second attempt: the member already has an email bound.
    const again = await auth.onRequestPut({
      env: { DB: db }, request: { json: async () => ({ token: "fake", memberName: "Will Link" }) }
    });
    assert.equal(again.status, 400);
  }
));

test("auth: PUT rejects when Google verification fails", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name) VALUES ('Never Links')").run();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const res = await auth.onRequestPut({
      env: { DB: db }, request: { json: async () => ({ token: "fake", memberName: "Never Links" }) }
    });
    assert.equal(res.status, 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});
