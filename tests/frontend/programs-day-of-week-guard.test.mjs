// Regression test for a real crash found during adversarial QA: a program
// row with an out-of-range dayOfWeek (sent straight to POST /api/programs,
// bypassing the admin console's 0-6 <select>) made v2/programs.html do
// `DAYS[p.dayOfWeek].slice(0, 3)` with DAYS[99] === undefined, throwing
// inside the render and turning the ENTIRE public programs page — every
// church's schedule, not just the bad row — into "Couldn't load programs
// right now". functions/api/programs.js now rejects out-of-range values on
// write (see tests/api/programs.test.mjs), but this guard covers rows that
// predate that fix or were written directly to D1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "programs.html"), "utf8");

test("v2/programs.html: DAYS[p.dayOfWeek] is guarded before .slice() is called on it", () => {
  const match = source.match(/var when = ([^;]+);/);
  assert.ok(match, "expected the `when` line that reads DAYS[p.dayOfWeek] in the program list renderer");
  const expr = match[1];
  assert.match(expr, /DAYS\[p\.dayOfWeek\]\s*\?/,
    "DAYS[p.dayOfWeek] must be checked truthy before .slice() is called on it, so an out-of-range value falls through to the recurrence/em-dash fallback instead of throwing");
});
