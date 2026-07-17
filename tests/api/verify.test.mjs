// Characterization tests for /api/verify — the read-only data-integrity audit.
// Covers the auth gate, the D1-only (?skipRemote=1) path, and proves the
// integrity checker actually detects a real anomaly (not just that it runs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as verify from "../../functions/api/verify.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("verify: requires view_members permission", async () => {
  const db = freshDb();
  const res = await verify.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/verify?skipRemote=1"
  }));
  assert.equal(res.status, 401);
});

test("verify: ?skipRemote=1 runs only D1-internal checks and reports a clean baseline as all-pass", async () => {
  const db = freshDb();
  const res = await readJson(await verify.onRequestGet(makeContext({
    db, url: "https://test.local/api/verify?skipRemote=1"
  })));
  assert.equal(res.success, true, JSON.stringify(res.checks.filter(c => c.status === "fail")));
  assert.equal(res.summary.fail, 0);
  assert.ok(res.checks.some(c => c.name === "reconcile: skipped"));
  assert.ok(res.checks.some(c => c.name === "schema: system funds seeded" && c.status === "pass"));
});

test("verify: catches a deliberately-seeded orphaned contribution (member not in the members table)", async () => {
  const db = freshDb();
  // A contribution whose member_name has no matching row in `members` — an
  // integrity anomaly the checker exists specifically to catch.
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Ghost Contributor', 100, '2026-07-01', 'Direct Cash', 'ghost1', 'tech-contributions')"
  ).run();

  const res = await readJson(await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" })));
  const check = res.checks.find(c => c.name === "integrity: contributions reference known members");
  assert.equal(check.status, "warn", "an orphaned contributor must be flagged");
  assert.match(check.detail, /Ghost Contributor/);
});

test("verify: catches a contribution pointing at an unregistered fund slug", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name) VALUES ('Real Member')").run();
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Real Member', 100, '2026-07-01', 'Direct Cash', 'orphanfund1', 'nonexistent-fund')"
  ).run();

  const res = await readJson(await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" })));
  const check = res.checks.find(c => c.name === "integrity: contribution funds registered");
  assert.equal(check.status, "warn");
  assert.match(check.detail, /nonexistent-fund/);
});

test("verify: catches an out-of-range contribution amount", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name) VALUES ('Big Giver')").run();
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Big Giver', 9999999, '2026-07-01', 'Direct Cash', 'huge1', 'tech-contributions')"
  ).run();

  const res = await readJson(await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" })));
  const check = res.checks.find(c => c.name.includes("contribution amounts in range"));
  assert.equal(check.status, "warn");
});

test("verify: catches duplicate member emails", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO members (name, email) VALUES ('Person One', 'shared@example.com')").run();
  await db.prepare("INSERT INTO members (name, email) VALUES ('Person Two', 'shared@example.com')").run();

  const res = await readJson(await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" })));
  const check = res.checks.find(c => c.name === "sanity: member emails unique");
  assert.equal(check.status, "warn");
});

test("verify: catches a goal-amount mismatch between config and the funds registry", async () => {
  const db = freshDb();
  await db.prepare("UPDATE config SET value = '999999' WHERE key = 'tech_goal_amount'").run();
  // funds.goal_amount was seeded from config at schema-load time and is now stale.

  const res = await readJson(await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" })));
  const check = res.checks.find(c => c.name === "consistency: goal amounts (config vs funds)");
  assert.equal(check.status, "warn");
  assert.match(check.detail, /tech-contributions/);
});

test("verify: never writes to any data table — only an audit row", async () => {
  const db = freshDb();
  const before = await db.prepare("SELECT COUNT(*) AS n FROM contributions").first();
  await verify.onRequestGet(makeContext({ db, url: "https://test.local/api/verify?skipRemote=1" }));
  const after = await db.prepare("SELECT COUNT(*) AS n FROM contributions").first();
  assert.equal(before.n, after.n);

  const auditRow = await db.prepare("SELECT action FROM activity_logs WHERE action = 'verify.run'").first();
  assert.ok(auditRow, "a verify.run audit row should be recorded");
});
