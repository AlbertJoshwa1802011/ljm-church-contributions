import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext, makeBadJsonContext } from "../helpers/mock-d1.mjs";
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

test("settings: rejects javascript:/data:/quote-breaking values for Watch & Listen media URLs (regression: stored XSS in v2/watch.html)", async () => {
  const db = freshDb();
  for (const key of ["sunday_live_url", "daily_prayer_url", "podcast_playlist_url"]) {
    for (const payload of [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      '"><img src=x onerror=alert(1)>',
      "not-a-url-at-all"
    ]) {
      const res = await readJson(await settings.onRequestPut(makeContext({ db, body: { key, value: payload } })));
      assert.equal(res.success, false, `${key}=${JSON.stringify(payload)} should be rejected`);
      assert.match(res.message, /http/i);
    }

    // A real https URL is still accepted.
    const ok = await readJson(await settings.onRequestPut(makeContext({
      db, body: { key, value: "https://www.youtube.com/live/abcdef123456" }
    })));
    assert.equal(ok.success, true, ok.message);
  }
});

test("settings: an empty media URL value is still accepted (clears the field)", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(makeContext({
    db, body: { key: "daily_prayer_url", value: "" }
  })));
  assert.equal(res.success, true, res.message);
});

// A caller with only manage_content (no manage_funds) — e.g. a content
// editor role, distinct from the finance/super-admin roles schema.sql
// seeds by default.
async function makeContentOnlyContext(db, opts) {
  await db.prepare("INSERT OR IGNORE INTO roles (role_name, permissions) VALUES (?, ?)")
    .bind("content_editor", JSON.stringify(["manage_content"])).run();
  await db.prepare("INSERT OR IGNORE INTO member_roles (email, role_name) VALUES (?, ?)")
    .bind("editor@example.com", "content_editor").run();
  return makeContext({
    db, authToken: "editor@example.com",
    env: { ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    ...opts
  });
}

test("settings: a manage_content-only caller can write Watch & Listen media links", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(await makeContentOnlyContext(db, {
    body: { key: "sunday_live_url", value: "https://youtube.com/watch?v=abc123" }
  })));
  assert.equal(res.success, true, res.message);

  const getResult = await readJson(await settings.onRequestGet(makeContext({ db })));
  assert.equal(getResult.settings.sunday_live_url, "https://youtube.com/watch?v=abc123");
});

test("settings: a manage_content-only caller cannot write a financial key (tech_goal_amount)", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(await makeContentOnlyContext(db, {
    body: { key: "tech_goal_amount", value: "50000" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /manage_funds/);
});

test("settings: a manage_content-only caller cannot smuggle a financial key into a batch update with content keys", async () => {
  const db = freshDb();
  const res = await readJson(await settings.onRequestPut(await makeContentOnlyContext(db, {
    body: { updates: { pastor_name: "Pastor Kumar", tech_goal_amount: "1" } }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /manage_funds/);

  // Confirm the batch was rejected atomically -- pastor_name must not have
  // been written either.
  const getResult = await readJson(await settings.onRequestGet(makeContext({ db })));
  assert.notEqual(getResult.settings.pastor_name, "Pastor Kumar");
});

test("settings: GET only returns whitelisted public keys, not every writable key", async () => {
  const db = freshDb();
  // tech_goal_amount is WRITABLE but not in PUBLIC_KEYS.
  await settings.onRequestPut(makeContext({ db, body: { key: "tech_goal_amount", value: "77777" } }));
  const getResult = await readJson(await settings.onRequestGet(makeContext({ db })));
  assert.equal(getResult.settings.tech_goal_amount, undefined, "tech_goal_amount must not leak through the public GET");
});

test("settings: malformed JSON body on PUT is a 400, not a 500", async () => {
  const db = freshDb();
  const put = await settings.onRequestPut(makeBadJsonContext({ db, method: "PUT", url: "https://test.local/api/settings" }));
  assert.equal(put.status, 400);
});
