import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as search from "../../functions/api/search.js";
import * as members from "../../functions/api/members.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("search: too-short query returns empty results without touching the db", async () => {
  const db = freshDb();
  const res = await readJson(await search.onRequestGet(makeContext({
    db, url: "https://test.local/api/search?q=a"
  })));
  assert.equal(res.success, true);
  assert.deepEqual(res.results, {});
});

test("search: finds a member by partial name and a seeded fund by name", async () => {
  const db = freshDb();
  await members.onRequestPost(makeContext({
    db, body: { name: "Thomas Varghese", email: "thomas@example.com" }
  }));

  const res = await readJson(await search.onRequestGet(makeContext({
    db, url: "https://test.local/api/search?q=thomas"
  })));
  assert.equal(res.success, true);
  assert.equal(res.results.members.length, 1);
  assert.equal(res.results.members[0].name, "Thomas Varghese");

  const fundRes = await readJson(await search.onRequestGet(makeContext({
    db, url: "https://test.local/api/search?q=christmas"
  })));
  assert.equal(fundRes.results.funds.some((f) => f.slug === "christmas-fund"), true);
});

test("search: a caller without view_members permission gets no member/family results", async () => {
  const db = freshDb();
  await members.onRequestPost(makeContext({
    db, body: { name: "Thomas Varghese" }
  }));
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('wishlist_only', '["edit_wishlist"]');
     INSERT INTO member_roles (email, role_name) VALUES ('editor@example.com', 'wishlist_only');`
  );

  // Scoped (non-wildcard) permission holders authenticate via the legacy
  // plain-email path in tests — built by hand here since makeContext's
  // helper always uses the wildcard ADMIN_API_TOKEN.
  const env = { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" };
  const request = {
    url: "https://test.local/api/search?q=thomas",
    method: "GET",
    headers: { get: (k) => (k === "Authorization" ? "Bearer editor@example.com" : null) },
    json: async () => ({})
  };

  const res = await readJson(await search.onRequestGet({ env, request }));
  assert.equal(res.results.members, undefined);
  assert.equal(res.results.families, undefined);
  assert.equal(res.results.funds, undefined);
  assert.equal(res.results.wishlist.length, 0);
});

test("search: requires authentication", async () => {
  const db = freshDb();
  const res = await search.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/search?q=thomas"
  }));
  assert.equal(res.status, 401);
});
