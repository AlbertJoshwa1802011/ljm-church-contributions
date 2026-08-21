import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as purchases from "../../functions/api/purchases.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("purchases: add_purchase records the signed-in admin as created_by", async () => {
  const db = freshDb(); // schema.sql already seeds the 'tech-contributions' fund

  const params = new URLSearchParams({
    action: "add_purchase", productName: "Projector", cost: "20000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const res = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?" + params.toString()
  })));
  assert.equal(res.success, true, res.message);

  const listRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases" })));
  const p = listRes.purchases.find(x => x.id === res.id);
  assert.ok(p, "the new purchase should appear in the public listing");
  assert.equal(p.createdBy, "api-token", "created_by should be the authenticated caller's identity");
});

test("purchases: update_purchase does not overwrite the original created_by", async () => {
  const db = freshDb();

  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Mixer", cost: "5000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const updateParams = new URLSearchParams({
    action: "update_purchase", id: addRes.id, productName: "Mixer (updated)", cost: "5500",
    purchaseDate: "2026-07-02", fundSource: "tech-contributions"
  });
  const updateRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + updateParams.toString() })));
  assert.equal(updateRes.success, true, updateRes.message);

  const row = await db.prepare("SELECT created_by, name FROM purchases WHERE id = ?").bind(addRes.id).first();
  assert.equal(row.created_by, "api-token", "editing a purchase must not blank out who originally added it");
  assert.equal(row.name, "Mixer (updated)");
});

test("purchases: add_purchase requires edit_purchases permission", async () => {
  const db = freshDb();
  const res = await readJson(await purchases.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/purchases?action=add_purchase&productName=X&cost=1&purchaseDate=2026-07-01&fundSource=tech-contributions"
  })));
  assert.equal(res.success, false);
});

test("purchases: delete_purchase removes the record", async () => {
  const db = freshDb();
  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Speaker", cost: "3000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const delRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: `https://test.local/api/purchases?action=delete_purchase&id=${addRes.id}`
  })));
  assert.equal(delRes.success, true, delRes.message);

  const row = await db.prepare("SELECT id FROM purchases WHERE id=?").bind(addRes.id).first();
  assert.equal(row, null);
});

test("purchases: update_purchase and delete_purchase require an id", async () => {
  const db = freshDb();
  const updateRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?action=update_purchase&productName=X&cost=1"
  })));
  assert.equal(updateRes.success, false);
  assert.match(updateRes.message, /Missing purchase id/);

  const deleteRes = await readJson(await purchases.onRequestGet(makeContext({
    db, url: "https://test.local/api/purchases?action=delete_purchase"
  })));
  assert.equal(deleteRes.success, false);
  assert.match(deleteRes.message, /Missing purchase id/);
});

test("purchases: fund/external contribution defaults from cost when not explicitly provided", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", productName: "Mic Stand", cost: "1500",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
    // no fundContribution/externalContribution provided
  });
  const res = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() })));

  const row = await db.prepare("SELECT fund_contribution, external_contribution FROM purchases WHERE id=?").bind(res.id).first();
  assert.equal(row.fund_contribution, 1500, "defaults to the full cost when not specified");
  assert.equal(row.external_contribution, 0);
});

// SECURITY regression (docs/audits/2026-08-21-production-hardening.md): the
// public /impact.html page hits this same unauthenticated listing, and
// never renders createdBy (the staff email who logged the purchase) — only
// admin.html's purchases table does. An anonymous caller must not receive it.
test("purchases: an unauthenticated (public) caller does not see createdBy, an authenticated admin still does", async () => {
  const db = freshDb();
  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Amplifier", cost: "8000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const publicRes = await readJson(await purchases.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/purchases" })));
  const publicRow = publicRes.purchases.find((p) => p.id === addRes.id);
  assert.ok(publicRow, "the purchase itself is still public (transparency-by-design)");
  assert.equal(publicRow.createdBy, undefined, "an anonymous caller must never see who logged the purchase");

  const adminRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases" })));
  const adminRow = adminRes.purchases.find((p) => p.id === addRes.id);
  assert.equal(adminRow.createdBy, "api-token", "admin.html's purchases table still needs the real value");
});

// ADVERSARIAL-PASS regression (docs/audits/2026-08-21-production-hardening.md):
// the first version of this fix used requireAuth(context) with no permission
// argument, so a caller authenticated with an unrelated permission (e.g.
// edit_wishlist) was treated as a full admin and could see createdBy. Now
// requires edit_purchases specifically.
test("purchases: a caller with an unrelated permission (edit_wishlist only) does not see createdBy", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('wishlist_only2', '["edit_wishlist"]');
     INSERT INTO member_roles (email, role_name) VALUES ('wishlist-volunteer2@example.com', 'wishlist_only2');`
  );
  const addParams = new URLSearchParams({
    action: "add_purchase", productName: "Drum Kit", cost: "12000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const addRes = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + addParams.toString() })));

  const context = {
    env: { DB: db, ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: {
      url: "https://test.local/api/purchases", method: "GET",
      headers: { get: (k) => (k === "Authorization" ? "Bearer wishlist-volunteer2@example.com" : null) }
    }
  };
  const res = await readJson(await purchases.onRequestGet(context));
  const row = res.purchases.find((p) => p.id === addRes.id);
  assert.equal(row.createdBy, undefined, "an unrelated permission must not unlock who logged the purchase");
});

// ADVERSARIAL-PASS regression (docs/audits/2026-08-21-production-hardening.md):
// a double-click / stale-tab resubmit of the "add purchase" form silently
// created two independent rows for the same real-world purchase (confirmed
// live, no id collision to catch it since the id was auto-generated fresh
// each time). Resubmitting the identical fields within 10s must now return
// the original row instead of creating a duplicate.
test("purchases: a resubmit of the identical add_purchase within 10s is deduped, not duplicated", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", productName: "Drum Kit", cost: "12000",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const r1 = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() })));
  const r2 = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() })));
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.equal(r2.id, r1.id, "the resubmit must return the original id, not create a new one");
  assert.equal(r2.deduped, true);

  const rows = await db.prepare("SELECT id FROM purchases WHERE name = 'Drum Kit'").all();
  assert.equal(rows.results.length, 1, "only one row should exist for the duplicated submission");

  // a genuinely different purchase (different cost) must still go through
  const params2 = new URLSearchParams({
    action: "add_purchase", productName: "Drum Kit", cost: "999",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const r3 = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params2.toString() })));
  assert.equal(r3.success, true);
  assert.notEqual(r3.id, r1.id, "a genuinely different purchase must not be deduped away");
});

test("purchases: an explicit id bypasses dedup (legacy/explicit-id callers keep their own semantics)", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", id: "P-explicit-1", productName: "Cables", cost: "500",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  const res = await readJson(await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() })));
  assert.equal(res.success, true);
  assert.equal(res.id, "P-explicit-1");
});

test("purchases: default public listing (no action) aggregates totalSpent and totalCost", async () => {
  const db = freshDb();
  const params = new URLSearchParams({
    action: "add_purchase", productName: "Cables", cost: "1000", fundContribution: "600", externalContribution: "400",
    purchaseDate: "2026-07-01", fundSource: "tech-contributions"
  });
  await purchases.onRequestGet(makeContext({ db, url: "https://test.local/api/purchases?" + params.toString() }));

  const res = await readJson(await purchases.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/purchases" })));
  assert.equal(res.success, true);
  assert.equal(res.count, 1);
  assert.equal(res.totalSpent, 600, "totalSpent sums fund_contribution");
  assert.equal(res.totalCost, 1000, "totalCost sums the full cost");
});
