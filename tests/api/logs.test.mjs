// Characterization tests for /api/logs — public view-event ingestion (sendBeacon)
// and the admin audit-log viewer. Locks in that ingestion never fails loudly and
// that the viewer is permission-gated behind view_audit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as logs from "../../functions/api/logs.js";

async function readJson(res) { return JSON.parse(await res.text()); }

test("logs: POST ingests a page-view event and returns 204", async () => {
  const db = freshDb();
  const ctx = {
    env: { DB: db },
    request: {
      url: "https://test.local/api/logs",
      json: async () => ({ path: "/", event: "view.page" }),
      headers: { get: () => "" }
    }
  };
  const res = await logs.onRequestPost(ctx);
  assert.equal(res.status, 204);
  const row = await db.prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE action='view.page'").first();
  assert.equal(row.n, 1);
});

test("logs: GET audit viewer requires view_audit permission", async () => {
  const db = freshDb();
  const res = await readJson(await logs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/logs"
  })));
  assert.equal(res.success, false);
});

test("logs: GET returns audit rows for an authorized admin", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO activity_logs (action, actor_type) VALUES ('fund.create','admin')").run();
  const res = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs" })));
  assert.equal(res.success, true);
  assert.ok(res.total >= 1);
  assert.ok(Array.isArray(res.logs));
});

test("logs: POST with a verified Google JWT resolves the actor and classifies admin vs member", async () => {
  const db = freshDb();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("tokeninfo")) return { ok: true, json: async () => ({ email: "albertjoshrock101@gmail.com" }) };
    return realFetch(url);
  };
  try {
    const ctx = {
      env: { DB: db },
      request: {
        url: "https://test.local/api/logs",
        json: async () => ({ path: "/admin", event: "view.page", token: "aaa.bbb.ccc" }),
        headers: { get: () => "1.2.3.4" }
      }
    };
    await logs.onRequestPost(ctx);
    const row = await db.prepare("SELECT actor_email, actor_type, verified FROM activity_logs WHERE entity_id='/admin'").first();
    assert.equal(row.actor_email, "albertjoshrock101@gmail.com");
    assert.equal(row.actor_type, "admin", "a super-admin email should classify as admin");
    assert.equal(row.verified, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("logs: POST dedupes an identical view from the same IP within 10 seconds", async () => {
  const db = freshDb();
  const ctx = {
    env: { DB: db },
    request: {
      url: "https://test.local/api/logs",
      json: async () => ({ path: "/dedupe-test", event: "view.page" }),
      headers: { get: () => "9.9.9.9" }
    }
  };
  await logs.onRequestPost(ctx);
  await logs.onRequestPost(ctx);
  const row = await db.prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE entity_id='/dedupe-test'").first();
  assert.equal(row.n, 1, "the second identical view within 10s should not create a new row");
});

test("logs: POST tolerates a malformed/empty JSON body (sendBeacon can send nothing)", async () => {
  const db = freshDb();
  const ctx = {
    env: { DB: db },
    request: {
      url: "https://test.local/api/logs",
      json: async () => { throw new Error("Unexpected end of JSON input"); },
      headers: { get: () => "" }
    }
  };
  const res = await logs.onRequestPost(ctx);
  assert.equal(res.status, 204, "ingestion must never fail loudly, even on a bad body");
});

test("logs: GET supports actor/action/actorType/from/to filters", async () => {
  const db = freshDb();
  await db.prepare("INSERT INTO activity_logs (action, actor_email, actor_type, created_at) VALUES ('fund.create','admin1@x.com','admin','2026-01-05 10:00:00')").run();
  await db.prepare("INSERT INTO activity_logs (action, actor_email, actor_type, created_at) VALUES ('member.add','admin2@x.com','admin','2026-02-05 10:00:00')").run();
  await db.prepare("INSERT INTO activity_logs (action, actor_email, actor_type, created_at) VALUES ('view.page','','anonymous','2026-03-05 10:00:00')").run();

  const byActor = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?actor=admin1" })));
  assert.equal(byActor.logs.length, 1);
  assert.equal(byActor.logs[0].actorEmail, "admin1@x.com");

  const byAction = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?action=fund" })));
  assert.ok(byAction.logs.every(l => l.action.startsWith("fund")));

  const byType = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?actorType=anonymous" })));
  assert.ok(byType.logs.every(l => l.actorType === "anonymous"));

  const byDateRange = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?from=2026-02-01&to=2026-02-28" })));
  assert.ok(byDateRange.logs.every(l => l.action === "member.add"));
});

test("logs: GET paginates with limit/offset, clamped to 100", async () => {
  const db = freshDb();
  for (let i = 0; i < 5; i++) {
    await db.prepare("INSERT INTO activity_logs (action, actor_type) VALUES ('paginate.test','admin')").run();
  }
  const page1 = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?limit=2&offset=0" })));
  assert.equal(page1.logs.length, 2);
  assert.equal(page1.limit, 2);

  const clamped = await readJson(await logs.onRequestGet(makeContext({ db, url: "https://test.local/api/logs?limit=500" })));
  assert.equal(clamped.limit, 100, "limit should be clamped to 100 even if a caller asks for more");
});
