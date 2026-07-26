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

test("search: finds a family and a purchase by partial name", async () => {
  const db = freshDb();
  db._sqlite.exec(`INSERT INTO families (family_name, primary_phone) VALUES ('Varghese Family', '9999999999')`);
  await db.prepare(
    "INSERT INTO purchases (id, name, amount, date, fund, status, fund_contribution) VALUES ('P-search-1', 'Wireless Microphone', 5000, '2026-07-01', 'tech-contributions', 'Active', 5000)"
  ).run();

  const famRes = await readJson(await search.onRequestGet(makeContext({ db, url: "https://test.local/api/search?q=varghese" })));
  assert.equal(famRes.results.families.length, 1);
  assert.equal(famRes.results.families[0].name, "Varghese Family");

  const purchaseRes = await readJson(await search.onRequestGet(makeContext({ db, url: "https://test.local/api/search?q=microphone" })));
  assert.equal(purchaseRes.results.purchases.length, 1);
  assert.equal(purchaseRes.results.purchases[0].name, "Wireless Microphone");
});

test("search: a caller scoped to only manage_funds sees funds but not purchases/members/wishlist", async () => {
  const db = freshDb();
  await db.prepare(
    "INSERT INTO purchases (id, name, amount, date, fund, status, fund_contribution) VALUES ('P-search-2', 'Christmas Lights', 2000, '2026-07-01', 'christmas-fund', 'Active', 2000)"
  ).run();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('funds_only', '["manage_funds"]');
     INSERT INTO member_roles (email, role_name) VALUES ('funds-scoped@example.com', 'funds_only');`
  );
  const env = { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" };
  const request = {
    url: "https://test.local/api/search?q=christmas",
    method: "GET",
    headers: { get: (k) => (k === "Authorization" ? "Bearer funds-scoped@example.com" : null) },
    json: async () => ({})
  };

  const res = await readJson(await search.onRequestGet({ env, request }));
  assert.ok(res.results.funds.some(f => f.slug === "christmas-fund"), "funds category should be visible");
  assert.equal(res.results.purchases, undefined, "purchases category requires edit_purchases, which this caller lacks");
  assert.equal(res.results.members, undefined);
  assert.equal(res.results.wishlist, undefined);
});

test("search: a caller scoped to only edit_purchases sees purchases but not funds", async () => {
  const db = freshDb();
  await db.prepare(
    "INSERT INTO purchases (id, name, amount, date, fund, status, fund_contribution) VALUES ('P-search-3', 'Guitar Strings', 500, '2026-07-01', 'tech-contributions', 'Active', 500)"
  ).run();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('purchases_only', '["edit_purchases"]');
     INSERT INTO member_roles (email, role_name) VALUES ('purchases-scoped@example.com', 'purchases_only');`
  );
  const env = { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" };
  const request = {
    url: "https://test.local/api/search?q=guitar",
    method: "GET",
    headers: { get: (k) => (k === "Authorization" ? "Bearer purchases-scoped@example.com" : null) },
    json: async () => ({})
  };

  const res = await readJson(await search.onRequestGet({ env, request }));
  assert.ok(res.results.purchases.some(p => p.name === "Guitar Strings"));
  assert.equal(res.results.funds, undefined, "funds category requires manage_funds, which this caller lacks");
});
