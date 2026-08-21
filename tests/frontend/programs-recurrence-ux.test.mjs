// migrations/0020_programs.sql defines programs.recurrence as free TEXT
// ('weekly' | 'monthly' | 'once', default 'weekly') specifically so a program
// like "Full Night Prayer — 2nd Friday" can be told apart from a plain weekly
// Friday program. But the admin "Add a program" form had no field for it at
// all, so saveProgram() never sent `recurrence` and every program silently
// saved as the "weekly" default — an admin had no way to mark a program
// monthly or daily. Separately, the public v2/programs.html card only ever
// rendered the bare day-of-week abbreviation ("Fri"), so even a correctly
// stored monthly/daily program would render visually identical to a weekly
// one — the exact "weekly vs monthly must be obvious" failure this repo's
// milestone brief calls out for the Programs page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");
const publicSource = readFileSync(path.join(REPO_ROOT, "v2", "programs.html"), "utf8");

test("admin.html: the Add-a-program form has a Recurrence field", () => {
  assert.match(adminSource, /id="pg_recurrence"/);
  assert.match(adminSource, /<option value="monthly"/);
  assert.match(adminSource, /<option value="daily"/);
});

test("admin.html: saveProgram() actually sends the chosen recurrence to the API", () => {
  const start = adminSource.indexOf("function saveProgram(");
  assert.notEqual(start, -1, "saveProgram() must exist");
  const end = adminSource.indexOf("\n        }", start);
  const body = adminSource.slice(start, end);
  assert.match(body, /recurrence:\s*\$\("pg_recurrence"\)\.value/,
    "saveProgram() must read #pg_recurrence, not silently default every program to weekly");
});

test("v2/programs.html: daily, weekly, monthly and one-off programs render distinguishable labels", () => {
  const start = publicSource.indexOf("function renderList(");
  assert.notEqual(start, -1, "renderList() must exist");
  const end = publicSource.indexOf("\n      }", start);
  const body = publicSource.slice(start, end);
  assert.match(body, /recurrence\s*===\s*'daily'/, "a daily program must not render like a weekly one");
  assert.match(body, /recurrence\s*===\s*'monthly'/, "a monthly program must not render like a weekly one");
  assert.match(body, /recurrence\s*===\s*'once'/, "a one-off program must stay distinguishable");
});
