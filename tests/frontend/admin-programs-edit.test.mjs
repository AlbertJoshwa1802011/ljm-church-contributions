// Admin Programs (service times) had no way to edit an existing row — the
// "All programs" table only offered Delete, so fixing a typo'd time or a
// wrong church meant deleting the program (losing its id/history) and
// re-adding it from scratch. functions/api/programs.js already implements
// onRequestPut() (PUT /api/programs with body.id), so this was purely a
// missing admin-UI gap, not a backend limitation.
//
// admin.html has no build step, so a missing element id or an undefined
// function is invisible until a real admin clicks the control (see CLAUDE.md's
// "Known pitfall"). These tests parse admin.html as text and assert the
// wiring a ReferenceError / missing-element bug would violate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

test("admin.html: the Programs table row has an Edit action, not just Delete", () => {
  assert.match(adminSource, /data-act="edit"/);
  assert.match(adminSource, /editProgram\(Number\(b\.dataset\.id\)\)/);
});

test("admin.html: editProgram/clearProgramForm are defined and wired to the form", () => {
  assert.match(adminSource, /function editProgram\(id\)/);
  assert.match(adminSource, /function clearProgramForm\(\)/);
  assert.match(adminSource, /\$\("pg_clearBtn"\)\.onclick\s*=\s*clearProgramForm/);
});

test("admin.html: saveProgram() sends a PUT (not another POST) while editing", () => {
  const start = adminSource.indexOf("function saveProgram(");
  assert.notEqual(start, -1);
  const end = adminSource.indexOf("\n        }", start);
  const body = adminSource.slice(start, end);
  assert.match(body, /state\.editingProgramId/, "saveProgram() must branch on an editing-id");
  assert.match(body, /method:\s*isEdit\s*\?\s*"PUT"\s*:\s*"POST"/, "editing an existing program must PUT, not create a duplicate");
});

test("admin.html: editing a program preserves its current status instead of silently re-activating it", () => {
  // /api/programs PUT defaults status to "active" when the body omits it —
  // the form has an explicit Status field (pg_status), and editProgram() must
  // populate it with the row's real status so saveProgram()'s body carries it
  // through, or fixing a typo on a deactivated program would silently
  // republish it.
  const editStart = adminSource.indexOf("function editProgram(");
  const editEnd = adminSource.indexOf("\n        }", editStart);
  const editBody = adminSource.slice(editStart, editEnd);
  assert.match(editBody, /\$\("pg_status"\)\.value\s*=\s*p\.status\s*\|\|\s*"active"/, "editProgram() must populate pg_status from the row being edited");

  const saveStart = adminSource.indexOf("function saveProgram(");
  const saveEnd = adminSource.indexOf("\n        }", saveStart);
  const saveBody = adminSource.slice(saveStart, saveEnd);
  assert.match(saveBody, /status:\s*\$\("pg_status"\)\.value/, "saveProgram() must send the form's actual status field, not a hardcoded default");
});

test("admin.html: state carries a programsCache for editProgram() to read rows from", () => {
  assert.match(adminSource, /programsCache:\s*\[\]/);
  assert.match(adminSource, /state\.programsCache\s*=\s*d\.programs/);
});
