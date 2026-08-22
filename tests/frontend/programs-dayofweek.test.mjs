// Regression test for a real bug found in the LJM V2 journey-breaker session:
// v2/programs.html used to render `DAYS[p.dayOfWeek].slice(0, 3)` client-side
// with no bounds check. functions/api/programs.js stored `dayOfWeek` with no
// validation, so an out-of-range value (7, 99, -1, a non-numeric string)
// reached the render loop and threw a TypeError inside an un-guarded
// `.map()` callback — the exact "undefined functions fail silently" failure
// class documented in CLAUDE.md, except here it blanked the *entire* public
// programs list (every church's schedule, not just one row) because the
// throw happened inside the single `.then()` that builds all of
// `#programsWrap`'s innerHTML.
//
// The write-side fix (functions/api/programs.js's validateProgramBody)
// now rejects an out-of-range dayOfWeek/monthOrdinal before it can ever be
// stored. But the day-name lookup itself moved server-side too (toProgram's
// scheduleLabelEn/Ta, computed by buildScheduleLabel on every GET) and
// v2/programs.html no longer indexes into any DAYS array at all — it just
// renders the precomputed string. So the regression this test guards against
// now belongs on the read side: a pre-existing row with an out-of-range
// day_of_week (e.g. from before the write-side validation existed, or
// written directly to D1) must not make GET /api/programs?all=1 throw and
// blank the whole admin/public listing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as programs from "../../functions/api/programs.js";

async function readJson(res) { return JSON.parse(await res.text()); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

test("v2/programs.html: no longer indexes a client-side DAYS array (day-name lookup moved server-side)", () => {
  const source = readFileSync(path.join(REPO_ROOT, "v2", "programs.html"), "utf8");
  assert.doesNotMatch(source, /DAYS\[/, "day-name lookup should be server-computed (scheduleLabelEn/Ta), not indexed client-side");
  assert.match(source, /scheduleLabelEn|scheduleLabelTa/, "expected the renderer to consume the server-computed schedule label");
});

test("programs: an out-of-range/invalid day_of_week already in the database does not throw when listing (regression)", async () => {
  const db = freshDb();

  // Simulate a pre-existing row with bad data (e.g. written before the
  // write-side dayOfWeek validation existed, or inserted directly).
  for (const bad of [7, 99, -1]) {
    await db.prepare(
      `INSERT INTO programs (title_en, recurrence, day_of_week, status, sort_order) VALUES (?, 'weekly', ?, 'active', 0)`
    ).bind(`Bad Program ${bad}`, bad).run();
  }

  await assert.doesNotReject(
    async () => {
      const res = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
      assert.equal(res.success, true);
      // The malformed rows must still be present and readable, not dropped.
      for (const bad of [7, 99, -1]) {
        const row = res.programs.find((p) => p.titleEn === `Bad Program ${bad}`);
        assert.ok(row, `expected Bad Program ${bad} to be listed`);
      }
    },
    "an out-of-range day_of_week should not throw and crash the whole programs list"
  );
});
