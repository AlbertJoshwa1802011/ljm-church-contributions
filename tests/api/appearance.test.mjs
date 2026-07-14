import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as appearance from "../../functions/api/appearance.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

// resolveViewer treats a three-segment token as a Google JWT and verifies it via
// the tokeninfo endpoint (network). Stub global fetch so a fake JWT resolves to a
// verified member identity, with no real network access — mirrors how the app's
// verified-sign-in path behaves.
function withVerifiedMember(email, fn) {
  return async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("tokeninfo")) {
        return { ok: true, json: async () => ({ email, name: "Test Member" }) };
      }
      return realFetch(url);
    };
    try {
      await fn();
    } finally {
      globalThis.fetch = realFetch;
    }
  };
}

// A three-dot token routes resolveViewer down the (stubbed) Google-verify path.
const JWT = "aaa.bbb.ccc";

test("appearance: GET returns nulls for a signed-out caller", async () => {
  const db = freshDb();
  const res = await appearance.onRequestGet(makeContext({ db, authToken: null }));
  const result = await readJson(res);
  assert.equal(result.success, true);
  assert.equal(result.signedIn, false);
  assert.equal(result.accent_light, null);
  assert.equal(result.accent_dark, null);
});

test("appearance: PUT then GET round-trips per-mode accents", withVerifiedMember("member@example.com", async () => {
  const db = freshDb();
  const putRes = await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: JWT, body: { accent_light: "ocean", accent_dark: "coral" }
  }));
  const putResult = await readJson(putRes);
  assert.equal(putResult.success, true, putResult.message);

  const getRes = await appearance.onRequestGet(makeContext({ db, authToken: JWT }));
  const getResult = await readJson(getRes);
  assert.equal(getResult.signedIn, true);
  assert.equal(getResult.accent_light, "ocean");
  assert.equal(getResult.accent_dark, "coral");
}));

test("appearance: partial PUT preserves the other mode's choice", withVerifiedMember("member@example.com", async () => {
  const db = freshDb();
  await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: JWT, body: { accent_light: "teal", accent_dark: "violet" }
  }));
  // Now update only the dark accent.
  await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: JWT, body: { accent_dark: "rose" }
  }));
  const getResult = await readJson(await appearance.onRequestGet(makeContext({ db, authToken: JWT })));
  assert.equal(getResult.accent_light, "teal", "light choice must be preserved");
  assert.equal(getResult.accent_dark, "rose");
}));

test("appearance: PUT rejects an unknown palette id", withVerifiedMember("member@example.com", async () => {
  const db = freshDb();
  const res = await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: JWT, body: { accent_light: "chartreuse" }
  }));
  const result = await readJson(res);
  assert.equal(result.success, false);
  assert.match(result.message, /Unknown accent id/);
}));

test("appearance: PUT requires a signed-in caller", async () => {
  const db = freshDb();
  const res = await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: null, body: { accent_light: "ocean" }
  }));
  assert.equal(res.status, 401);
  assert.equal((await readJson(res)).success, false);
});

test("appearance: PUT rejects an unverified (legacy email) token", async () => {
  const db = freshDb();
  // makeContext with a bare email token; ALLOW_LEGACY_EMAIL_TOKEN is not set in
  // the test env, so resolveViewer yields no email -> 401 (still blocked). Even
  // if legacy were enabled it would be verified:false -> 403. Either way, no write.
  const res = await appearance.onRequestPut(makeContext({
    db, method: "PUT", authToken: "member@example.com", body: { accent_dark: "ocean" }
  }));
  assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`);
  assert.equal((await readJson(res)).success, false);
});
