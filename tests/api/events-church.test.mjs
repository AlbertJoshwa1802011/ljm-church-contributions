// Additive coverage for the church_id/beneficiary extension to /api/events
// (migration 0021). See tests/api/events.test.mjs for the original coverage
// this must not regress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as events from "../../functions/api/events.js";
import * as churches from "../../functions/api/churches.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("events: church-less events remain ministry-wide (churchId null) — existing behavior unchanged", async () => {
  const db = freshDb();
  await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events", body: { title: "General Outreach", status: "published" }
  }));
  const res = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/events" })));
  assert.equal(res.events.length, 1);
  assert.equal(res.events[0].churchId, null);
});

test("events: ?church= filters published events by church slug; beneficiary fields round-trip", async () => {
  const db = freshDb();
  const churchList = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const city = churchList.churches.find(c => c.slug === "city-worship-center").id;

  const create = await readJson(await events.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/events",
    body: { title: "Food Drive", status: "published", churchId: city, beneficiariesCount: 42, goodDeedSummaryEn: "Fed 42 families" }
  })));

  const filtered = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/events?church=city-worship-center" })));
  assert.equal(filtered.events.length, 1);
  assert.equal(filtered.events[0].beneficiariesCount, 42);
  assert.equal(filtered.events[0].goodDeedSummaryEn, "Fed 42 families");

  const otherChurch = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/events?church=church-of-light" })));
  assert.equal(otherChurch.events.length, 0);

  const detail = await readJson(await events.onRequestGet(makeContext({ db, authToken: null, url: `https://test.local/api/events?id=${create.id}` })));
  assert.equal(detail.event.churchSlug, "city-worship-center");
});
