// Characterization tests for /api/funds — the dynamic fund registry.
// Locks in the protections around the two live system funds (Tech/Christmas):
// they can't be renamed, restructured or deleted, and deleting a custom fund is
// a soft delete that PRESERVES contribution history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as funds from "../../functions/api/funds.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("funds: public listing shows the two seeded system funds", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds"
  })));
  const slugs = res.funds.map(f => f.slug).sort();
  assert.deepEqual(slugs, ["christmas-fund", "tech-contributions"]);
  assert.ok(res.funds.every(f => f.isSystem === 1));
});

test("funds: an admin can create a custom fund and it becomes visible", async () => {
  const db = freshDb();
  const create = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Building Fund", goal_amount: 100000 }
  })));
  assert.equal(create.success, true, create.message);
  assert.equal(create.slug, "building-fund");

  const list = await readJson(await funds.onRequestGet(makeContext({ db, url: "https://test.local/api/funds" })));
  assert.ok(list.funds.find(f => f.slug === "building-fund"), "new fund appears in the listing");
});

test("funds: system funds reject rename but allow goal changes (and keep the legacy config key in sync)", async () => {
  const db = freshDb();
  const bad = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "tech-contributions", name: "Renamed Fund" }
  })));
  assert.equal(bad.success, false, "renaming a system fund must be refused");

  const good = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "tech-contributions", goal_amount: 75000 }
  })));
  assert.equal(good.success, true, good.message);

  const row = await db.prepare("SELECT goal_amount FROM funds WHERE slug='tech-contributions'").first();
  assert.equal(row.goal_amount, 75000);
  const cfg = await db.prepare("SELECT value FROM config WHERE key='tech_goal_amount'").first();
  assert.equal(cfg.value, "75000", "legacy config fallback stays consistent");
});

test("funds: system funds cannot be deleted", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/funds?slug=tech-contributions"
  })));
  assert.equal(res.success, false);
});

test("funds: deleting a custom fund is soft and preserves its contributions", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Temp Fund" }
  }));
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Gv',100,'2026-07-01 10:00:00','Direct Cash','pf1','temp-fund')"
  ).run();

  const del = await readJson(await funds.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/funds?slug=temp-fund"
  })));
  assert.equal(del.success, true, del.message);

  const fund = await db.prepare("SELECT status FROM funds WHERE slug='temp-fund'").first();
  assert.equal(fund.status, "deleted", "soft delete flips status, doesn't drop the row");
  const contrib = await db.prepare("SELECT COUNT(*) AS n FROM contributions WHERE fund='temp-fund'").first();
  assert.equal(contrib.n, 1, "contribution history must survive a fund deletion");
});

test("funds: creating a fund requires manage_funds permission", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/funds", body: { name: "X" }
  })));
  assert.equal(res.success, false);
});

test("funds: GET ?slug= detail returns the legacy-shape payload with assignedMembers", async () => {
  const db = freshDb();
  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=tech-contributions"
  })));
  assert.equal(detail.goalAmount, 50000);
  assert.deepEqual(detail.contributions, []);
  assert.equal(detail.fund.slug, "tech-contributions");
  assert.equal(detail.fund.isSystem, true);
  assert.deepEqual(detail.assignedMembers, []);
});

test("funds: GET ?slug= for a nonexistent fund is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=does-not-exist"
  })));
  assert.match(res.error, /not found/i);
});

test("funds: a members-only fund is hidden from an anonymous caller but visible to an assigned member and to manage_funds holders", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Leaders Retreat", visibility: "members" }
  }));
  await db.prepare("INSERT INTO members (name, email) VALUES ('Assigned Person','assigned@example.com')").run();
  const member = await db.prepare("SELECT id FROM members WHERE name='Assigned Person'").first();
  const fund = await db.prepare("SELECT id FROM funds WHERE slug='leaders-retreat'").first();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { action: "add_member", slug: "leaders-retreat", memberId: member.id }
  }));

  // Anonymous, unassigned caller — rejected.
  const anon = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=leaders-retreat"
  })));
  assert.match(anon.error, /restricted/i);

  // manage_funds holder — allowed even without an explicit assignment.
  const admin = await readJson(await funds.onRequestGet(makeContext({
    db, url: "https://test.local/api/funds?slug=leaders-retreat"
  })));
  assert.equal(admin.fund.slug, "leaders-retreat");
  assert.equal(admin.assignedMembers.length, 1);
  assert.equal(admin.assignedMembers[0].id, member.id);
});

