// Structural tests for the Add-a-contribution member picker in admin.html.
//
// admin.html has no build step — no bundler, no linter, no TypeScript. A
// function name that's called but never defined, or a getElementById() for an
// id that isn't in the markup, is invisible until a real admin clicks the
// control and their browser throws (see CLAUDE.md's "Known pitfall"). The
// picker is a chain of small helpers wired together at init time, which is
// exactly the shape that failed silently before.
//
// These tests parse admin.html as text — there is no jsdom in this suite — and
// assert the invariants that a ReferenceError would violate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

// Every helper the picker relies on. If one is renamed without updating its
// call sites, `isFunctionDefined` fails here instead of in production.
const PICKER_FUNCTIONS = [
  "ensureMembersLoaded",
  "primeMemberPicker",
  "setMemberPickerStatus",
  "findMemberByName",
  "syncMemberPickerStatus",
  "memberMatches",
  "renderMemberMenu",
  "mpRowButtons",
  "highlightMemberRow",
  "openMemberMenu",
  "closeMemberMenu",
  "selectMember",
  "isAutofilled",
  "applyMemberContact",
  "resetAutofillTracking",
  "openNewMemberForm",
  "hideNewMemberForm",
  "createMemberFromPicker",
  "onMemberInputKeydown",
  "initMemberPicker"
];

// Element ids the picker reads via $() — each must exist in the markup.
const PICKER_ELEMENT_IDS = [
  "c_member",
  "c_memberMenu",
  "c_memberStatus",
  "c_newMemberForm",
  "c_nmName",
  "c_nmEmail",
  "c_nmPhone",
  "c_nmSaveBtn",
  "c_nmCancelBtn",
  "c_nmMsg"
];

function isFunctionDefined(source, name) {
  const declaredFn = new RegExp(`function\\s+${name}\\s*\\(`);
  const assignedFn = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  return declaredFn.test(source) || assignedFn.test(source);
}

test("member picker: every helper the picker calls is actually defined", () => {
  const missing = PICKER_FUNCTIONS.filter(name => !isFunctionDefined(adminSource, name));
  assert.deepEqual(missing, [], `These picker functions are referenced but never defined in admin.html: ${missing.join(", ")}`);
});

test("member picker: every element id the picker touches exists in the markup", () => {
  const missing = PICKER_ELEMENT_IDS.filter(id => !adminSource.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `These ids are read by the picker JS but absent from admin.html's markup: ${missing.join(", ")}`);
});

test("member picker: initMemberPicker() is wired up at init, not just defined", () => {
  assert.match(
    adminSource,
    /\$\("c_saveBtn"\)\.onclick = saveContribution;[\s\S]{0,200}initMemberPicker\(\);/,
    "initMemberPicker() must be called in the init block alongside the other Contributions wiring — a picker that's never initialised leaves a dead input"
  );
});

test("member picker: loadContributions() wraps its independent init calls in separate try/catch", () => {
  const start = adminSource.indexOf("function loadContributions()");
  assert.ok(start !== -1, "loadContributions() should still exist in admin.html");
  // Window has to cover the whole function body, including the isContribAdmin gate.
  const block = adminSource.slice(start, adminSource.indexOf("// ─────────── Member picker"));

  assert.match(
    block,
    /try\s*{\s*fetchContribTable\(\);\s*}\s*catch/,
    "fetchContribTable() should run in its own try/catch so a picker failure can't stop the ledger loading"
  );
  // primeMemberPicker() is gated behind isContribAdmin (the form is hidden for
  // everyone else), but it still needs its own try/catch inside that branch.
  assert.match(
    block,
    /try\s*{\s*primeMemberPicker\(\);\s*}\s*catch/,
    "primeMemberPicker() should run in its own try/catch so a directory failure can't stop the ledger loading"
  );
});

test("member picker: reads the member directory from the admin /api/members endpoint", () => {
  const start = adminSource.indexOf("function ensureMembersLoaded(");
  assert.ok(start !== -1, "ensureMembersLoaded() should exist");
  const fn = adminSource.slice(start, start + 900);

  assert.match(fn, /api\("\/api\/members"\)/, "ensureMembersLoaded() should call the permission-gated /api/members endpoint");
  assert.match(fn, /state\.membersCache = d\.members/, "ensureMembersLoaded() should populate the shared state.membersCache");
  assert.match(fn, /state\.membersError/, "a failed/forbidden directory fetch must be recorded so the picker can degrade to free text");
});

test("member picker: selecting a member auto-fills the contribution email and phone", () => {
  const start = adminSource.indexOf("function selectMember(");
  assert.ok(start !== -1, "selectMember() should exist");
  const fn = adminSource.slice(start, adminSource.indexOf("\n        }", start));

  assert.match(fn, /\$\("c_member"\)\.value = m\.name/, "selecting a member should put their canonical directory name in the member field");
  assert.match(fn, /applyMemberContact\(m\)/, "selecting a member should route contact details through applyMemberContact()");

  const apply = adminSource.slice(adminSource.indexOf("function applyMemberContact("), adminSource.indexOf("function resetAutofillTracking("));
  assert.match(apply, /c_email/, "applyMemberContact() should fill the contribution email field");
  assert.match(apply, /c_phone/, "applyMemberContact() should fill the contribution phone field");
});

