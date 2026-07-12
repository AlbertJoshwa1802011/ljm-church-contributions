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
