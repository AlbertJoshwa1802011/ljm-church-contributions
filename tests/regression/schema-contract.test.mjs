// Schema contract guard. This is a tripwire for the milestone rule that new work
// must be ADDITIVE ONLY: it fails if a future edit to schema.sql drops a table or
// column that existing features (and real contribution data) depend on. Adding
// new tables/columns is fine; removing or renaming these is what breaks things.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";

const REQUIRED = {
  members: ["id", "name", "email", "phone", "is_verified"],
  contributions: ["id", "member_name", "amount", "date", "category", "notes", "proof_id", "email", "phone", "fund"],
  purchases: ["id", "name", "amount", "fund", "status", "fund_contribution"],
  funds: ["id", "slug", "name", "goal_amount", "status", "visibility", "is_system"],
  expenses: ["id", "title", "amount", "status", "is_private"],
  config: ["key", "value"],
  roles: ["role_name", "permissions"],
  member_roles: ["email", "role_name"],
  activity_logs: ["id", "action", "actor_email", "actor_type"]
};

test("schema contract: critical tables and columns still exist (guards against a breaking migration)", () => {
  const sqlite = freshDb()._sqlite;
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const info = sqlite.prepare(`PRAGMA table_info(${table})`).all();
    assert.ok(info.length > 0, `table '${table}' must exist`);
    const names = info.map(c => c.name);
    for (const col of cols) {
      assert.ok(names.includes(col), `column '${table}.${col}' must exist`);
    }
  }
});

test("schema contract: contributions.proof_id is UNIQUE (webhook idempotency depends on it)", async () => {
  const db = freshDb();
  await db.prepare(
    "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('X',1,'2026-01-01','Direct Cash','dup','tech-contributions')"
  ).run();
  await assert.rejects(
    db.prepare(
      "INSERT INTO contributions (member_name, amount, date, category, proof_id, fund) VALUES ('Y',2,'2026-01-02','Direct Cash','dup','tech-contributions')"
    ).run(),
    "a second contribution with the same proof_id must be rejected by the UNIQUE constraint"
  );
});

test("schema contract: the two legacy system funds are seeded and marked is_system", async () => {
  const db = freshDb();
  const rows = (await db.prepare("SELECT slug, is_system FROM funds ORDER BY slug").all()).results;
  const bySlug = Object.fromEntries(rows.map(r => [r.slug, r.is_system]));
  assert.equal(bySlug["tech-contributions"], 1);
  assert.equal(bySlug["christmas-fund"], 1);
});
