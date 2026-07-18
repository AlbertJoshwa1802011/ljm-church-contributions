// Tests for /api/beta-activate — verifies a Google ID token and, only if the
// email is on the beta_testers allowlist, mints the signed ljm_beta cookie
// that functions/_middleware.js checks. See
// docs/milestone-v2/11-v2-flow-implementation.md for the design.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import * as betaActivate from "../../functions/api/beta-activate.js";
import { verifyBetaCookie, BETA_COOKIE_NAME } from "../../functions/api/_beta.js";

const SECRET = "test-beta-secret";

async function readJson(res) { return JSON.parse(await res.text()); }

function withGoogleStub(payload, fn) {
  return async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("tokeninfo")) {
        return payload === null ? { ok: false } : { ok: true, json: async () => payload };
      }
      return realFetch(url);
    };
    try { await fn(); } finally { globalThis.fetch = realFetch; }
  };
}

function extractCookieValue(setCookieHeader) {
  const match = setCookieHeader.match(new RegExp(`${BETA_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

test("beta-activate: missing DB binding returns 500", async () => {
  const res = await betaActivate.onRequestPost({ env: {}, request: { json: async () => ({ token: "x" }) } });
  assert.equal(res.status, 500);
});

test("beta-activate: BETA_COOKIE_SECRET not configured fails closed with 503", async () => {
  const db = freshDb();
  const res = await betaActivate.onRequestPost({
    env: { DB: db }, // no BETA_COOKIE_SECRET
    request: { json: async () => ({ token: "x" }) }
  });
  assert.equal(res.status, 503);
  const body = await readJson(res);
  assert.equal(body.success, false);
});

test("beta-activate: missing token returns 400", async () => {
  const db = freshDb();
  const res = await betaActivate.onRequestPost({
    env: { DB: db, BETA_COOKIE_SECRET: SECRET },
    request: { json: async () => ({}) }
  });
  assert.equal(res.status, 400);
});

test("beta-activate: invalid Google token returns 401", withGoogleStub(null, async () => {
  const db = freshDb();
  const res = await betaActivate.onRequestPost({
    env: { DB: db, BETA_COOKIE_SECRET: SECRET },
    request: { json: async () => ({ token: "bad" }) }
  });
  assert.equal(res.status, 401);
}));

test("beta-activate: valid token but email not on the allowlist returns 403, no cookie", withGoogleStub(
  { email: "not-a-tester@example.com", name: "Nobody" },
  async () => {
    const db = freshDb();
    const res = await betaActivate.onRequestPost({
      env: { DB: db, BETA_COOKIE_SECRET: SECRET },
      request: { json: async () => ({ token: "fake" }) }
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Set-Cookie"), null);
  }
));

test("beta-activate: valid token + allowlisted email mints a cookie that verifies back to that email", withGoogleStub(
  { email: "Beta.Tester@Example.com", name: "Beta Tester" },
  async () => {
    const db = freshDb();
    await db.prepare("INSERT INTO beta_testers (email, added_by) VALUES ('beta.tester@example.com', 'test')").run();

    const res = await betaActivate.onRequestPost({
      env: { DB: db, BETA_COOKIE_SECRET: SECRET },
      request: { json: async () => ({ token: "fake" }) }
    });
    assert.equal(res.status, 200);
    const body = await readJson(res);
    assert.equal(body.success, true);
    assert.equal(body.email, "beta.tester@example.com");

    const setCookie = res.headers.get("Set-Cookie");
    assert.ok(setCookie, "expected a Set-Cookie header");
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);

    const cookieValue = extractCookieValue(setCookie);
    const verifiedEmail = await verifyBetaCookie(cookieValue, SECRET);
    assert.equal(verifiedEmail, "beta.tester@example.com");
  }
));

test("beta-activate: the pre-seeded requester email (from migration 0012) is on the allowlist by default", withGoogleStub(
  { email: "albertjoshrock101@gmail.com", name: "Seeded Admin" },
  async () => {
    const db = freshDb();
    const res = await betaActivate.onRequestPost({
      env: { DB: db, BETA_COOKIE_SECRET: SECRET },
      request: { json: async () => ({ token: "fake" }) }
    });
    assert.equal(res.status, 200);
  }
));
