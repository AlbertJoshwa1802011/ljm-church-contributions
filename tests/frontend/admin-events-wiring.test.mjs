// Structural tests for the restored Events admin section.
//
// The Events UI was deleted from admin.html by the global-search PR and the
// public v2 Events page kept fetching /api/events with nothing for a pastor
// to publish. These tests lock the restore: helpers defined, ids in markup,
// wired at init, and saveEvent posts churchId so v2 church scoping works.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

const EVENT_FUNCTIONS = [
  "compressImage",
  "addExtraRow",
  "renderExtraRows",
  "collectExtra",
  "renderEventPhotoPreviews",
  "loadEvents",
  "fetchEvents",
  "editEvent",
  "deleteEvent",
  "clearEventForm",
  "saveEvent"
];

const EVENT_ELEMENT_IDS = [
  "section-events",
  "ev_formTitle",
  "ev_title",
  "ev_category",
  "ev_date",
  "ev_location",
  "ev_churchId",
  "ev_status",
  "ev_featured",
  "ev_description",
  "ev_extraRows",
  "ev_addExtraBtn",
  "ev_coverFile",
  "ev_coverPreviewContainer",
  "ev_coverPreview",
  "ev_photoFiles",
  "ev_photoPreviews",
  "ev_saveBtn",
  "ev_clearBtn",
  "ev_msg",
  "ev_count",
  "ev_table",
  "ev_tbody"
];

function isFunctionDefined(source, name) {
  const declaredFn = new RegExp(`function\\s+${name}\\s*\\(`);
  const assignedFn = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  return declaredFn.test(source) || assignedFn.test(source);
}

test("events admin: every helper is actually defined", () => {
  const missing = EVENT_FUNCTIONS.filter((name) => !isFunctionDefined(adminSource, name));
  assert.deepEqual(missing, [], `Events functions referenced but never defined: ${missing.join(", ")}`);
});

test("events admin: every element id the JS touches exists in the markup", () => {
  const missing = EVENT_ELEMENT_IDS.filter((id) => !adminSource.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `Events ids absent from admin.html markup: ${missing.join(", ")}`);
});

test("events admin: save/clear/extra/photo controls are wired at init", () => {
  assert.match(adminSource, /\$\("ev_saveBtn"\)\.onclick = saveEvent/);
  assert.match(adminSource, /\$\("ev_clearBtn"\)\.onclick = clearEventForm/);
  assert.match(adminSource, /\$\("ev_addExtraBtn"\)\.onclick/);
  assert.match(adminSource, /\$\("ev_coverFile"\)\.onchange/);
  assert.match(adminSource, /\$\("ev_photoFiles"\)\.onchange/);
});

test("events admin: events wiring is try/catch isolated so a missing id cannot abort later pages", () => {
  assert.match(
    adminSource,
    /try \{[\s\S]*?\$\("ev_saveBtn"\)\.onclick = saveEvent[\s\S]*?\} catch \(e\) \{ console\.error\("events wiring failed:/
  );
});

test("events admin: LOADERS.events calls loadEvents, which fetches /api/events?all=1", () => {
  assert.match(adminSource, /events:\s*loadEvents/);
  assert.match(adminSource, /api\("\/api\/events\?all=1/);
  assert.match(adminSource, /api\("\/api\/events", \{ method: "POST"/);
  assert.match(adminSource, /api\("\/api\/events", \{ method: "PUT"/);
  assert.match(adminSource, /method: "DELETE"/);
});

test("events admin: saveEvent includes churchId so v2 church-scoped listings work", () => {
  assert.match(adminSource, /churchId:\s*\$\("ev_churchId"\)\.value/);
  assert.match(adminSource, /id="ev_churchId"/);
});

test("events admin: published vs draft is a form field (drafts must not leak to v2)", () => {
  assert.match(adminSource, /id="ev_status"[^>]*>[\s\S]*?<option value="draft"/);
  assert.match(adminSource, /id="ev_status"[^>]*>[\s\S]*?<option value="published"/);
});
