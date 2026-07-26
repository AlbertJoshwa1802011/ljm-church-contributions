// Regression test: SQL-injection-shaped strings must be stored as inert data,
// never alter query behavior. Every handler in this repo uses parameterized
// `.bind()` calls (no string-concatenated SQL was found anywhere in
// functions/api/), so this is a proof, not a bug hunt — but it's cheap
// insurance against a future handler accidentally interpolating user input
// into a raw SQL string. See docs/testing/COVERAGE-TRACKER.md P2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as members from "../../functions/api/members.js";
import * as expenses from "../../functions/api/expenses.js";
import * as funds from "../../functions/api/funds.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE members;--",
  "Robert'); DROP TABLE members;--",
  "\" OR 1=1 --",
  "'; DELETE FROM contributions WHERE '1'='1"
];

test("sql-injection: a member name containing injection-shaped text is stored inertly, and the table survives", async () => {
  const db = freshDb();
  for (const payload of PAYLOADS) {
    const res = await readJson(await members.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/members", body: { name: payload }
    })));
    assert.equal(res.success, true, `should store the literal string, not execute it: ${payload}`);
  }

  // The members table must still exist and contain exactly the rows we inserted
  // (schema.sql seeds none) — proof no DROP/DELETE payload actually executed.
  const rows = await db.prepare("SELECT name FROM members").all();
  assert.equal(rows.results.length, PAYLOADS.length);
  for (const payload of PAYLOADS) {
    assert.ok(rows.results.some(r => r.name === payload), `literal payload should be stored as-is: ${payload}`);
  }
});

test("sql-injection: an expense title containing injection-shaped text does not affect other rows", async () => {
  const db = freshDb();
  await expenses.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/expenses", body: { title: "Legit Expense", amount: 100, status: "paid" }
  }));

  const res = await readJson(await expenses.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/expenses",
    body: { title: "'; DELETE FROM expenses WHERE '1'='1", amount: 50, status: "paid" }
  })));
  assert.equal(res.success, true);

  const rows = await db.prepare("SELECT title FROM expenses").all();
  assert.equal(rows.results.length, 2, "the injection-shaped title must not delete the other row");
  assert.ok(rows.results.some(r => r.title === "Legit Expense"), "the earlier legitimate row must survive untouched");
});

test("sql-injection: a fund name/description containing injection-shaped text doesn't corrupt the funds table", async () => {
  const db = freshDb();
  const res = await readJson(await funds.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/funds",
    body: { name: "Building Fund", description: "'; DROP TABLE funds;--" }
  })));
  assert.equal(res.success, true, res.message);

  // Both system funds (seeded) and the new one must still be present.
  const rows = await db.prepare("SELECT slug FROM funds").all();
  const slugs = rows.results.map(r => r.slug);
  assert.ok(slugs.includes("tech-contributions"));
  assert.ok(slugs.includes("christmas-fund"));
  assert.ok(slugs.includes("building-fund"));
});
