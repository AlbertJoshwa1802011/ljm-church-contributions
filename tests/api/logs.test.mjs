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
