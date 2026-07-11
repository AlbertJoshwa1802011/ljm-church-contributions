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
