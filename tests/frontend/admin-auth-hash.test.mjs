// Structural tests for the admin console gate and hash routing.
//
// Two real production bugs: (1) login/resume only probed /api/roles, so any
// admin without manage_roles was locked at the gate after refresh; (2)
// openSection never wrote location.hash, so menu clicks were not addressable
// and back/forward did nothing. These tests parse admin.html as text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

function isFunctionDefined(source, name) {
  return new RegExp(`function\\s+${name}\\s*\\(`).test(source);
}

test("admin auth: verifyAndUnlock is defined and used by both Google login and session resume", () => {
  assert.ok(isFunctionDefined(adminSource, "verifyAndUnlock"));
  assert.match(adminSource, /handleAdminCredential[\s\S]*?verifyAndUnlock\(payload\.email/);
  assert.match(adminSource, /function initGate[\s\S]*?verifyAndUnlock\(email\)/);
});

test("admin auth: the gate probes GET /api/auth (any-admin), not /api/roles alone", () => {
  assert.match(adminSource, /function verifyAndUnlock[\s\S]*?api\("\/api\/auth"\)/);
  const loginFn = adminSource.slice(
    adminSource.indexOf("window.handleAdminCredential"),
    adminSource.indexOf("function initGate")
  );
  assert.doesNotMatch(loginFn, /api\("\/api\/roles"\)/, "login must not require manage_roles");
  assert.doesNotMatch(loginFn, /purchases\?action=noop/, "broken purchases noop probe must not return");
});

test("admin auth: a failed probe clears the stored token so a non-admin cannot stick on the gate", () => {
  assert.ok(isFunctionDefined(adminSource, "denyAdminGate"));
  assert.match(adminSource, /function denyAdminGate[\s\S]*?sessionStorage\.removeItem\(TOKEN_KEY\)/);
});

test("admin hash: openSection writes location.hash so menu clicks are shareable", () => {
  const open = adminSource.slice(
    adminSource.indexOf("function openSection"),
    adminSource.indexOf("// ═══════════════ Overview")
  );
  assert.match(open, /location\.hash = name/);
  assert.match(open, /currentHash !== name/);
});

test("admin hash: hashchange re-opens a known NAV section", () => {
  assert.match(
    adminSource,
    /addEventListener\(\s*"hashchange"[\s\S]*?openSection\(hashVal\)/
  );
});
