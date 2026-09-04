// The Roles form checkboxes are the only way a super-admin grants scopes in
// the UI. If PERMISSION_SCOPES in admin.html drifts behind VALID_PERMISSIONS
// in roles.js, a scope the API understands can never be assigned from the
// console (this happened for manage_events and edit_contributions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");
const rolesSource = readFileSync(path.join(REPO_ROOT, "functions", "api", "roles.js"), "utf8");

function parseQuotedList(source, varName) {
  const match = source.match(new RegExp(`(?:const|var) ${varName} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `Expected to find ${varName} array`);
  return [...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

test("admin Roles UI lists every VALID_PERMISSIONS scope the API accepts", () => {
  const ui = parseQuotedList(adminSource, "PERMISSION_SCOPES");
  const api = parseQuotedList(rolesSource, "VALID_PERMISSIONS");
  const missing = api.filter((s) => !ui.includes(s));
  assert.deepEqual(missing, [], `Roles checkboxes missing API scopes: ${missing.join(", ")}`);
});

test("admin Roles UI does not invent scopes the API would reject", () => {
  const ui = parseQuotedList(adminSource, "PERMISSION_SCOPES");
  const api = parseQuotedList(rolesSource, "VALID_PERMISSIONS");
  const extra = ui.filter((s) => !api.includes(s));
  assert.deepEqual(extra, [], `Roles checkboxes unknown to the API: ${extra.join(", ")}`);
});

test("admin Roles UI includes manage_events and edit_contributions", () => {
  const ui = parseQuotedList(adminSource, "PERMISSION_SCOPES");
  assert.ok(ui.includes("manage_events"));
  assert.ok(ui.includes("edit_contributions"));
  assert.ok(ui.includes("manage_subscriptions"));
  assert.ok(!ui.includes("manage_sandha"), "legacy manage_sandha name must not return");
});