test("funds: add_member then remove_member updates the assignment list", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Youth Camp", visibility: "members" }
  }));
  await db.prepare("INSERT INTO members (name) VALUES ('Camper One')").run();
  const member = await db.prepare("SELECT id FROM members WHERE name='Camper One'").first();

  const add = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { action: "add_member", slug: "youth-camp", memberId: member.id }
  })));
  assert.equal(add.success, true, add.message);

  let detail = await readJson(await funds.onRequestGet(makeContext({ db, url: "https://test.local/api/funds?slug=youth-camp" })));
  assert.equal(detail.assignedMembers.length, 1);

  const remove = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { action: "remove_member", slug: "youth-camp", memberId: member.id }
  })));
  assert.equal(remove.success, true, remove.message);

  detail = await readJson(await funds.onRequestGet(makeContext({ db, url: "https://test.local/api/funds?slug=youth-camp" })));
  assert.equal(detail.assignedMembers.length, 0);
});

test("funds: creating a fund with a reserved slug is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Admin", slug: "admin" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /[Rr]eserved/);
});

test("funds: creating a fund with a slug that already exists is rejected with 409", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Tech Contributions Dup", slug: "tech-contributions" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /already exists/);
});

test("funds: PUT on a nonexistent fund is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds", body: { slug: "no-such-fund", goal_amount: 100 }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /not found/i);
});

test("funds: PUT with no editable fields is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds", body: { slug: "tech-contributions" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /No editable fields/);
});

test("funds: DELETE on a nonexistent fund is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/funds?slug=no-such-fund"
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /not found/i);
});

