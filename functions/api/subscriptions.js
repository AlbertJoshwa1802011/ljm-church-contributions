// Cloudflare Pages Function: /api/subscriptions
// Subscriptions — monthly membership dues, billed per family (paid by the family
// head) once believers are grouped into a household; a member not yet
// grouped into any family is still billed and tracked individually, exactly
// as before. Everyone can see who/which family has paid and who is pending
// (explicitly requested: the whole church should see monthly Subscriptions status).
//
//   GET  /api/subscriptions?month=YYYY-MM   → { month, amount,
//                                         paid:[...], pending:[...],            (ungrouped individuals)
//                                         families:{ paid:[...], pending:[...] },
//                                         totals, months:[...] }
//   GET  /api/subscriptions?member=Name     → that member's (or their family's) paid months for the year
//   POST { action:'mark_paid', memberId?, familyId?, month, amount?, method?, notes?, paidByMemberId? }  (manage_subscriptions)
//   POST { action:'unmark',    memberId?, familyId?, month }                                              (manage_subscriptions)

import { requireAuth, audit, json } from "./_lib.js";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonth() {
  return new Date().toISOString().substring(0, 7);
}

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

async function getSubscriptionsAmount(db) {
  const row = await db.prepare("SELECT value FROM config WHERE key = 'sandha_amount'").first();
  return Number(row && row.value) || 0;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const memberName = (url.searchParams.get("member") || "").trim();

  try {
    // ── Personal history: months this member (or their family) paid in the requested year ──
    if (memberName) {
      const year = (url.searchParams.get("year") || new Date().getFullYear().toString()).substring(0, 4);
      const member = await db.prepare("SELECT id, family_id FROM members WHERE LOWER(name) = LOWER(?)").bind(memberName).first();

      let rows, familyName = null;
      if (member && member.family_id) {
        const fam = await db.prepare("SELECT family_name FROM families WHERE id = ?").bind(member.family_id).first();
        familyName = fam ? fam.family_name : null;
        rows = await db.prepare(
          `SELECT month, amount, paid_on AS paidOn, method
           FROM sandha_family_payments WHERE family_id = ? AND month LIKE ? ORDER BY month`
        ).bind(member.family_id, `${year}-%`).all();
      } else {
        rows = await db.prepare(
          `SELECT sp.month, sp.amount, sp.paid_on AS paidOn, sp.method
           FROM sandha_payments sp JOIN members m ON m.id = sp.member_id
           WHERE LOWER(m.name) = LOWER(?) AND sp.month LIKE ?
           ORDER BY sp.month`
        ).bind(memberName, `${year}-%`).all();
      }

      return json({
        success: true,
        member: memberName,
        familyName,
        isFamilyBased: !!familyName,
        year,
        amount: await getSubscriptionsAmount(db),
        paidMonths: rows.results || []
      }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    // ── Month view: paid + pending for every ungrouped member, and every family ──
    let month = (url.searchParams.get("month") || currentMonth()).trim();
    if (!MONTH_RE.test(month)) month = currentMonth();

    const amount = await getSubscriptionsAmount(db);

    // Ungrouped individuals only (family_id IS NULL) — members in a family are
    // billed at the family level below, not tracked individually anymore.
    const paidQ = await db.prepare(
      `SELECT m.id, m.name, sp.amount, sp.paid_on AS paidOn, sp.method
       FROM sandha_payments sp JOIN members m ON m.id = sp.member_id
       WHERE sp.month = ? AND m.family_id IS NULL
       ORDER BY m.name COLLATE NOCASE`
    ).bind(month).all();
    const paid = paidQ.results || [];

    const pendingQ = await db.prepare(
      `SELECT id, name FROM members
       WHERE family_id IS NULL AND name NOT LIKE 'ZZ Selftest%'
         AND id NOT IN (SELECT member_id FROM sandha_payments WHERE month = ?)
       ORDER BY name COLLATE NOCASE`
    ).bind(month).all();
    const pending = pendingQ.results || [];

    // Families: paid vs pending for the month.
    const familiesQ = await db.prepare(
      `SELECT f.id, f.family_name AS familyName, f.head_member_id AS headMemberId,
              (SELECT name FROM members WHERE id = f.head_member_id) AS headMemberName,
              (SELECT COUNT(*) FROM members WHERE family_id = f.id) AS memberCount,
              sfp.amount, sfp.paid_on AS paidOn, sfp.method
       FROM families f
       LEFT JOIN sandha_family_payments sfp ON sfp.family_id = f.id AND sfp.month = ?
       WHERE f.status != 'archived'
       ORDER BY f.family_name COLLATE NOCASE`
    ).bind(month).all();
    const allFamilies = familiesQ.results || [];
    const familiesPaid = allFamilies.filter(f => f.paidOn != null || f.method != null || f.amount != null);
    const familiesPending = allFamilies.filter(f => !(f.paidOn != null || f.method != null || f.amount != null))
      .map(f => ({ id: f.id, familyName: f.familyName, headMemberId: f.headMemberId, headMemberName: f.headMemberName, memberCount: f.memberCount }));

    // Which months have any activity (individual or family) — for the month selector.
    const monthsQ = await db.prepare(
      `SELECT month FROM sandha_payments
       UNION SELECT month FROM sandha_family_payments
       ORDER BY month DESC LIMIT 24`
    ).all();
    const months = (monthsQ.results || []).map(r => r.month);
    if (!months.includes(month)) months.unshift(month);

    const individualCollected = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const familyCollected = familiesPaid.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    return json({
      success: true,
      month,
      amount,
      paid,
      pending: pending.map(p => ({ id: p.id, name: p.name })),
      families: { paid: familiesPaid, pending: familiesPending },
      totals: {
        paidCount: paid.length + familiesPaid.length,
        pendingCount: pending.length + familiesPending.length,
        collected: Math.round((individualCollected + familyCollected) * 100) / 100
      },
      months
    }, 200, corsHeaders({ "Cache-Control": "no-store" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_subscriptions");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action;
    const month = String(body.month || "").trim();
    const familyId = body.familyId != null ? Number(body.familyId) : null;
    const memberId = body.memberId != null ? Number(body.memberId) : null;

    if ((!familyId && !memberId) || !MONTH_RE.test(month)) {
      return json({ success: false, message: "familyId or memberId, and month (YYYY-MM), are required" }, 400);
    }

    // ── Family-level Subscriptions ──
    if (familyId) {
      const family = await db.prepare("SELECT id, family_name, head_member_id FROM families WHERE id = ?").bind(familyId).first();
      if (!family) return json({ success: false, message: "Family not found" }, 404);

      if (action === "mark_paid") {
        const configured = await getSubscriptionsAmount(db);
        const amount = body.amount != null && isFinite(Number(body.amount)) && Number(body.amount) >= 0
          ? Number(body.amount) : configured;
        const method = ["cash", "online"].includes(body.method) ? body.method : "cash";
        const paidOn = String(body.paidOn || new Date().toISOString().substring(0, 10)).substring(0, 10);
        const notes = String(body.notes || "").substring(0, 300);
        const paidByMemberId = body.paidByMemberId != null ? Number(body.paidByMemberId) : family.head_member_id;

        await db.prepare(
          `INSERT INTO sandha_family_payments (family_id, month, amount, paid_on, method, paid_by_member_id, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(family_id, month) DO UPDATE SET
             amount = excluded.amount, paid_on = excluded.paid_on, method = excluded.method,
             paid_by_member_id = excluded.paid_by_member_id, notes = excluded.notes, recorded_by = excluded.recorded_by`
        ).bind(familyId, month, amount, paidOn, method, paidByMemberId, notes, auth.email).run();

        await audit(context, {
          actorEmail: auth.email, actorType: "admin", verified: auth.verified,
          action: "subscriptions.family_mark_paid", entityType: "family", entityId: `${familyId}:${month}`,
          details: { family: family.family_name, month, amount, method }
        });
        return json({ success: true, message: `${family.family_name} marked paid for ${month}` }, 200, corsHeaders());
      }

      if (action === "unmark") {
        const res = await db.prepare("DELETE FROM sandha_family_payments WHERE family_id = ? AND month = ?")
          .bind(familyId, month).run();
        if (!res.meta || res.meta.changes === 0) {
          return json({ success: false, message: "No Subscriptions record for that family/month" }, 404);
        }
        await audit(context, {
          actorEmail: auth.email, actorType: "admin", verified: auth.verified,
          action: "subscriptions.family_unmark", entityType: "family", entityId: `${familyId}:${month}`,
          details: { family: family.family_name, month }
        });
        return json({ success: true, message: `${family.family_name} unmarked for ${month}` }, 200, corsHeaders());
      }

      return json({ success: false, message: "Unknown action" }, 400);
    }

    // ── Individual Subscriptions (member not yet grouped into a family) ──
    const member = await db.prepare("SELECT id, name, family_id FROM members WHERE id = ?").bind(memberId).first();
    if (!member) return json({ success: false, message: "Member not found" }, 404);
    if (member.family_id) {
      return json({ success: false, message: `${member.name} is part of a family now — mark Subscriptions paid for the family instead` }, 400);
    }

    if (action === "mark_paid") {
      const configured = await getSubscriptionsAmount(db);
      const amount = body.amount != null && isFinite(Number(body.amount)) && Number(body.amount) >= 0
        ? Number(body.amount)
        : configured;
      const method = ["cash", "online"].includes(body.method) ? body.method : "cash";
      const paidOn = String(body.paidOn || new Date().toISOString().substring(0, 10)).substring(0, 10);
      const notes = String(body.notes || "").substring(0, 300);

      // UNIQUE(member_id, month) makes re-marking an update, not a duplicate.
      await db.prepare(
        `INSERT INTO sandha_payments (member_id, month, amount, paid_on, method, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(member_id, month) DO UPDATE SET
           amount = excluded.amount, paid_on = excluded.paid_on,
           method = excluded.method, notes = excluded.notes, recorded_by = excluded.recorded_by`
      ).bind(memberId, month, amount, paidOn, method, notes, auth.email).run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "subscriptions.mark_paid", entityType: "subscriptions", entityId: `${memberId}:${month}`,
        details: { member: member.name, month, amount, method }
      });
      return json({ success: true, message: `${member.name} marked paid for ${month}` }, 200, corsHeaders());
    }

    if (action === "unmark") {
      const res = await db.prepare("DELETE FROM sandha_payments WHERE member_id = ? AND month = ?")
        .bind(memberId, month).run();
      if (!res.meta || res.meta.changes === 0) {
        return json({ success: false, message: "No Subscriptions record for that member/month" }, 404);
      }
      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "subscriptions.unmark", entityType: "subscriptions", entityId: `${memberId}:${month}`,
        details: { member: member.name, month }
      });
      return json({ success: true, message: `${member.name} unmarked for ${month}` }, 200, corsHeaders());
    }

    return json({ success: false, message: "Unknown action" }, 400);
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
