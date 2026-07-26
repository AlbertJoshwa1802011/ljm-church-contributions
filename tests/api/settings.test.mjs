import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as settings from "../../functions/api/settings.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("settings: about_content round-trips through PUT and GET", async () => {
  const db = freshDb();
  const aboutContent = JSON.stringify({ heroTitle: "Welcome", missionCards: [{ icon: "⛪", title: "Mission", body: "Body text" }] });

  const putRes = await settings.onRequestPut(makeContext({
    db, body: { key: "about_content", value: aboutContent }
  }));
  const putResult = await readJson(putRes);
  assert.equal(putResult.success, true, putResult.message);

  const getRes = await settings.onRequestGet(makeContext({ db }));
  const getResult = await readJson(getRes);
  assert.equal(getResult.settings.about_content, aboutContent);
  assert.deepEqual(JSON.parse(getResult.settings.about_content).heroTitle, "Welcome");
});

test("settings: rejects malformed JSON for about_content", async () => {
  const db = freshDb();
  const res = await settings.onRequestPut(makeContext({
    db, body: { key: "about_content", value: "{not valid json" }
  }));
  const result = await readJson(res);
  assert.equal(result.success, false);
  assert.match(result.message, /valid JSON/);
});

test("settings: rejects an unknown/non-whitelisted key", async () => {
  const db = freshDb();
  const res = await settings.onRequestPut(makeContext({
    db, body: { key: "some_random_key", value: "x" }
  }));
  const result = await readJson(res);
  assert.equal(result.success, false);
  assert.match(result.message, /not writable/);
});

test("settings: rejects an invalid pastor_email", async () => {
  const db = freshDb();
  const res = await settings.onRequestPut(makeContext({
    db, body: { key: "pastor_email", value: "not-an-email" }
  }));
  const result = await readJson(res);
  assert.equal(result.success, false);
  assert.match(result.message, /valid email/);
});

test("settings: batch update saves multiple keys in one request", async () => {
  const db = freshDb();
  const res = await settings.onRequestPut(makeContext({
    db, body: { updates: { pastor_name: "Pastor Kumar", pastor_phone: "9876543210" } }
  }));
  assert.equal((await readJson(res)).success, true);

  const getResult = await readJson(await settings.onRequestGet(makeContext({ db })));
  assert.equal(getResult.settings.pastor_name, "Pastor Kumar");
  assert.equal(getResult.settings.pastor_phone, "9876543210");
});

test("settings: PUT requires manage_funds permission", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(makeContext({
    db, authToken: null, body: { key: "pastor_name", value: "Anyone" }
  })));
  assert.equal(res.success, false);
});

test("settings: force_login must be exactly 'true' or 'false'", async () => {
  const db = freshDb();
  const bad = await readJson(await settings.onRequestPut(makeContext({
    db, body: { key: "force_login", value: "yes" }
  })));
  assert.equal(bad.success, false);
  assert.match(bad.message, /force_login/);

  const good = await readJson(await settings.onRequestPut(makeContext({
    db, body: { key: "force_login", value: "true" }
  })));
  assert.equal(good.success, true, good.message);
});

test("settings: writing tech_goal_amount/christmas_goal_amount syncs the funds table", async () => {
  const db = freshDb();
  await settings.onRequestPut(makeContext({ db, body: { key: "tech_goal_amount", value: "99999" } }));
  const techFund = await db.prepare("SELECT goal_amount FROM funds WHERE slug='tech-contributions'").first();
  assert.equal(techFund.goal_amount, 99999);

  await settings.onRequestPut(makeContext({ db, body: { key: "christmas_goal_amount", value: "12345" } }));
  const xmasFund = await db.prepare("SELECT goal_amount FROM funds WHERE slug='christmas-fund'").first();
  assert.equal(xmasFund.goal_amount, 12345);
});

test("settings: rejects a value exceeding the max length for its key", async () => {
  const db = freshDb();
  const tooLong = "x".repeat(1001); // default MAX_VALUE_LEN is 1000
  const res = await readJson(await settings.onRequestPut(makeContext({
    db, body: { key: "pastor_name", value: tooLong }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /exceeds/);

  // about_content has a much larger allowance (20000) — the same length must be accepted there.
  const aboutOk = await readJson(await settings.onRequestPut(makeContext({
    db, body: { key: "about_content", value: JSON.stringify({ blob: "x".repeat(1500) }) }
  })));
  assert.equal(aboutOk.success, true, aboutOk.message);
});

test("settings: PUT with an empty updates object is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(makeContext({ db, body: { updates: {} } })));
  assert.equal(res.success, false);
  assert.match(res.message, /No updates/);
});

test("settings: GET only returns whitelisted public keys, not every writable key", async () => {
  const db = freshDb();
  // tech_goal_amount is WRITABLE but not in PUBLIC_KEYS.
  await settings.onRequestPut(makeContext({ db, body: { key: "tech_goal_amount", value: "77777" } }));
  const getResult = await readJson(await settings.onRequestGet(makeContext({ db })));
  assert.equal(getResult.settings.tech_goal_amount, undefined, "tech_goal_amount must not leak through the public GET");
});
