import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as roles from "../../functions/api/roles.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("roles: a custom role can be granted the new manage_members and manage_content scopes", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "save_role", roleName: "content_editor", permissions: ["manage_members", "manage_content"] }
  })));
  assert.equal(res.success, true, res.message);

  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  const role = listRes.roles.find(r => r.role_name === "content_editor");
  assert.ok(role);
  assert.deepEqual(JSON.parse(role.permissions), ["manage_members", "manage_content"]);
});

test("roles: rejects a permission scope that doesn't exist", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "save_role", roleName: "bad_role", permissions: ["not_a_real_scope"] }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Invalid permissions/);
});

test("roles: super_admin seed role already includes manage_members and manage_content", async () => {
  const db = freshDb();
  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  const superAdmin = listRes.roles.find(r => r.role_name === "super_admin");
  const perms = JSON.parse(superAdmin.permissions);
  assert.ok(perms.includes("manage_members"));
  assert.ok(perms.includes("manage_content"));
});

test("roles: linking an email to a role works and is reflected in mappings", async () => {
  const db = freshDb();
  await roles.onRequestPost(makeContext({ db, body: { action: "save_role", roleName: "helper", permissions: ["view_members"] } }));
  const linkRes = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "link_email", email: "Helper@Example.com", roleName: "helper" }
  })));
  assert.equal(linkRes.success, true);

  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  const mapping = listRes.mappings.find(m => m.email === "helper@example.com");
  assert.ok(mapping, "email should be stored lowercased");
  assert.equal(mapping.role_name, "helper");
});

test("roles: save_role rejects missing roleName or permissions", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "save_role", permissions: ["view_members"] }
  })));
  assert.equal(res.success, false);
});

test("roles: save_role refuses to modify the built-in super_admin role", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "save_role", roleName: "super_admin", permissions: ["view_members"] }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /cannot be modified/);

  // And the seeded permissions must be unchanged.
  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  const superAdmin = listRes.roles.find(r => r.role_name === "super_admin");
  assert.ok(JSON.parse(superAdmin.permissions).includes("delete_funds"));
});

test("roles: link_email rejects missing email or roleName", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "link_email", roleName: "helper" }
  })));
  assert.equal(res.success, false);
});

test("roles: POST with an unknown action is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, body: { action: "nonsense" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Unknown action/);
});

test("roles: POST requires manage_roles permission", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestPost(makeContext({
    db, authToken: null, body: { action: "save_role", roleName: "x", permissions: [] }
  })));
  assert.equal(res.success, false);
});

test("roles: GET requires manage_roles permission", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(res.success, false);
});

test("roles: DELETE delete_role removes a custom role", async () => {
  const db = freshDb();
  await roles.onRequestPost(makeContext({ db, body: { action: "save_role", roleName: "temp_role", permissions: ["view_members"] } }));

  const delRes = await readJson(await roles.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/roles?action=delete_role&roleName=temp_role"
  })));
  assert.equal(delRes.success, true, delRes.message);

  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  assert.ok(!listRes.roles.find(r => r.role_name === "temp_role"), "the role should be gone");
});

test("roles: DELETE delete_role refuses to delete the built-in super_admin role", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/roles?action=delete_role&roleName=super_admin"
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Cannot delete/);

  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  assert.ok(listRes.roles.find(r => r.role_name === "super_admin"), "super_admin role must survive the attempt");
});

test("roles: DELETE unlink_email removes a mapping", async () => {
  const db = freshDb();
  await roles.onRequestPost(makeContext({ db, body: { action: "save_role", roleName: "helper2", permissions: ["view_members"] } }));
  await roles.onRequestPost(makeContext({ db, body: { action: "link_email", email: "person@example.com", roleName: "helper2" } }));

  const delRes = await readJson(await roles.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/roles?action=unlink_email&email=person@example.com"
  })));
  assert.equal(delRes.success, true, delRes.message);

  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  assert.ok(!listRes.mappings.find(m => m.email === "person@example.com"));
});

test("roles: DELETE unlink_email refuses to unlink a hardcoded super admin email", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/roles?action=unlink_email&email=albertjoshrock101@gmail.com"
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Cannot unlink/);

  // The seed mapping must still be intact.
  const listRes = await readJson(await roles.onRequestGet(makeContext({ db })));
  assert.ok(listRes.mappings.find(m => m.email === "albertjoshrock101@gmail.com"));
});

test("roles: DELETE with an unknown action is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/roles?action=nonsense"
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Unknown action/);
});

test("roles: DELETE requires manage_roles permission", async () => {
  const db = freshDb();
  const res = await readJson(await roles.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: "https://test.local/api/roles?action=delete_role&roleName=editor"
  })));
  assert.equal(res.success, false);
});
