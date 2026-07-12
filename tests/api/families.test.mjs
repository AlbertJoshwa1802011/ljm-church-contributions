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
