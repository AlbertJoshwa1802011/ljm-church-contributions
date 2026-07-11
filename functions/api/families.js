// Cloudflare Pages Function: /api/families
// Family/household management: group believers into families, track relation
// and date of birth, and designate a family head. Sandha (monthly dues) is
// charged per family once members are grouped — see /api/sandha for that.
//
// GET    — list families (with nested members) + still-unassigned members (view_members).
// POST   — create a family (with optional initial members), or an action:
//          add_member / set_head / remove_member / delete_family (manage_members).
// PUT    — update a family's own details (manage_members).
// DELETE — delete a family, unassigning its members back to the unassigned pool (manage_members).

import { requireAuth, audit, json } from "./_lib.js";

const RELATIONS = ["Head", "Spouse", "Child", "Parent", "Other"];

function cleanRelation(r) {
  return RELATIONS.includes(r) ? r : "Other";
}

// Find an existing member by exact case-insensitive name, or create a new one.
// Returns { id, isNew, alreadyInOtherFamily }.
async function resolveMember(db, { existingMemberId, name, email, phone }, targetFamilyId) {
  if (existingMemberId) {
    const m = await db.prepare("SELECT id, name, family_id FROM members WHERE id = ?").bind(existingMemberId).first();
    if (!m) return { error: `Member id ${existingMemberId} not found` };
    if (m.family_id && m.family_id !== targetFamilyId) return { error: `${m.name} already belongs to another family` };
    return { id: m.id, isNew: false };
  }

  const trimmedName = String(name || "").trim().substring(0, 120);
  if (!trimmedName) return { error: "Each family member needs a name" };

  const existing = await db.prepare("SELECT id, family_id, name FROM members WHERE LOWER(name) = LOWER(?)").bind(trimmedName).first();
  if (existing) {
    if (existing.family_id && existing.family_id !== targetFamilyId) {
      return { error: `${existing.name} already belongs to another family — remove them from it first` };
    }
    return { id: existing.id, isNew: false };
  }

  const cleanEmail = String(email || "").trim().toLowerCase().substring(0, 200);
  const cleanPhone = String(phone || "").trim().substring(0, 30);
  const res = await db.prepare(
    "INSERT INTO members (name, email, phone, is_verified) VALUES (?, ?, ?, ?)"
  ).bind(trimmedName, cleanEmail, cleanPhone, cleanEmail && cleanPhone ? 1 : 0).run();

  return { id: res.meta && res.meta.last_row_id, isNew: true };
}

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_members");
  if (!auth.ok) return auth.response;

  try {
    const familiesQuery = await db.prepare(
      `SELECT id, family_name AS familyName, head_member_id AS headMemberId, address,
              primary_phone AS primaryPhone, primary_email AS primaryEmail, notes, status,
              created_by AS createdBy, created_at AS createdAt
       FROM families WHERE status != 'archived' ORDER BY family_name ASC`
    ).all();

    const membersQuery = await db.prepare(
      `SELECT id, name, email, phone, is_verified AS isVerified, family_id AS familyId,
              relation, date_of_birth AS dateOfBirth
       FROM members ORDER BY name ASC`
    ).all();

    const allMembers = membersQuery.results || [];
    const byFamily = {};
    allMembers.forEach(m => {
      if (!m.familyId) return;
      (byFamily[m.familyId] = byFamily[m.familyId] || []).push(m);
    });

    const families = (familiesQuery.results || []).map(f => {
      const members = byFamily[f.id] || [];
      const head = members.find(m => m.id === f.headMemberId);
      return {
        ...f,
        headMemberName: head ? head.name : null,
        memberCount: members.length,
        members
      };
    });

    const unassignedMembers = allMembers.filter(m => !m.familyId);

    return json({ success: true, families, unassignedMembers, count: families.length }, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_members");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action || "create";

    // ── Add a (new or existing) member to an existing family ──
    if (action === "add_member") {
      const familyId = Number(body.familyId);
      if (!familyId) return json({ success: false, message: "Missing familyId" }, 400);
      const family = await db.prepare("SELECT id, family_name FROM families WHERE id = ?").bind(familyId).first();
      if (!family) return json({ success: false, message: "Family not found" }, 404);

      const resolved = await resolveMember(db, body, familyId);
      if (resolved.error) return json({ success: false, message: resolved.error }, 400);

      const relation = cleanRelation(body.relation);
      const dob = String(body.dateOfBirth || "").trim().substring(0, 10) || null;
      await db.prepare("UPDATE members SET family_id = ?, relation = ?, date_of_birth = ? WHERE id = ?")
        .bind(familyId, relation, dob, resolved.id).run();

      if (relation === "Head") {
        await db.prepare("UPDATE families SET head_member_id = ? WHERE id = ?").bind(resolved.id, familyId).run();
      } else {
        // First member ever added to a family becomes the head by default.
        const headCheck = await db.prepare("SELECT head_member_id FROM families WHERE id = ?").bind(familyId).first();
        if (!headCheck.head_member_id) {
          await db.prepare("UPDATE families SET head_member_id = ? WHERE id = ?").bind(resolved.id, familyId).run();
        }
      }

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "family.member_add", entityType: "family", entityId: familyId,
        details: { memberId: resolved.id, relation }
      });

      return json({ success: true, message: `Added to ${family.family_name}`, memberId: resolved.id });
    }

    // ── Set which member is the family head (who Sandha is billed to) ──
    if (action === "set_head") {
      const familyId = Number(body.familyId);
      const memberId = Number(body.memberId);
      if (!familyId || !memberId) return json({ success: false, message: "Missing familyId or memberId" }, 400);

      const member = await db.prepare("SELECT id, family_id, name FROM members WHERE id = ?").bind(memberId).first();
      if (!member || member.family_id !== familyId) {
        return json({ success: false, message: "That member is not part of this family" }, 400);
      }

      await db.prepare("UPDATE families SET head_member_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(memberId, auth.email, familyId).run();
      await db.prepare("UPDATE members SET relation = 'Head' WHERE id = ?").bind(memberId).run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "family.set_head", entityType: "family", entityId: familyId, details: { memberId }
      });

      return json({ success: true, message: `${member.name} is now the family head` });
    }

    // ── Remove a member from their family (member record itself is kept, just unassigned) ──
    if (action === "remove_member") {
      const memberId = Number(body.memberId);
      if (!memberId) return json({ success: false, message: "Missing memberId" }, 400);

      const member = await db.prepare("SELECT id, name, family_id FROM members WHERE id = ?").bind(memberId).first();
      if (!member || !member.family_id) return json({ success: false, message: "Member is not in a family" }, 400);

      const familyId = member.family_id;
      await db.prepare("UPDATE members SET family_id = NULL, relation = NULL, date_of_birth = NULL WHERE id = ?").bind(memberId).run();

      const family = await db.prepare("SELECT head_member_id FROM families WHERE id = ?").bind(familyId).first();
      if (family && family.head_member_id === memberId) {
        // Promote the next remaining member (if any) to head so the family always has one.
        const next = await db.prepare("SELECT id FROM members WHERE family_id = ? ORDER BY id ASC LIMIT 1").bind(familyId).first();
        await db.prepare("UPDATE families SET head_member_id = ? WHERE id = ?").bind(next ? next.id : null, familyId).run();
        if (next) await db.prepare("UPDATE members SET relation = 'Head' WHERE id = ?").bind(next.id).run();
      }

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "family.member_remove", entityType: "family", entityId: familyId, details: { memberId, name: member.name }
      });

      return json({ success: true, message: `${member.name} removed from family` });
    }

    // ── Create a new family, optionally with initial members ──
    const familyName = String(body.familyName || "").trim().substring(0, 150);
    if (!familyName) return json({ success: false, message: "Family name is required" }, 400);

    const insertFamily = await db.prepare(
      `INSERT INTO families (family_name, address, primary_phone, primary_email, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      familyName,
      String(body.address || "").trim(),
      String(body.primaryPhone || "").trim(),
      String(body.primaryEmail || "").trim().toLowerCase(),
      String(body.notes || "").trim(),
      auth.email
    ).run();
    const familyId = insertFamily.meta && insertFamily.meta.last_row_id;

    const members = Array.isArray(body.members) ? body.members.slice(0, 40) : [];
    let headMemberId = null;
    const addedMembers = [];

    for (const entry of members) {
      const resolved = await resolveMember(db, entry, familyId);
      if (resolved.error) {
        // Roll back the family shell so we don't leave an empty, broken record behind.
        await db.prepare("DELETE FROM families WHERE id = ?").bind(familyId).run();
        return json({ success: false, message: resolved.error }, 400);
      }
      const relation = cleanRelation(entry.relation);
      const dob = String(entry.dateOfBirth || "").trim().substring(0, 10) || null;
      await db.prepare("UPDATE members SET family_id = ?, relation = ?, date_of_birth = ? WHERE id = ?")
        .bind(familyId, relation, dob, resolved.id).run();
      addedMembers.push({ id: resolved.id, relation });
      if (relation === "Head" || !headMemberId) headMemberId = resolved.id;
    }

    if (headMemberId) {
      await db.prepare("UPDATE families SET head_member_id = ? WHERE id = ?").bind(headMemberId, familyId).run();
      await db.prepare("UPDATE members SET relation = 'Head' WHERE id = ? AND family_id = ?").bind(headMemberId, familyId).run();
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "family.create", entityType: "family", entityId: familyId,
      details: { familyName, memberCount: addedMembers.length }
    });

    return json({ success: true, message: `Family '${familyName}' created`, id: familyId, members: addedMembers });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_members");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Missing family id" }, 400);

    const family = await db.prepare("SELECT * FROM families WHERE id = ?").bind(id).first();
    if (!family) return json({ success: false, message: "Family not found" }, 404);

    // Editing a member's own relation/DOB within the family (kept here, not in
    // members.js, since these are family-membership fields, not contact fields).
    if (body.memberId) {
      const memberId = Number(body.memberId);
      const member = await db.prepare("SELECT id, family_id FROM members WHERE id = ?").bind(memberId).first();
      if (!member || member.family_id !== id) return json({ success: false, message: "That member is not part of this family" }, 400);

      const relation = body.relation != null ? cleanRelation(body.relation) : null;
      const dob = body.dateOfBirth != null ? String(body.dateOfBirth).trim().substring(0, 10) || null : undefined;
      const changes = {};
      if (relation) changes.relation = relation;
      if (dob !== undefined) changes.date_of_birth = dob;
      if (Object.keys(changes).length === 0) return json({ success: false, message: "No editable fields provided" }, 400);

      const setClause = Object.keys(changes).map(k => `${k} = ?`).join(", ");
      await db.prepare(`UPDATE members SET ${setClause} WHERE id = ?`).bind(...Object.values(changes), memberId).run();
      if (relation === "Head") {
        await db.prepare("UPDATE families SET head_member_id = ? WHERE id = ?").bind(memberId, id).run();
      }

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "family.member_update", entityType: "family", entityId: id, details: { memberId, ...changes }
      });

      return json({ success: true, message: "Member updated" });
    }

    // Editing the family's own details.
    const changes = {};
    if (body.familyName != null) changes.family_name = String(body.familyName).trim().substring(0, 150);
    if (body.address != null) changes.address = String(body.address).trim();
    if (body.primaryPhone != null) changes.primary_phone = String(body.primaryPhone).trim();
    if (body.primaryEmail != null) changes.primary_email = String(body.primaryEmail).trim().toLowerCase();
    if (body.notes != null) changes.notes = String(body.notes).trim();
    if (body.status && ["active", "archived"].includes(body.status)) changes.status = body.status;

    if (Object.keys(changes).length === 0) return json({ success: false, message: "No editable fields provided" }, 400);
    if (changes.family_name === "") return json({ success: false, message: "Family name cannot be empty" }, 400);

    const setClause = Object.keys(changes).map(k => `${k} = ?`).join(", ");
    await db.prepare(`UPDATE families SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...Object.values(changes), auth.email, id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "family.update", entityType: "family", entityId: id, details: changes
    });

    return json({ success: true, message: `Family '${family.family_name}' updated` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_members");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return json({ success: false, message: "Missing family id" }, 400);

    const family = await db.prepare("SELECT id, family_name FROM families WHERE id = ?").bind(id).first();
    if (!family) return json({ success: false, message: "Family not found" }, 404);

    // Unassign members first (never delete member/contribution history), then drop the family shell.
    await db.prepare("UPDATE members SET family_id = NULL, relation = NULL, date_of_birth = NULL WHERE family_id = ?").bind(id).run();
    await db.prepare("DELETE FROM families WHERE id = ?").bind(id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "family.delete", entityType: "family", entityId: id, details: { familyName: family.family_name }
    });

    return json({ success: true, message: `Family '${family.family_name}' deleted. Members were kept and unassigned.` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
