// Structural tests for the Funds admin panel in admin.html — specifically the
// Fund Foundation metadata fields (hero image, message, ranking groundwork,
// Razorpay public-key groundwork) added alongside migrations/0015.
//
// admin.html has no build step — no bundler, no linter, no TypeScript. A
// function name that's called but never defined, or a getElementById() for an
// id that isn't in the markup, is invisible until a real admin clicks the
// control and their browser throws (see CLAUDE.md's "Known pitfall"). These
// tests parse admin.html as text — there is no jsdom in this suite — and
// assert the invariants that a ReferenceError or a silent no-op would violate.
//
// This closes the "Funds" row under docs/testing/COVERAGE-TRACKER.md's
// "admin.html inline-script CRUD wiring" accepted gap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

const FUND_FUNCTIONS = [
  "loadFunds",
  "fundAction",
  "openAssign",
  "clearFundForm",
  "saveFund",
  "submitFund"
];

// Fund Foundation metadata element ids — each must exist in the markup.
const FUND_METADATA_ELEMENT_IDS = [
  "f_message",
  "f_heroImageFile",
  "f_heroImagePreview",
  "f_heroImagePreviewContainer",
  "f_removeHeroImageBtn",
  "f_rankingEnabled",
  "f_rankingVisibility",
  "f_razorpayKeyId"
];

function isFunctionDefined(source, name) {
  const declaredFn = new RegExp(`function\\s+${name}\\s*\\(`);
  const assignedFn = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  return declaredFn.test(source) || assignedFn.test(source);
}

test("funds admin: every helper the Funds section calls is actually defined", () => {
  const missing = FUND_FUNCTIONS.filter(name => !isFunctionDefined(adminSource, name));
  assert.deepEqual(missing, [], `These Funds functions are referenced but never defined in admin.html: ${missing.join(", ")}`);
});

test("funds admin: every Fund Foundation metadata element id exists in the markup", () => {
  const missing = FUND_METADATA_ELEMENT_IDS.filter(id => !adminSource.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `These ids are read by the Funds JS but absent from admin.html's markup: ${missing.join(", ")}`);
});

test("funds admin: the hero image file input and remove button are wired up at init", () => {
  assert.match(
    adminSource,
    /\$\("f_heroImageFile"\)\.onchange = function/,
    "the hero image file input must have an onchange handler wired at init"
  );
  assert.match(
    adminSource,
    /\$\("f_removeHeroImageBtn"\)\.onclick = function/,
    "the remove-hero-image button must have an onclick handler wired at init"
  );
});

test("funds admin: saveFund() sends the new metadata fields (message, ranking groundwork, Razorpay key groundwork)", () => {
  const start = adminSource.indexOf("function saveFund()");
  assert.ok(start !== -1, "saveFund() should exist");
  const fn = adminSource.slice(start, adminSource.indexOf("function submitFund("));

  assert.match(fn, /message:\s*\$\("f_message"\)\.value\.trim\(\)/, "saveFund() must send the fund message");
  assert.match(fn, /rankingEnabled:\s*\$\("f_rankingEnabled"\)\.checked/, "saveFund() must send the ranking-enabled groundwork flag");
  assert.match(fn, /rankingVisibility:\s*\$\("f_rankingVisibility"\)\.value/, "saveFund() must send the ranking visibility groundwork");
  assert.match(fn, /razorpayKeyId:\s*\$\("f_razorpayKeyId"\)\.value\.trim\(\)/, "saveFund() must send the Razorpay public-key groundwork field");
});

// Regression: an earlier draft of this form resent the fund's already-stored
// hero image URL on every save. For an R2-backed image, funds.js treats any
// non-empty heroImage as a fresh upload — it deletes the existing R2 object
// and re-tags storage as "external", breaking the image on any unrelated
// edit (e.g. just changing the goal amount). heroImage must only be sent when
// a NEW file was actually picked in this form session.
test("funds admin: saveFund() only sends heroImage when a new file was picked, not the previously-stored URL", () => {
  const start = adminSource.indexOf("function saveFund()");
  const fn = adminSource.slice(start, adminSource.indexOf("function submitFund("));

  assert.doesNotMatch(
    fn,
    /payload\.heroImage\s*=\s*state\.fundHeroImageUrl/,
    "saveFund() must not resend the previously-stored hero image URL as a new upload on every save"
  );
  assert.match(
    fn,
    /var heroFile = \$\("f_heroImageFile"\)\.files\[0\];/,
    "saveFund() should only build heroImage from a freshly selected file"
  );
});

