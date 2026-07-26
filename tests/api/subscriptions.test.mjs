import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as families from "../../functions/api/families.js";
import * as subscriptions from "../../functions/api/subscriptions.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function setSubscriptionsAmount(db, amount) {
  await db.prepare("UPDATE config SET value = ? WHERE key = 'sandha_amount'").bind(String(amount)).run();
}

test("subscriptions: family payment is billed once regardless of member count, individual stays untouched", async () => {
  const db = freshDb();
  await setSubscriptionsAmount(db, 100);

  // An ungrouped individual, tracked exactly as before.
  const soloRes = await db.prepare("INSERT INTO members (name) VALUES ('Solo Believer')").run();
  const soloId = soloRes.meta.last_row_id;

  // A 3-person family.
  const createRes = await readJson(await families.onRequestPost(makeContext({
    db,
    body: {
      familyName: "Verghese Family",
      members: [
        { name: "Abraham Verghese", relation: "Head" },
        { name: "Susan Verghese", relation: "Spouse" },
        { name: "Little Verghese", relation: "Child" }
      ]
    }
  })));
  assert.equal(createRes.success, true, createRes.message);
  const familyId = createRes.id;

  const month = "2026-07";

  // Mark the family paid — should default paid_by to the head, and be ONE payment, not 3.
  const markFamily = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", familyId, month }
  })));
  assert.equal(markFamily.success, true, markFamily.message);

  const familyPaymentCount = await db.prepare("SELECT COUNT(*) AS n FROM sandha_family_payments WHERE family_id = ? AND month = ?").bind(familyId, month).first();
  assert.equal(familyPaymentCount.n, 1, "a family must be billed once, not once per member");

  const paymentRow = await db.prepare("SELECT amount, paid_by_member_id FROM sandha_family_payments WHERE family_id = ? AND month = ?").bind(familyId, month).first();
  assert.equal(paymentRow.amount, 100);
  const head = await db.prepare("SELECT id FROM members WHERE name = 'Abraham Verghese'").first();
  assert.equal(paymentRow.paid_by_member_id, head.id, "should default to the family head as payer");

  // Mark the solo believer paid individually — unaffected by family logic.
  const markSolo = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", memberId: soloId, month }
  })));
  assert.equal(markSolo.success, true, markSolo.message);

  // The month view should show: 1 paid individual, 1 paid family, family members
  // NOT double-counted as individuals.
  const view = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: `https://test.local/api/subscriptions?month=${month}` })));
  assert.equal(view.paid.length, 1);
  assert.equal(view.paid[0].name, "Solo Believer");
  assert.equal(view.families.paid.length, 1);
  assert.equal(view.families.paid[0].familyName, "Verghese Family");
  assert.equal(view.families.paid[0].memberCount, 3);
  assert.equal(view.totals.paidCount, 2, "1 individual + 1 family = 2 paid entities");
  assert.equal(view.totals.collected, 200);

  // Family members must never appear in the individual pending list either.
  const anyFamilyMemberInPending = view.pending.some(p => ["Abraham Verghese", "Susan Verghese", "Little Verghese"].includes(p.name));
  assert.equal(anyFamilyMemberInPending, false);
});

test("subscriptions: cannot mark a family member paid individually once grouped", async () => {
  const db = freshDb();
  const createRes = await readJson(await families.onRequestPost(makeContext({
    db, body: { familyName: "Solo In Family", members: [{ name: "Grouped Person", relation: "Head" }] }
  })));
  const member = await db.prepare("SELECT id FROM members WHERE name = 'Grouped Person'").first();

  const res = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", memberId: member.id, month: "2026-07" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /part of a family/);
});

test("subscriptions: unmarking a family payment removes it and it reverts to pending", async () => {
  const db = freshDb();
  const createRes = await readJson(await families.onRequestPost(makeContext({
    db, body: { familyName: "Toggle Family", members: [{ name: "Toggle Head", relation: "Head" }] }
  })));
  const familyId = createRes.id;
  const month = "2026-08";

  await subscriptions.onRequestPost(makeContext({ db, body: { action: "mark_paid", familyId, month } }));
  let view = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: `https://test.local/api/subscriptions?month=${month}` })));
  assert.equal(view.families.paid.length, 1);

  const unmarkRes = await readJson(await subscriptions.onRequestPost(makeContext({ db, body: { action: "unmark", familyId, month } })));
  assert.equal(unmarkRes.success, true);

  view = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: `https://test.local/api/subscriptions?month=${month}` })));
  assert.equal(view.families.paid.length, 0);
  assert.equal(view.families.pending.length, 1);
});

