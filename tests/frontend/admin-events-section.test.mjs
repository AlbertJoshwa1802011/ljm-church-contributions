// Regression test for a real production defect: commit 1bfb6dd ("Add
// native-feeling global search to the admin console") accidentally deleted
// the entire Events admin section — the whole <div id="section-events"> form
// (create/edit/delete, drafts vs published, featured, cover photo, multi-photo
// upload with per-photo captions), its nav entry, its "manage_events" role
// checkbox, and every eventXxx helper function — as unrelated collateral
// damage. functions/api/events.js (the backend) was never touched and still
// requires "manage_events" on every write, but from that commit onward there
// was literally no UI in admin.html to create, edit, delete, or photograph an
// event, or to grant a non-super-admin the permission to do so. EVENTS_PENDING.md
// still claimed this was "✅ Already shipped" the whole time.
//
// admin.html has no build step — no bundler, no linter, no TypeScript — so a
// missing element id or an undefined function is invisible until a real admin
// clicks the control and their browser throws (see CLAUDE.md's "Known
// pitfall"). These tests parse admin.html as text (no jsdom in this suite)
// and assert the wiring a ReferenceError / missing-element bug would violate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

function isFunctionDefined(source, name) {
  return new RegExp(`function ${name}\\s*\\(`).test(source);
}

test("admin.html: the Events section markup exists with its full form and table", () => {
  assert.match(adminSource, /<div class="section" id="section-events">/);
  for (const id of [
    "ev_formTitle", "ev_title", "ev_category", "ev_date", "ev_location",
    "ev_status", "ev_featured", "ev_description", "ev_extraRows", "ev_addExtraBtn",
    "ev_coverFile", "ev_coverPreviewContainer", "ev_coverPreview",
    "ev_photoFiles", "ev_photoPreviews", "ev_saveBtn", "ev_clearBtn", "ev_msg",
    "ev_count", "ev_table", "ev_tbody"
  ]) {
    assert.match(adminSource, new RegExp(`id="${id}"`), `admin.html must have an element with id="${id}"`);
  }
});

test("admin.html: the Events nav item is reachable from the Ministry group", () => {
  assert.match(adminSource, /\["events",\s*"[^"]*",\s*"Events"\]/);
});

test("admin.html: every function the Events section calls is actually defined", () => {
  const EVENTS_FUNCTIONS = [
    "compressImage", "addExtraRow", "renderExtraRows", "collectExtra",
    "renderEventPhotoPreviews", "loadEvents", "fetchEvents", "editEvent",
    "deleteEvent", "clearEventForm", "saveEvent"
  ];
  for (const fn of EVENTS_FUNCTIONS) {
    assert.ok(isFunctionDefined(adminSource, fn), `${fn}() must be defined in admin.html`);
  }
});

test("admin.html: opening the Events section loads it (wired into LOADERS)", () => {
  assert.match(adminSource, /LOADERS\s*=\s*\{[\s\S]*?\bevents:\s*loadEvents\b[\s\S]*?\}/);
});

test("admin.html: the Events form buttons/inputs are wired to their handlers", () => {
  assert.match(adminSource, /\$\("ev_saveBtn"\)\.onclick\s*=\s*saveEvent/);
  assert.match(adminSource, /\$\("ev_clearBtn"\)\.onclick\s*=\s*clearEventForm/);
  assert.match(adminSource, /\$\("ev_addExtraBtn"\)\.onclick/);
  assert.match(adminSource, /\$\("ev_coverFile"\)\.onchange/);
  assert.match(adminSource, /\$\("ev_photoFiles"\)\.onchange/);
});

test("admin.html: state carries the Events editing fields the handlers read/write", () => {
  for (const key of [
    "eventsCache", "editingEventId", "eventExtraRows", "eventCoverDataUrl",
    "eventNewPhotos", "eventExistingPhotos", "eventRemovePhotoIds"
  ]) {
    assert.match(adminSource, new RegExp(`${key}:`), `state must initialize ${key}`);
  }
});

test("admin.html: a super admin can grant/revoke manage_events via the Roles editor", () => {
  // functions/api/events.js requireAuth()s every write on "manage_events" —
  // the same commit that deleted the Events section also dropped this scope
  // from PERMISSION_SCOPES, so the roles editor could never display or toggle
  // it for anyone but the hardcoded super admins.
  assert.match(adminSource, /PERMISSION_SCOPES\s*=\s*\[[^\]]*"manage_events"[^\]]*\]/);
});

test("functions/api/roles.js still recognizes manage_events as a valid grantable scope", () => {
  const rolesSource = readFileSync(path.join(REPO_ROOT, "functions", "api", "roles.js"), "utf8");
  assert.match(rolesSource, /VALID_PERMISSIONS\s*=\s*\[[\s\S]*?"manage_events"[\s\S]*?\]/);
});
