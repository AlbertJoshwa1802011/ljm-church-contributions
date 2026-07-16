// Characterization tests for /api/expenses — the church expense ledger.
// Locks in the transparency boundary: the public sees only non-private,
// non-cancelled entries; admins with manage_expenses see everything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as expenses from "../../functions/api/expenses.js";

async function readJson(res) { return JSON.parse(await res.text()); }
function add(db, body) {
  return expenses.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/expenses", body }));
}

test("expenses: public GET hides private and cancelled entries", async () => {
  const db = freshDb();
  await add(db, { title: "Public paid", amount: 100, status: "paid" });
  await add(db, { title: "Secret", amount: 200, status: "paid", isPrivate: true });
  await add(db, { title: "Cancelled", amount: 300, status: "cancelled" });

  const pub = await readJson(await expenses.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/expenses" })));
  const titles = pub.expenses.map(e => e.title);
  assert.ok(titles.includes("Public paid"));
  assert.ok(!titles.includes("Secret"), "private entries stay hidden from the public");
  assert.ok(!titles.includes("Cancelled"), "cancelled entries stay hidden from the public");
  assert.equal(pub.summary.totalPaid, 100);
});

test("expenses: admin ?all=1 sees every entry including private", async () => {
  const db = freshDb();
  await add(db, { title: "Public paid", amount: 100, status: "paid" });
  await add(db, { title: "Secret", amount: 200, status: "paid", isPrivate: true });

  const all = await readJson(await expenses.onRequestGet(makeContext({ db, url: "https://test.local/api/expenses?all=1" })));
  assert.equal(all.expenses.length, 2);
});

test("expenses: ?all=1 requires manage_expenses permission", async () => {
  const db = freshDb();
  const res = await readJson(await expenses.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/expenses?all=1"
  })));
  assert.equal(res.success, false);
});

test("expenses: POST validates title and non-negative amount", async () => {
  const db = freshDb();
  const noTitle = await readJson(await add(db, { amount: 50 }));
  assert.equal(noTitle.success, false);
  const negative = await readJson(await add(db, { title: "Bad", amount: -5 }));
  assert.equal(negative.success, false);
});

test("expenses: DELETE removes an entry", async () => {
  const db = freshDb();
  const created = await readJson(await add(db, { title: "Temp", amount: 10, status: "paid" }));
  const del = await readJson(await expenses.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/expenses?id=" + created.id
  })));
  assert.equal(del.success, true, del.message);
  const row = await db.prepare("SELECT id FROM expenses WHERE id=?").bind(created.id).first();
  assert.equal(row, null);
});