test("subscriptions: personal history reflects the family's payments once grouped", async () => {
  const db = freshDb();
  const createRes = await readJson(await families.onRequestPost(makeContext({
    db, body: { familyName: "History Family", members: [{ name: "History Head", relation: "Head" }, { name: "History Kid", relation: "Child" }] }
  })));
  const familyId = createRes.id;
  await subscriptions.onRequestPost(makeContext({ db, body: { action: "mark_paid", familyId, month: "2026-01" } }));

  const personal = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: "https://test.local/api/subscriptions?member=History%20Kid&year=2026" })));
  assert.equal(personal.isFamilyBased, true);
  assert.equal(personal.familyName, "History Family");
  assert.equal(personal.paidMonths.length, 1);
  assert.equal(personal.paidMonths[0].month, "2026-01");
});

test("subscriptions: an ungrouped individual can be marked paid and unmarked directly", async () => {
  const db = freshDb();
  await setSubscriptionsAmount(db, 50);
  const res = await db.prepare("INSERT INTO members (name) VALUES ('Ungrouped Believer')").run();
  const memberId = res.meta.last_row_id;

  const mark = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", memberId, month: "2026-03" }
  })));
  assert.equal(mark.success, true, mark.message);

  let view = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: "https://test.local/api/subscriptions?month=2026-03" })));
  assert.equal(view.paid.length, 1);
  assert.equal(view.paid[0].name, "Ungrouped Believer");

  const unmark = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "unmark", memberId, month: "2026-03" }
  })));
  assert.equal(unmark.success, true, unmark.message);

  view = await readJson(await subscriptions.onRequestGet(makeContext({ db, url: "https://test.local/api/subscriptions?month=2026-03" })));
  assert.equal(view.paid.length, 0);
  assert.ok(view.pending.some(p => p.name === "Ungrouped Believer"));
});

test("subscriptions: an ungrouped individual's personal history is returned without a family", async () => {
  const db = freshDb();
  const res = await db.prepare("INSERT INTO members (name) VALUES ('Solo History')").run();
  const memberId = res.meta.last_row_id;
  await subscriptions.onRequestPost(makeContext({ db, body: { action: "mark_paid", memberId, month: "2026-02" } }));

  const personal = await readJson(await subscriptions.onRequestGet(makeContext({
    db, url: "https://test.local/api/subscriptions?member=Solo%20History&year=2026"
  })));
  assert.equal(personal.isFamilyBased, false);
  assert.equal(personal.familyName, null);
  assert.equal(personal.paidMonths.length, 1);
});

test("subscriptions: unmarking a month with no record is a 404", async () => {
  const db = freshDb();
  const res = await db.prepare("INSERT INTO members (name) VALUES ('Never Paid')").run();
  const memberId = res.meta.last_row_id;
  const unmark = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "unmark", memberId, month: "2026-05" }
  })));
  assert.equal(unmark.success, false);
});

test("subscriptions: POST rejects a missing familyId/memberId or a badly formatted month", async () => {
  const db = freshDb();
  const noTarget = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", month: "2026-05" }
  })));
  assert.equal(noTarget.success, false);

  const res = await db.prepare("INSERT INTO members (name) VALUES ('Bad Month')").run();
  const badMonth = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", memberId: res.meta.last_row_id, month: "not-a-month" }
  })));
  assert.equal(badMonth.success, false);
});

test("subscriptions: POST on a nonexistent family or member is a 404", async () => {
  const db = freshDb();
  const familyRes = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", familyId: 999999, month: "2026-05" }
  })));
  assert.equal(familyRes.success, false);

  const memberRes = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "mark_paid", memberId: 999999, month: "2026-05" }
  })));
  assert.equal(memberRes.success, false);
});

test("subscriptions: POST with an unknown action is rejected", async () => {
  const db = freshDb();
  const res = await db.prepare("INSERT INTO members (name) VALUES ('Unknown Action Test')").run();
  const result = await readJson(await subscriptions.onRequestPost(makeContext({
    db, body: { action: "nonsense", memberId: res.meta.last_row_id, month: "2026-05" }
  })));
  assert.equal(result.success, false);
  assert.match(result.message, /Unknown action/);
});

test("subscriptions: POST (marking paid/unmarking) requires manage_subscriptions permission; GET stays public", async () => {
  const db = freshDb();
  const postRes = await readJson(await subscriptions.onRequestPost(makeContext({
    db, authToken: null, body: { action: "mark_paid", memberId: 1, month: "2026-05" }
  })));
  assert.equal(postRes.success, false);

  // GET is intentionally public — the whole church should see who/which family has paid.
  const getRes = await subscriptions.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/subscriptions?month=2026-05" }));
  assert.equal(getRes.status, 200);
});
