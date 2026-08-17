// Validates migrations/0025_v2_launch_content_seed.sql — the initial-content
// seed for the v2 public site launch (promises/testimonies/programs/blog/
// churches/VBS 2026). This is deliberately NOT mirrored into schema.sql (see
// that migration's header comment): it seeds real calendar dates for
// "today's promise", which would collide with tests/api/promises.test.mjs's
// own dynamic "today" fixtures if it were part of the shared base fixture.
// Instead this test applies it directly, against its own isolated DB, and
// checks it runs cleanly, is idempotent, and produces the expected rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { freshDb } from "../helpers/mock-d1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SEED_SQL = readFileSync(path.join(REPO_ROOT, "migrations", "0025_v2_launch_content_seed.sql"), "utf8");

function seededDb() {
  const db = freshDb();
  db._sqlite.exec(SEED_SQL);
  return db;
}

test("seed migration: applies cleanly against the base schema", () => {
  assert.doesNotThrow(() => seededDb());
});

test("seed migration: is idempotent — applying twice does not duplicate rows", () => {
  const db = seededDb();
  db._sqlite.exec(SEED_SQL);
  const counts = {
    promises: db._sqlite.prepare("SELECT COUNT(*) AS n FROM promises WHERE created_by='seed:v2-launch-2026'").get().n,
    testimonies: db._sqlite.prepare("SELECT COUNT(*) AS n FROM testimonies WHERE reviewed_by='seed:v2-launch-2026'").get().n,
    blog: db._sqlite.prepare("SELECT COUNT(*) AS n FROM blog_posts").get().n,
    events: db._sqlite.prepare("SELECT COUNT(*) AS n FROM events WHERE title LIKE 'Vacation Bible School (VBS) 2026%'").get().n
  };
  assert.equal(counts.promises, 24); // 21 daily + 2 monthly + 1 yearly
  assert.equal(counts.testimonies, 4);
  assert.equal(counts.blog, 5);
  assert.equal(counts.events, 1);
});

test("seed migration: promises span daily/monthly/yearly and carry real KJV text", () => {
  const db = seededDb();
  const daily = db._sqlite.prepare("SELECT * FROM promises WHERE scope='daily' AND on_date='2026-08-16'").get();
  assert.ok(daily);
  assert.equal(daily.reference, "Psalms 91:1");
  assert.match(daily.text_en, /secret place of the most High/);
  assert.equal(daily.created_by, "seed:v2-launch-2026");

  const monthly = db._sqlite.prepare("SELECT * FROM promises WHERE scope='monthly' AND month=8 AND year=2026").get();
  assert.ok(monthly);

  const yearly = db._sqlite.prepare("SELECT * FROM promises WHERE scope='yearly' AND year=2026").get();
  assert.ok(yearly);
});

test("seed migration: testimonies are clearly marked as sample content, one left pending for moderation", () => {
  const db = seededDb();
  const rows = db._sqlite.prepare("SELECT * FROM testimonies WHERE reviewed_by='seed:v2-launch-2026'").all();
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.match(row.author_name, /\(sample testimony/);
  }
  const pending = rows.filter((r) => r.status === "pending");
  const published = rows.filter((r) => r.status === "published");
  assert.equal(pending.length, 1);
  assert.equal(published.length, 3);
});

test("seed migration: blog posts include exactly one draft (publish-flow demo) and the rest published", () => {
  const db = seededDb();
  const draft = db._sqlite.prepare("SELECT COUNT(*) AS n FROM blog_posts WHERE status='draft'").get().n;
  const published = db._sqlite.prepare("SELECT COUNT(*) AS n FROM blog_posts WHERE status='published'").get().n;
  assert.equal(draft, 1);
  assert.equal(published, 4);
});

test("seed migration: churches keep an existing address untouched, only fills in a real gap", () => {
  const db = freshDb();
  db._sqlite.exec(
    "UPDATE churches SET address_en = 'Real address already on file' WHERE slug = 'church-of-light'"
  );
  db._sqlite.exec(SEED_SQL);
  const row = db._sqlite.prepare("SELECT address_en FROM churches WHERE slug='church-of-light'").get();
  assert.equal(row.address_en, "Real address already on file");

  const other = db._sqlite.prepare("SELECT address_en FROM churches WHERE slug='city-worship-center'").get();
  assert.match(other.address_en, /coming soon/);
});

test("seed migration: VBS 2026 event is published, featured, and honest about the unknown month/year", () => {
  const db = seededDb();
  const row = db._sqlite.prepare("SELECT * FROM events WHERE title LIKE 'Vacation Bible School (VBS) 2026%'").get();
  assert.ok(row);
  assert.equal(row.status, "published");
  assert.equal(row.featured, 1);
  assert.match(row.location, /Church of Light/);
  assert.match(row.event_date, /to be confirmed/);
  assert.match(row.description, /Journey With Jesus/);
  assert.equal(row.cover_photo, null);
});