// Regression: picking Member A (who has an email) and then switching to Member B
// (who doesn't) used to leave A's email sitting in the form, so B's contribution
// was saved with A's contact details. Same root cause let the "create new member"
// form open pre-filled with the previously picked member's email/phone, which
// would have written the wrong contact details into the directory.
test("member picker: a previous member's auto-filled contact details never leak onto another record", () => {
  const apply = adminSource.slice(adminSource.indexOf("function applyMemberContact("), adminSource.indexOf("function resetAutofillTracking("));

  assert.match(
    apply,
    /if \(cur && !isAutofilled\(field\)\) return;/,
    "applyMemberContact() must leave hand-typed contact details untouched"
  );
  assert.match(
    apply,
    /el\.value = m\[field\] \|\| "";/,
    "switching members must overwrite the previous auto-filled value even when the new member has none on file — otherwise the old member's details stay attached"
  );

  const openNew = adminSource.slice(adminSource.indexOf("function openNewMemberForm("), adminSource.indexOf("function hideNewMemberForm("));
  assert.match(
    openNew,
    /isAutofilled\("email"\) \? "" :/,
    "the create-member form must not pre-fill another member's auto-filled email"
  );
  assert.match(
    openNew,
    /isAutofilled\("phone"\) \? "" :/,
    "the create-member form must not pre-fill another member's auto-filled phone"
  );
});

test("member picker: autofill tracking is reset when the form is cleared or loaded for edit", () => {
  const clearFn = adminSource.slice(adminSource.indexOf("function clearContributionForm()"), adminSource.indexOf("function saveContribution()"));
  assert.match(clearFn, /resetAutofillTracking\(\)/, "clearing the form must reset autofill tracking so stale state can't leak into the next entry");

  const editFn = adminSource.slice(adminSource.indexOf("function editContribution(id)"), adminSource.indexOf("function deleteContribution(id)"));
  assert.match(editFn, /resetAutofillTracking\(\)/, "an edited row's stored contact details are not picker autofill and must not be treated as replaceable");
});

test("member picker: inline member creation posts to /api/members and re-reads the directory", () => {
  const start = adminSource.indexOf("function createMemberFromPicker(");
  assert.ok(start !== -1, "createMemberFromPicker() should exist");
  const fn = adminSource.slice(start, start + 1600);

  assert.match(fn, /api\("\/api\/members",\s*{\s*method:\s*"POST"/, "creating a member should POST to the existing /api/members endpoint rather than a new one");
  assert.match(fn, /ensureMembersLoaded\(true\)/, "after creating a member the directory must be force-refreshed so the new row is selectable");
  assert.match(fn, /selectMember\(created\)/, "a freshly created member should be selected into the form automatically");
});

// The manual add/edit/delete controls are restricted server-side to a single
// email (MANUAL_ENTRY_ALLOWLIST in functions/api/contributions.js). This is the
// matching UI gate — defence in depth only. The server remains the authority:
// bypassing the hidden UI still gets a 403, so these assertions are about not
// showing other admins controls that will only fail after they hit submit.
test("contributions gate: the add form and row actions are hidden for non-allowlisted admins", () => {
  assert.match(adminSource, /id="c_addCard"/, "the Add-a-contribution card needs an id so it can be hidden");

  const load = adminSource.slice(adminSource.indexOf("function loadContributions()"), adminSource.indexOf("// ─────────── Member picker"));
  assert.match(load, /isContribAdmin = !!\(identity && identity\.email === "albertjoshrock101@gmail\.com"\)/,
    "loadContributions() should derive the UI gate from the signed-in identity");
  assert.match(load, /\$\("c_addCard"\)\.style\.display = isContribAdmin \? "" : "none"/,
    "the add-contribution card should be hidden for anyone but the allowlisted admin");

  const render = adminSource.slice(adminSource.indexOf("function renderContribTable()"), adminSource.indexOf("function editContribution(id)"));
  assert.match(render, /var actions = \(isContribAdmin && c\.id != null\)/,
    "Edit/Delete buttons should only render for the allowlisted admin");
});

test("contributions gate: the member directory is not fetched for admins who cannot use the form", () => {
  const load = adminSource.slice(adminSource.indexOf("function loadContributions()"), adminSource.indexOf("// ─────────── Member picker"));
  assert.match(
    load,
    /if \(isContribAdmin\) {\s*try { primeMemberPicker\(\); }/,
    "priming the picker should be skipped for non-allowlisted admins — the form is hidden, so the fetch is pure waste and would 403"
  );
});

test("contributions gate: the server-side allowlist is still the real authorization boundary", () => {
  const apiSource = readFileSync(path.join(REPO_ROOT, "functions", "api", "contributions.js"), "utf8");
  assert.match(apiSource, /const MANUAL_ENTRY_ALLOWLIST = \[/, "the server-side allowlist must not be removed in favour of the UI gate");
  for (const handler of ["onRequestPost", "onRequestPut", "onRequestDelete"]) {
    const start = apiSource.indexOf(`export async function ${handler}(context)`);
    assert.ok(start !== -1, `${handler} should exist`);
    assert.match(
      apiSource.slice(start, start + 200),
      /const auth = await requireManualEntryAdmin\(context\);\s*\n\s*if \(!auth\.ok\) return auth\.response;/,
      `${handler} must still enforce requireManualEntryAdmin — the UI gate is cosmetic and must never become the only check`
    );
  }
});

test("member picker: free-typed names that match no member still save, but only after an explicit confirm", () => {
  const start = adminSource.indexOf("function saveContribution()");
  assert.ok(start !== -1, "saveContribution() should still exist");
  const fn = adminSource.slice(start, start + 1600);

  // The legacy free-text path must survive — this endpoint has always accepted
  // an arbitrary member_name, and historic rows depend on that.
  assert.match(fn, /member_name: memberName/, "saveContribution() must still send the typed name, so free-text entry keeps working");
  assert.match(
    fn,
    /!state\.membersError[\s\S]{0,120}!findMemberByName\(memberName\)[\s\S]{0,200}confirm\(/,
    "an unmatched name should prompt for confirmation — and only when the directory actually loaded, so a failed fetch never blocks saving"
  );
});
