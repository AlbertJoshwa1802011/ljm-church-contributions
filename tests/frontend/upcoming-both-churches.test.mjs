// Regression test for a real user-reported bug: a program added through the
// Admin Console's Programs tab never appeared in the V2 home page's
// "Upcoming at both churches" section. Root cause: v2/index.html's
// #eventsGrid script only ever fetched /api/events — it never fetched
// /api/programs at all, so a recurring service program (which has no
// standalone "event" row) could never show there no matter how it was
// configured. The fix makes that script fetch both endpoints and merge
// dated events with the next computed occurrence of each active recurring
// program (day-of-week + start time, evaluated in IST since LJM's admin UI
// and public site both use plain local/IST times with no timezone field).
//
// This test runs the actual merge script extracted from v2/index.html in a
// sandboxed VM (this repo has no build step/bundler and no jsdom harness —
// see tests/frontend/analytics-charts.test.mjs for the same static-source
// pattern), with fetch/document stubbed and a fixed IST "now", to prove:
//   - a newly added program actually renders on the dashboard,
//   - programs from both churches can appear together,
//   - a program with no day-of-week (can't be placed on a calendar) and a
//     past-dated event are both correctly excluded as "not upcoming".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const html = readFileSync(path.join(REPO_ROOT, "v2", "index.html"), "utf8");

function extractHappeningScript(source) {
  const blocks = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const block = blocks.find(b => b.includes("DAY_ABBR") && b.includes("eventsGrid"));
  assert.ok(block, "Expected to find the 'Upcoming at both churches' (#eventsGrid) script in v2/index.html");
  return block;
}

const happeningScript = extractHappeningScript(html);

test("home page 'Upcoming at both churches' fetches both /api/events and /api/programs", () => {
  assert.match(happeningScript, /fetch\(\s*"\/api\/events/, "should still fetch events");
  assert.match(happeningScript, /fetch\(\s*"\/api\/programs/, "should also fetch programs — this is the fix for the reported bug");
});

// IST 08:00, Sunday 23 Aug 2026 — fixed so the test is deterministic regardless
// of when it actually runs. Date.now() is offset by -5:30h so the script's own
// istNow() (which adds +5:30h back) lands exactly on this instant.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NOW_IST_EPOCH = Date.UTC(2026, 7, 23, 8, 0);
const FIXED_DATE_NOW = NOW_IST_EPOCH - IST_OFFSET_MS;

function runHappeningScript({ events, programs }) {
  const grid = { innerHTML: "" };
  const sandbox = {
    document: { getElementById: (id) => (id === "eventsGrid" ? grid : null) },
    fetch: (url) => {
      const body = String(url).indexOf("/api/programs") !== -1 ? { programs } : { events };
      return Promise.resolve({ json: () => Promise.resolve(body) });
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`Date.now = function () { return ${FIXED_DATE_NOW}; };`, sandbox);
  vm.runInContext(happeningScript, sandbox, { filename: "v2/index.html#happening" });
  return grid;
}

async function flushMicrotasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test("a newly added weekly program renders on the dashboard, alongside a program from the other church", async () => {
  const events = [];
  const programs = [
    // Sunday 09:00 — today, still ahead of the fixed 08:00 "now" → next occurrence is today.
    { id: 1, titleEn: "Sunday Service", descriptionEn: "Main worship service", dayOfWeek: 0, startTime: "09:00", churchNameEn: "Church of Light", status: "active" },
    // Tuesday 18:00 at the OTHER church.
    { id: 2, titleEn: "Tuesday Prayer", descriptionEn: "Midweek prayer meeting", dayOfWeek: 2, startTime: "18:00", churchNameEn: "City Worship Center", status: "active" }
  ];

  const grid = runHappeningScript({ events, programs });
  await flushMicrotasks();

  assert.match(grid.innerHTML, /Sunday Service/, "the newly added program must appear on the dashboard");
  assert.match(grid.innerHTML, /Tuesday Prayer/, "a program at the second church must also appear");
  assert.match(grid.innerHTML, /Church of Light/, "the program's church should be shown");
  assert.match(grid.innerHTML, /City Worship Center/, "both churches must be represented, not just one");
});

test("a past-dated event and a program with no day-of-week are correctly excluded from 'upcoming'", async () => {
  const events = [
    { id: 1, title: "Old Fete", description: "already happened", eventDate: "2026-08-20", churchNameEn: "Church of Light" },
    { id: 2, title: "Youth Rally", description: "still ahead", eventDate: "2026-08-30", churchNameEn: "City Worship Center" }
  ];
  const programs = [
    // No dayOfWeek — a one-off/other program has no date to place it by.
    { id: 3, titleEn: "Special One-off", descriptionEn: "no fixed day", dayOfWeek: null, startTime: null, churchNameEn: null, status: "active" }
  ];

  const grid = runHappeningScript({ events, programs });
  await flushMicrotasks();

  assert.match(grid.innerHTML, /Youth Rally/, "a future-dated event should still appear");
  assert.doesNotMatch(grid.innerHTML, /Old Fete/, "a past event should not appear under 'upcoming'");
  assert.doesNotMatch(grid.innerHTML, /Special One-off/, "a program with no computable date should not appear here (it still shows on the full Programs page)");
});

test("nextProgramOccurrence rolls a same-day program to next week once its start time has passed", async () => {
  const events = [];
  const programs = [
    // Sunday 07:00 — earlier than the fixed 08:00 "now" → already started, roll to next Sunday (30 Aug).
    { id: 4, titleEn: "Early Sunrise Service", descriptionEn: "d", dayOfWeek: 0, startTime: "07:00", churchNameEn: "Church of Light", status: "active" },
    { id: 5, titleEn: "Late Sunday Service", descriptionEn: "d", dayOfWeek: 0, startTime: "18:00", churchNameEn: "Church of Light", status: "active" }
  ];

  const grid = runHappeningScript({ events, programs });
  await flushMicrotasks();

  assert.match(grid.innerHTML, /Late Sunday Service/, "a program later today should still be upcoming");
  assert.match(grid.innerHTML, /Early Sunrise Service/, "a program whose time already passed today should roll to its next weekly occurrence, not disappear");
});
