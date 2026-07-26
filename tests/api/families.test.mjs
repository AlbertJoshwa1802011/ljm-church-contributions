import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as families from "../../functions/api/families.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("families: create with two members, list, set head, remove member, delete", async () => {
  const db = freshDb();

  // Create a family with two members; the first (Head) should become head_member_id.
  const createRes = await families.onRequestPost(makeContext({
    db,
    body: {
      familyName: "Thomas Family",
      address: "12 Church Street",
      primaryPhone: "9999999999",
      members: [
        { name: "John Thomas", relation: "Head", email: "john@example.com" },
        { name: "Mary Thomas", relation: "Spouse" }
      ]
    }
  }));
  const created = await readJson(createRes);
  assert.equal(created.success, true, created.message);
  assert.equal(created.members.length, 2);
  const familyId = created.id;

  // List: family shows up with both members nested, head resolved by name.
  const listRes = await families.onRequestGet(makeContext({ db }));
  const listed = await readJson(listRes);
  assert.equal(listed.success, true);
  assert.equal(listed.families.length, 1);
  const fam = listed.families[0];
  assert.equal(fam.familyName, "Thomas Family");
  assert.equal(fam.memberCount, 2);
  assert.equal(fam.headMemberName, "John Thomas");
  assert.equal(listed.unassignedMembers.length, 0);

  const mary = fam.members.find(m => m.name === "Mary Thomas");
  assert.ok(mary, "Mary Thomas should be nested under the family");
  assert.equal(mary.relation, "Spouse");

  // Promote Mary to head.
  const setHeadRes = await families.onRequestPost(makeContext({
    db, body: { action: "set_head", familyId, memberId: mary.id }
  }));
  assert.equal((await readJson(setHeadRes)).success, true);

  const afterHead = await readJson(await families.onRequestGet(makeContext({ db })));
  assert.equal(afterHead.families[0].headMemberName, "Mary Thomas");

  // Remove Mary — John should be auto-promoted back to head since he's the only one left.
  const removeRes = await families.onRequestPost(makeContext({
    db, body: { action: "remove_member", memberId: mary.id }
  }));
  assert.equal((await readJson(removeRes)).success, true);

  const afterRemove = await readJson(await families.onRequestGet(makeContext({ db })));
  assert.equal(afterRemove.families[0].memberCount, 1);
  assert.equal(afterRemove.families[0].headMemberName, "John Thomas");
  assert.equal(afterRemove.unassignedMembers.length, 1);
  assert.equal(afterRemove.unassignedMembers[0].name, "Mary Thomas");

  // Delete the family — John should be kept, just unassigned (not deleted).
  const deleteRes = await families.onRequestDelete(makeContext({
    db, url: `https://test.local/api/families?id=${familyId}`
  }));
  assert.equal((await readJson(deleteRes)).success, true);

  const afterDelete = await readJson(await families.onRequestGet(makeContext({ db })));
  assert.equal(afterDelete.families.length, 0);
  assert.equal(afterDelete.unassignedMembers.length, 2);
});

test("families: adding a member whose name already exists elsewhere links instead of duplicating", async () => {
  const db = freshDb();

  // Pre-existing unassigned member (e.g. from the old individual Sandha flow).
  await db.prepare("INSERT INTO members (name, email) VALUES (?, ?)").bind("Grace Paul", "grace@example.com").run();

  const createRes = await families.onRequestPost(makeContext({
    db,
    body: { familyName: "Paul Family", members: [{ name: "Grace Paul", relation: "Head" }] }
  }));
  const created = await readJson(createRes);
  assert.equal(created.success, true, created.message);

  const countRow = await db.prepare("SELECT COUNT(*) AS n FROM members WHERE name = 'Grace Paul'").first();
  assert.equal(countRow.n, 1, "must link the existing member, not create a duplicate");
});

test("families: cannot steal a member who already belongs to another family", async () => {
  const db = freshDb();

  await families.onRequestPost(makeContext({
    db, body: { familyName: "Family A", members: [{ name: "Sam George", relation: "Head" }] }
  }));

  const res = await families.onRequestPost(makeContext({
    db, body: { familyName: "Family B", members: [{ name: "Sam George", relation: "Head" }] }
  }));
  const result = await readJson(res);
  assert.equal(result.success, false);
  assert.match(result.message, /already belongs to another family/);

  // Family B must not have been left behind as an empty shell after the rollback.
  const familiesRow = await db.prepare("SELECT COUNT(*) AS n FROM families WHERE family_name = 'Family B'").first();
  assert.equal(familiesRow.n, 0);
});

test("families: rejects request without manage_members permission", async () => {
  const db = freshDb();
  const res = await families.onRequestPost(makeContext({
    db, authToken: null, body: { familyName: "Should Fail" }
  }));
  assert.equal(res.status, 401);
});

