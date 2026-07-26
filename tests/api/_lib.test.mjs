// Direct unit tests for functions/api/_lib.js — the shared auth/permission
// helpers every other handler depends on. Previously only exercised indirectly
// through other handlers' tests; this file targets the branches those tests
// happen not to reach. See docs/testing/COVERAGE-TRACKER.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/mock-d1.mjs";
import { getPermissions, requireAuth, verifyGoogleToken, audit } from "../../functions/api/_lib.js";

function withGoogleStub(handler, fn) {
  return async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = handler;
    try { await fn(); } finally { globalThis.fetch = realFetch; }
  };
}

// ── getPermissions ──

test("_lib getPermissions: an email with no member_roles row gets no permissions", async () => {
  const db = freshDb();
  const perms = await getPermissions("nobody@example.com", db);
  assert.deepEqual(perms, []);
});

test("_lib getPermissions: member_roles has a real FK (ON DELETE CASCADE) — deleting a role removes the mapping, and permissions revert to none", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('temp_role', '["view_members"]');
     INSERT INTO member_roles (email, role_name) VALUES ('will-lose-role@example.com', 'temp_role');`
  );
  assert.deepEqual(await getPermissions("will-lose-role@example.com", db), ["view_members"]);

  db._sqlite.exec(`DELETE FROM roles WHERE role_name = 'temp_role'`);

  const mapping = await db.prepare("SELECT email FROM member_roles WHERE email = ?").bind("will-lose-role@example.com").first();
  assert.equal(mapping, null, "ON DELETE CASCADE should remove the now-dangling mapping");
  assert.deepEqual(await getPermissions("will-lose-role@example.com", db), []);
});

test("_lib getPermissions: a member_roles row cannot reference a role that was never created (FK enforced at insert time)", async () => {
  const db = freshDb();
  assert.throws(
    () => db._sqlite.exec(`INSERT INTO member_roles (email, role_name) VALUES ('orphan@example.com', 'never_existed')`),
    /FOREIGN KEY/,
    "the schema's FK constraint should reject an insert pointing at a nonexistent role"
  );
});

test("_lib getPermissions: malformed permissions JSON in the roles table falls back to no permissions instead of throwing", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('broken_role', 'not-json{{{');
     INSERT INTO member_roles (email, role_name) VALUES ('broken@example.com', 'broken_role');`
  );
  const perms = await getPermissions("broken@example.com", db);
  assert.deepEqual(perms, []);
});

test("_lib getPermissions: a hardcoded super admin gets wildcard permissions without needing a role row", async () => {
  const db = freshDb();
  const perms = await getPermissions("albertjoshrock101@gmail.com", db);
  assert.deepEqual(perms, ["*"]);
});

test("_lib getPermissions: a null/empty email yields no permissions", async () => {
  const db = freshDb();
  assert.deepEqual(await getPermissions(null, db), []);
  assert.deepEqual(await getPermissions("", db), []);
});

// ── requireAuth ──

test("_lib requireAuth: when no specific permission is required, any recognized role holder passes with their real permissions", async () => {
  const db = freshDb();
  db._sqlite.exec(
    `INSERT INTO roles (role_name, permissions) VALUES ('wishlist_role', '["edit_wishlist"]');
     INSERT INTO member_roles (email, role_name) VALUES ('scoped@example.com', 'wishlist_role');`
  );
  const context = {
    env: { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: {
      url: "https://test.local/api/x",
      headers: { get: (k) => (k === "Authorization" ? "Bearer scoped@example.com" : null) }
    }
  };
  const auth = await requireAuth(context, null);
  assert.equal(auth.ok, true);
  assert.deepEqual(auth.permissions, ["edit_wishlist"]);
});

test("_lib requireAuth: an email with no role at all is denied even when no specific permission is required", async () => {
  const db = freshDb();
  const context = {
    env: { DB: db, ADMIN_API_TOKEN: "test-admin-token", ALLOW_LEGACY_EMAIL_TOKEN: "true" },
    request: {
      url: "https://test.local/api/x",
      headers: { get: (k) => (k === "Authorization" ? "Bearer nobody@example.com" : null) }
    }
  };
  const auth = await requireAuth(context, null);
  assert.equal(auth.ok, false);
});

// ── verifyGoogleToken ──

test("_lib verifyGoogleToken: rejects when the audience (client ID) doesn't match", withGoogleStub(
  async () => ({ ok: true, json: async () => ({ email: "x@example.com", aud: "wrong-client-id" }) }),
  async () => {
    const identity = await verifyGoogleToken("fake-token", { GOOGLE_CLIENT_ID: "expected-client-id" });
    assert.equal(identity, null);
  }
));

test("_lib verifyGoogleToken: a non-OK response from Google yields null", withGoogleStub(
  async () => ({ ok: false }),
  async () => {
    const identity = await verifyGoogleToken("fake-token", {});
    assert.equal(identity, null);
  }
));

test("_lib verifyGoogleToken: a payload with no email yields null", withGoogleStub(
  async () => ({ ok: true, json: async () => ({ name: "No Email Person" }) }),
  async () => {
    const identity = await verifyGoogleToken("fake-token", {});
    assert.equal(identity, null);
  }
));

test("_lib verifyGoogleToken: a valid payload with a matching (or unset) audience resolves an identity", withGoogleStub(
  async () => ({ ok: true, json: async () => ({ email: "Real.Person@Example.com", name: "Real Person", aud: "the-client-id" }) }),
  async () => {
    const identity = await verifyGoogleToken("fake-token", { GOOGLE_CLIENT_ID: "the-client-id" });
    assert.equal(identity.email, "real.person@example.com", "email should be lowercased");
    assert.equal(identity.name, "Real Person");
  }
));

// ── audit ──

test("_lib audit: never throws, even when the underlying DB write fails", async () => {
  const throwingDb = {
    prepare() {
      return {
        bind() { return this; },
        async run() { throw new Error("simulated DB failure"); }
      };
    }
  };
  const context = {
    env: { DB: throwingDb },
    request: { headers: { get: () => "" } }
  };
  // Must resolve, not reject — a broken audit log must never break the caller's real operation.
  await assert.doesNotReject(audit(context, { action: "test.action" }));
});
