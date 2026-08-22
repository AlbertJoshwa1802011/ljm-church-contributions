// Regression test for a real production defect: commit 1bfb6dd ("Add
// native-feeling global search to the admin console") accidentally deleted
// the entire Events admin section — the whole <div id="section-events"> form
// (create/edit/delete, drafts vs published, featured, cover photo, multi-photo
// upload), its nav entry, its "manage_events" role checkbox, and every
// eventXxx helper function — as unrelated collateral damage. functions/api/
// events.js (the backend) was never touched and still requires
// "manage_events" on every write, but from that commit onward there was
// literally no UI in admin.html to create, edit, delete, or photograph an
// event, or to grant a non-super-admin the permission to do so.
//
// The Events section was later rebuilt/enriched (church assignment,
// beneficiaries count, a proper existing/new-photo gallery editor) as part of
// the V2 milestone — this test was updated to match that current shape (see
// the V2 final-integration merge that deduplicated an accidental second,
// stale copy of this whole section introduced when two V2 branches each
// independently rebuilt Events and were merged together). The underlying
// regression this guards against is unchanged: the section, its nav entry,
// and its wiring must exist and not silently vanish again.
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

test("admin.html: the Events section markup exists exactly once with its full form and table", () => {
  const sectionMatches = adminSource.match(/<div class="section" id="section-events">/g) || [];
  assert.equal(sectionMatches.length, 1, "expected exactly one #section-events — a duplicate copy is as broken as a missing one");
  for (const id of [
    "ev_formTitle", "ev_title", "ev_category", "ev_eventDate", "ev_location", "ev_churchId",
    "ev_status", "ev_featured", "ev_beneficiariesCount", "ev_description",
    "ev_coverFile", "ev_coverPreviewContainer", "ev_coverPreview",
    "ev_galleryFiles", "ev_galleryPreview", "ev_existingPhotos", "ev_existingPhotosGrid",
    "ev_saveBtn", "ev_clearBtn", "ev_msg", "ev_table"
  ]) {
    const idMatches = adminSource.match(new RegExp(`id="${id}"`, "g")) || [];
    assert.equal(idMatches.length, 1, `admin.html must have exactly one element with id="${id}"`);
  }
});

test("admin.html: the Events nav item is reachable from the Ministry group", () => {
  assert.match(adminSource, /\["events",\s*"[^"]*",\s*"Events[^"]*"\]/);
});

test("admin.html: every function the Events section calls is actually defined, exactly once", () => {
  const EVENTS_FUNCTIONS = [
    "loadEvents", "fetchEvents", "editEvent", "setEventStatus", "clearEventForm", "saveEvent",
    "renderEventGalleryPreview", "renderEventExistingPhotos"
  ];
  for (const fn of EVENTS_FUNCTIONS) {
    assert.ok(isFunctionDefined(adminSource, fn), `${fn}() must be defined in admin.html`);
    const defs = adminSource.match(new RegExp(`function ${fn}\\s*\\(`, "g")) || [];
    assert.equal(defs.length, 1, `${fn}() must be defined exactly once — a duplicate redefinition silently shadows the other`);
  }
});

test("admin.html: opening the Events section loads it (wired into LOADERS)", () => {
  assert.match(adminSource, /LOADERS\s*=\s*\{[\s\S]*?\bevents:\s*loadEvents\b[\s\S]*?\}/);
});

test("admin.html: the Events form buttons/inputs are wired to their handlers", () => {
  assert.match(adminSource, /\$\("ev_saveBtn"\)\.onclick\s*=\s*saveEvent/);
  assert.match(adminSource, /\$\("ev_clearBtn"\)\.onclick\s*=\s*clearEventForm/);
  assert.match(adminSource, /\$\("ev_coverFile"\)\.onchange/);
  assert.match(adminSource, /\$\("ev_galleryFiles"\)\.onchange/);
});

test("admin.html: state carries the Events editing fields the handlers read/write", () => {
  for (const key of [
    "eventsCache", "editingEventId", "eventCoverDataUrl", "eventExistingPhotos", "eventRemovePhotoIds"
  ]) {
    assert.match(adminSource, new RegExp(`${key}:`), `state must initialize ${key}`);
  }
  // eventNewGalleryFiles is assigned (not object-literal-initialized) in the Events module itself.
  assert.match(adminSource, /state\.eventNewGalleryFiles\s*=\s*\[\]/);
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