test("families: standalone add_member adds a new person to an existing family", async () => {
  const db = freshDb();
  const create = await readJson(await families.onRequestPost(makeContext({
    db, body: { familyName: "Addable Family", members: [{ name: "Existing Head", relation: "Head" }] }
  })));

  const add = await readJson(await families.onRequestPost(makeContext({
    db, body: { action: "add_member", familyId: create.id, name: "New Kid", relation: "Child" }
  })));
  assert.equal(add.success, true, add.message);

  const list = await readJson(await families.onRequestGet(makeContext({ db })));
  const fam = list.families.find(f => f.id === create.id);
  assert.equal(fam.memberCount, 2);
});

test("families: add_member on a nonexistent family is a 404", async () => {
  const db = freshDb();
  const res = await readJson(await families.onRequestPost(makeContext({
    db, body: { action: "add_member", familyId: 999999, name: "Nobody" }
  })));
  assert.equal(res.success, false);
});

test("families: set_head rejects a member who isn't part of that family", async () => {
  const db = freshDb();
  const famA = await readJson(await families.onRequestPost(makeContext({ db, body: { familyName: "Family A2", members: [{ name: "A2 Head", relation: "Head" }] } })));
  await families.onRequestPost(makeContext({ db, body: { familyName: "Family B2", members: [{ name: "B2 Head", relation: "Head" }] } }));
  const bHead = await db.prepare("SELECT id FROM members WHERE name='B2 Head'").first();

  const res = await readJson(await families.onRequestPost(makeContext({
    db, body: { action: "set_head", familyId: famA.id, memberId: bHead.id }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /not part of this family/);
});

test("families: remove_member on a member with no family is rejected", async () => {
  const db = freshDb();
  const res = await db.prepare("INSERT INTO members (name) VALUES ('No Family Person')").run();
  const result = await readJson(await families.onRequestPost(makeContext({
    db, body: { action: "remove_member", memberId: res.meta.last_row_id }
  })));
  assert.equal(result.success, false);
  assert.match(result.message, /not in a family/);
});

test("families: create rejects an empty familyName", async () => {
  const db = freshDb();
  const res = await readJson(await families.onRequestPost(makeContext({ db, body: { familyName: "   " } })));
  assert.equal(res.success, false);
});

test("families: GET requires view_members permission", async () => {
  const db = freshDb();
  const res = await readJson(await families.onRequestGet(makeContext({ db, authToken: null })));
  assert.equal(res.success, false);
});

test("families: PUT edits family-detail fields", async () => {
  const db = freshDb();
  const create = await readJson(await families.onRequestPost(makeContext({ db, body: { familyName: "Editable Family" } })));
  const res = await readJson(await families.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/families",
    body: { id: create.id, familyName: "Renamed Family", address: "123 Main St" }
  })));
  assert.equal(res.success, true, res.message);

  const row = await db.prepare("SELECT family_name, address FROM families WHERE id=?").bind(create.id).first();
  assert.equal(row.family_name, "Renamed Family");
  assert.equal(row.address, "123 Main St");
});

test("families: PUT with a memberId edits the member's relation/DOB within the family", async () => {
  const db = freshDb();
  const create = await readJson(await families.onRequestPost(makeContext({
    db, body: { familyName: "Member Edit Family", members: [{ name: "Kid To Edit", relation: "Child" }] }
  })));
  const kid = await db.prepare("SELECT id FROM members WHERE name='Kid To Edit'").first();

  const res = await readJson(await families.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/families",
    body: { id: create.id, memberId: kid.id, dateOfBirth: "2015-05-05" }
  })));
  assert.equal(res.success, true, res.message);

  const row = await db.prepare("SELECT date_of_birth FROM members WHERE id=?").bind(kid.id).first();
  assert.equal(row.date_of_birth, "2015-05-05");
});

test("families: PUT on a nonexistent id is a 404, and with no editable fields is a 400", async () => {
  const db = freshDb();
  const missing = await readJson(await families.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/families", body: { id: 999999, familyName: "X" }
  })));
  assert.equal(missing.success, false);

  const create = await readJson(await families.onRequestPost(makeContext({ db, body: { familyName: "No Fields Family" } })));
  const noFields = await readJson(await families.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/families", body: { id: create.id }
  })));
  assert.equal(noFields.success, false);
});

test("families: DELETE on a nonexistent id is a 404, and requires manage_members permission", async () => {
  const db = freshDb();
  const missing = await readJson(await families.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/families?id=999999"
  })));
  assert.equal(missing.success, false);

  const create = await readJson(await families.onRequestPost(makeContext({ db, body: { familyName: "Guarded Family" } })));
  const denied = await readJson(await families.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/families?id=${create.id}`
  })));
  assert.equal(denied.success, false);
});
