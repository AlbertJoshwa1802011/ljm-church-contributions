// Cloudflare Pages Function: /api/members
// GET — fast member directory with computed contribution stats (view_members permission).
// POST — add a new believer/member (view_members permission, audited).
// PUT — edit a member's contact/preferences (view_members permission, audited).

import { requireAuth, audit, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_members");
  if (!auth.ok) return auth.response;

  try {
    // One pass: profile + aggregate stats (idx_contrib_member keeps this fast)
    const membersQuery = await db.prepare(
      `SELECT m.id, m.name, m.email, m.phone, m.is_verified AS isVerified,
              m.first_join_date AS firstJoinDate, m.recurring_reminders AS recurringReminders,
              COUNT(c.id) AS totalContributions,
              COALESCE(SUM(c.amount), 0) AS totalAmount,
              MAX(c.date) AS lastContributionDate
       FROM members m
       LEFT JOIN contributions c ON c.member_name = m.name
       GROUP BY m.id
       ORDER BY totalAmount DESC, m.name ASC`
    ).all();

    // Per-fund breakdown in a single grouped query, stitched client-side of the API
    const byFundQuery = await db.prepare(
      `SELECT member_name AS name, fund, COUNT(id) AS count, SUM(amount) AS amount
       FROM contributions GROUP BY member_name, fund`
    ).all();

    const fundBreakdown = {};
    (byFundQuery.results || []).forEach(r => {
      if (!fundBreakdown[r.name]) fundBreakdown[r.name] = {};
      fundBreakdown[r.name][r.fund] = { count: r.count, amount: r.amount };
    });

    const members = (membersQuery.results || []).map(m => ({
      ...m,
      funds: fundBreakdown[m.name] || {}
    }));

    return json({ success: true, members, count: members.length }, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// Add a new believer — used by the pastor from the admin Sandha/Members screens.
export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_members");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = String(body.name || "").trim().substring(0, 120);
    if (!name) return json({ success: false, message: "Name is required" }, 400);

    const email = String(body.email || "").trim().toLowerCase().substring(0, 200);
    const phone = String(body.phone || "").trim().substring(0, 30);
    const firstJoinDate = String(body.firstJoinDate || "").trim().substring(0, 10);

    const existing = await db.prepare("SELECT id FROM members WHERE LOWER(name) = LOWER(?)").bind(name).first();
    if (existing) return json({ success: false, message: `A member named '${name}' already exists` }, 409);

    const res = await db.prepare(
      "INSERT INTO members (name, email, phone, is_verified, first_join_date) VALUES (?, ?, ?, ?, ?)"
    ).bind(name, email, phone, email && phone ? 1 : 0, firstJoinDate || null).run();
    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "member.add", entityType: "member", entityId: String(id),
      details: { name, email, phone }
    });

    return json({ success: true, message: `Member '${name}' added`, id });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_members");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Missing member id" }, 400);

    const member = await db.prepare("SELECT id, name, email, phone, recurring_reminders FROM members WHERE id = ?")
      .bind(id).first();
    if (!member) return json({ success: false, message: "Member not found" }, 404);

    const changes = {};
    if (body.email != null) changes.email = String(body.email).trim().toLowerCase();
    if (body.phone != null) changes.phone = String(body.phone).trim();
    if (body.recurringReminders != null) {
      changes.recurring_reminders = body.recurringReminders === "Yes" || body.recurringReminders === true ? "Yes" : "No";
    }
    if (body.isVerified != null) changes.is_verified = body.isVerified ? 1 : 0;

    if (Object.keys(changes).length === 0) {
      return json({ success: false, message: "No editable fields provided" }, 400);
    }

    const setClause = Object.keys(changes).map(k => `${k} = ?`).join(", ");
    await db.prepare(`UPDATE members SET ${setClause} WHERE id = ?`)
      .bind(...Object.values(changes), id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "member.update", entityType: "member", entityId: id,
      details: { name: member.name, before: { email: member.email, phone: member.phone, recurring_reminders: member.recurring_reminders }, after: changes }
    });

    return json({ success: true, message: `Member '${member.name}' updated` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