test("funds admin: editing a fund populates the Fund Foundation metadata fields, including on system funds", () => {
  const start = adminSource.indexOf("function fundAction(act, slug)");
  assert.ok(start !== -1, "fundAction() should exist");
  const fn = adminSource.slice(start, adminSource.indexOf("function openAssign("));

  assert.match(fn, /\$\("f_message"\)\.value = f\.message \|\| ""/, "editing a fund must populate the message field");
  assert.match(fn, /\$\("f_rankingEnabled"\)\.checked = !!f\.rankingEnabled/, "editing a fund must populate the ranking-enabled checkbox");
  assert.match(fn, /\$\("f_rankingVisibility"\)\.value = f\.rankingVisibility \|\| "public"/, "editing a fund must populate ranking visibility");
  assert.match(fn, /\$\("f_razorpayKeyId"\)\.value = f\.razorpayKeyId \|\| ""/, "editing a fund must populate the Razorpay key groundwork field");

  // Unlike name/slug/description/visibility, the new metadata fields must NOT
  // be disabled for system funds (Tech/Christmas) — funds.js allows editing
  // them on every fund, so the UI must not silently block that.
  assert.doesNotMatch(
    fn,
    /\$\("f_message"\)\.disabled = .*isSystem/,
    "the fund message field must stay editable for system funds"
  );
});

// Regression: the Archive Fund button sent `{ slug, action: "archive" }` to
// PUT /api/funds, but funds.js's PUT handler only recognizes a `status`
// field ("active" | "archived") — it has no `action` field at all. Since
// nothing in the request body matched a recognized change, `changes` stayed
// empty and the handler returned 400 "No editable fields provided", so
// clicking Archive silently failed. The fix sends the status-based shape the
// API actually expects.
test("funds admin: the Archive Fund button sends { status: \"archived\" } — the shape funds.js's PUT handler expects", () => {
  const start = adminSource.indexOf('$("f_archiveBtn").onclick = function');
  assert.ok(start !== -1, "the Archive Fund button's onclick handler should exist");
  const nextHandler = adminSource.indexOf('$("f_deleteBtn").onclick', start);
  const fn = adminSource.slice(start, nextHandler);

  assert.match(
    fn,
    /method:\s*["']PUT["']/,
    "archiving a fund must PUT to /api/funds"
  );
  assert.match(
    fn,
    /body:\s*JSON\.stringify\(\{\s*slug:\s*state\.editingFundSlug,\s*status:\s*["']archived["']\s*\}\)/,
    "the Archive Fund button must send { slug, status: 'archived' } — funds.js's PUT handler has no 'action' field, only 'status'"
  );
  assert.doesNotMatch(
    fn,
    /action:\s*["']archive["']/,
    "the Archive Fund button must not send the old { action: 'archive' } shape — funds.js's PUT handler doesn't understand it and returns 400"
  );
});

test("funds admin: clearing the fund form resets the Fund Foundation metadata fields", () => {
  const start = adminSource.indexOf("function clearFundForm()");
  assert.ok(start !== -1, "clearFundForm() should exist");
  const fn = adminSource.slice(start, adminSource.indexOf("function saveFund()"));

  assert.match(fn, /"f_message"/, "clearFundForm() must reset the message field");
  assert.match(fn, /\$\("f_rankingEnabled"\)\.checked = false/, "clearFundForm() must reset the ranking-enabled checkbox");
  assert.match(fn, /\$\("f_heroImagePreviewContainer"\)\.style\.display = "none"/, "clearFundForm() must hide any leftover hero image preview");
});