test("funds: DELETE requires the delete_funds permission, which is distinct from manage_funds", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/funds", body: { name: "Deletable" } }));

  // A role holding manage_funds but NOT delete_funds — authenticate via the
  // legacy plain-email path (the machine ADMIN_API_TOKEN always has wildcard '*').
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('fund_editor_only', '["manage_funds"]');
     INSERT INTO member_roles (email, role_name) VALUES ('funds-editor@example.com', 'fund_editor_only');`
  );
  const env = { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" };
  const request = {
    url: "https://test.local/api/funds?slug=deletable",
    method: "DELETE",
    headers: { get: (k) => (k === "Authorization" ? "Bearer funds-editor@example.com" : null) },
    json: async () => ({})
  };

  const res = await readJson(await funds.onRequestDelete({ env, request }));
  assert.equal(res.success, false, "manage_funds alone must not be enough to delete a fund");

  const stillThere = await db.prepare("SELECT status FROM funds WHERE slug='deletable'").first();
  assert.equal(stillThere.status, "active");
});

// ── Fund Foundation metadata (hero image, message, ranking groundwork, Razorpay
//    public-key groundwork) — see migrations/0015_fund_foundation_metadata.sql ──

test("funds: a new fund defaults to no hero image, empty message, ranking disabled/public, and no Razorpay key", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Plain Fund" }
  }));
  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=plain-fund"
  })));
  assert.equal(detail.fund.heroImageUrl, "");
  assert.equal(detail.fund.heroImageStorage, "");
  assert.equal(detail.fund.message, "");
  assert.equal(detail.fund.rankingEnabled, false);
  assert.equal(detail.fund.rankingVisibility, "public");
  assert.equal(detail.fund.razorpayKeyId, "");
});

test("funds: create with a data-URL hero image falls back to base64 storage with no R2 binding, and it round-trips through listing + detail", async () => {
  const db = freshDb();
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const create = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Building Fund", heroImage: dataUrl, message: "Help us build a new sanctuary." }
  })));
  assert.equal(create.success, true, create.message);

  const list = await readJson(await funds.onRequestGet(makeContext({ db, url: "https://test.local/api/funds" })));
  const row = list.funds.find(f => f.slug === "building-fund");
  assert.equal(row.heroImageUrl, dataUrl);
  assert.equal(row.heroImageStorage, "base64");
  assert.equal(row.message, "Help us build a new sanctuary.");

  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=building-fund"
  })));
  assert.equal(detail.fund.heroImageUrl, dataUrl);
  assert.equal(detail.fund.heroImageStorage, "base64");
});

test("funds: create with a plain external hero image URL is stored as 'external' verbatim", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "External Hero", heroImage: "https://cdn.example.com/hero.jpg" }
  }));
  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=external-hero"
  })));
  assert.equal(detail.fund.heroImageUrl, "https://cdn.example.com/hero.jpg");
  assert.equal(detail.fund.heroImageStorage, "external");
});

test("funds: create rejects a non-string hero image and an oversized external hero image URL", async () => {
  const db = freshDb();
  const badType = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds", body: { name: "Bad Hero 1", heroImage: 12345 }
  })));
  assert.equal(badType.success, false);

  const tooLong = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Bad Hero 2", heroImage: "https://cdn.example.com/" + "x".repeat(2000) }
  })));
  assert.equal(tooLong.success, false);
  assert.match(tooLong.message, /exceeds/i);
});

test("funds: create rejects a fund message over the length cap", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Long Message Fund", message: "x".repeat(5001) }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /exceeds/i);
});

test("funds: create validates rankingVisibility and stores rankingEnabled/rankingVisibility", async () => {
  const db = freshDb();
  const bad = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Bad Ranking Fund", rankingVisibility: "everyone" }
  })));
  assert.equal(bad.success, false);
  assert.match(bad.message, /rankingVisibility/);

  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Ranked Fund", rankingEnabled: true, rankingVisibility: "members" }
  }));
  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=ranked-fund"
  })));
  assert.equal(detail.fund.rankingEnabled, true);
  assert.equal(detail.fund.rankingVisibility, "members");
});

test("funds: create validates razorpayKeyId looks like a Razorpay public key id, never a secret", async () => {
  const db = freshDb();
  const bad = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Bad Key Fund", razorpayKeyId: "some_random_secret_looking_value" }
  })));
  assert.equal(bad.success, false);
  assert.match(bad.message, /razorpayKeyId/);

  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Good Key Fund", razorpayKeyId: "rzp_live_STrG9mXFNPWfMM" }
  }));
  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=good-key-fund"
  })));
  assert.equal(detail.fund.razorpayKeyId, "rzp_live_STrG9mXFNPWfMM");
});

test("funds: PUT allows Fund Foundation metadata edits on a SYSTEM fund (Tech Fund) while still blocking identity fields", async () => {
  const db = freshDb();
  const identityBlocked = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "tech-contributions", name: "Renamed" }
  })));
  assert.equal(identityBlocked.success, false);

  const metaOk = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: {
      slug: "tech-contributions",
      message: "Every gift keeps our livestream and sound running.",
      rankingEnabled: true,
      rankingVisibility: "public",
      razorpayKeyId: "rzp_live_TechFundKey01",
      heroImage: "https://cdn.example.com/tech-hero.jpg"
    }
  })));
  assert.equal(metaOk.success, true, metaOk.message);

  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=tech-contributions"
  })));
  assert.equal(detail.fund.message, "Every gift keeps our livestream and sound running.");
  assert.equal(detail.fund.rankingEnabled, true);
  assert.equal(detail.fund.razorpayKeyId, "rzp_live_TechFundKey01");
  assert.equal(detail.fund.heroImageUrl, "https://cdn.example.com/tech-hero.jpg");
  assert.equal(detail.fund.heroImageStorage, "external");
  // Identity fields must be untouched by the metadata-only update.
  assert.equal(detail.fund.name, "Tech Fund", "system fund name must remain unchanged");
});

test("funds: PUT removeHeroImage clears a previously-set hero image", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Has Hero", heroImage: "https://cdn.example.com/hero.jpg" }
  }));
  const remove = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "has-hero", removeHeroImage: true }
  })));
  assert.equal(remove.success, true, remove.message);

  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=has-hero"
  })));
  assert.equal(detail.fund.heroImageUrl, "");
  assert.equal(detail.fund.heroImageStorage, "");
});

test("funds: PUT rejects an invalid rankingVisibility and an invalid razorpayKeyId", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/funds", body: { name: "Validate Me" } }));

  const badRanking = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "validate-me", rankingVisibility: "everyone" }
  })));
  assert.equal(badRanking.success, false);

  const badKey = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "validate-me", razorpayKeyId: "not-a-real-key" }
  })));
  assert.equal(badKey.success, false);
});

test("funds: PUT can clear a Razorpay key by sending an empty string", async () => {
  const db = freshDb();
  await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Keyed Fund", razorpayKeyId: "rzp_live_KeyedFund01" }
  }));
  const clear = await readJson(await funds.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/funds",
    body: { slug: "keyed-fund", razorpayKeyId: "" }
  })));
  assert.equal(clear.success, true, clear.message);

  const detail = await readJson(await funds.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/funds?slug=keyed-fund"
  })));
  assert.equal(detail.fund.razorpayKeyId, "");
});
