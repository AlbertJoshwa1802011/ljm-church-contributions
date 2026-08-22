// Regression test for a real bug found in the LJM V2 journey-breaker session:
// v2/programs.html rendered `DAYS[p.dayOfWeek].slice(0, 3)` with no bounds
// check. functions/api/programs.js stored `dayOfWeek` with no validation, so
// an out-of-range value (7, 99, -1, a non-numeric string) reached the render
// loop and threw a TypeError inside an un-guarded `.map()` callback — the
// exact "undefined functions fail silently" failure class documented in
// CLAUDE.md, except here it blanked the *entire* public programs list (every
// church's schedule, not just one row) because the throw happened inside the
// single `.then()` that builds all of `#programsWrap`'s innerHTML.
//
// This test statically extracts the DAYS array and the day-name/cadence
// computation from v2/programs.html and actually executes it (not just
// structural regex matching) against the exact hostile inputs CLAUDE.md's
// milestone brief calls out, asserting it never throws and degrades to a
// safe fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "programs.html"), "utf8");

test("v2/programs.html: DAYS array and day-name/cadence computation are present", () => {
  assert.match(source, /var DAYS = \[[^\]]+\];/, "Expected the DAYS weekday-name array in v2/programs.html");
  assert.match(source, /var dayName = [^\n]+;\s*\n\s*var day = [^\n]+;/, "Expected the dayName/day computation in renderList()");
  assert.match(source, /var when;\s*\n\s*if \(p\.recurrence/, "Expected the cadence-aware `when` computation in renderList()");
});

test("v2/programs.html: an out-of-range/invalid dayOfWeek does not throw when computing the display label (regression)", () => {
  const daysMatch = source.match(/var DAYS = (\[[^\]]+\]);/);
  const bodyMatch = source.match(/var dayName = [^\n]+;\s*\n\s*var day = [^\n]+;[\s\S]*?\n\s*else when = day \|\| 'Weekly';/);
  assert.ok(daysMatch && bodyMatch, "Could not locate the day-name/cadence computation to test — has v2/programs.html's renderList() changed shape?");

  const DAYS = new Function(`return ${daysMatch[1]}`)();
  const computeWhen = new Function("p", "DAYS", `
    ${bodyMatch[0]}
    return when;
  `);

  for (const bad of [7, 99, -1, "not-a-number", NaN, "7"]) {
    assert.doesNotThrow(
      () => computeWhen({ dayOfWeek: bad, recurrence: "weekly" }, DAYS),
      `dayOfWeek=${JSON.stringify(bad)} should not throw and crash the whole programs list`
    );
  }

  // Valid weekdays still render their real 3-letter name.
  assert.equal(computeWhen({ dayOfWeek: 0, recurrence: "weekly" }, DAYS), "Sun");
  assert.equal(computeWhen({ dayOfWeek: 6, recurrence: "weekly" }, DAYS), "Sat");
  // null/undefined (one-off/other programs) still fall back correctly.
  assert.equal(computeWhen({ dayOfWeek: null, recurrence: "once" }, DAYS), "One-off");
  // An out-of-range dayOfWeek degrades to a safe cadence-only label instead of throwing.
  assert.equal(computeWhen({ dayOfWeek: 99, recurrence: "weekly" }, DAYS), "Weekly");
  assert.equal(computeWhen({ dayOfWeek: "not-a-number", recurrence: "monthly" }, DAYS), "Monthly");
});
