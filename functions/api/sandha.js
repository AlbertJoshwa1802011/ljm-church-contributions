// Cloudflare Pages Function: /api/sandha
// Sandha — monthly membership dues. The pastor (manage_sandha) marks members
// paid/unpaid per month; everyone can see who has paid and who is pending
// (explicitly requested: the whole church should see monthly Sandha status).
//
//   GET  /api/sandha?month=YYYY-MM       → { month, amount, paid:[{id,name,paidOn,method,amount}],
//                                            pending:[{id,name}], totals, months:[...] }
//   GET  /api/sandha?member=Name         → that member's paid months for the current year
//   POST { action:'mark_paid',  memberId, month, amount?, method?, notes? }   (manage_sandha)
//   POST { action:'unmark',     memberId, month }                             (manage_sandha)

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

async function getSandhaAmount(db) {
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
    // ── Personal history: months this member paid in the requested year ──
    if (memberName) {
      const year = (url.searchParams.get("year") || new Date().getFullYear().toString()).substring(0, 4);
      const rows = await db.prepare(
        `SELECT sp.month, sp.amount, sp.paid_on AS paidOn, sp.method
         FROM sandha_payments sp JOIN members m ON m.id = sp.member_id
         WHERE LOWER(m.name) = LOWER(?) AND sp.month LIKE ?
         ORDER BY sp.month`
      ).bind(memberName, `${year}-%`).all();
      return json({
        success: true,
        member: memberName,
        year,
        amount: await getSandhaAmount(db),
        paidMonths: rows.results || []
      }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    // ── Month view: paid + pending for every member ──
    let month = (url.searchParams.get("month") || currentMonth()).trim();
    if (!MONTH_RE.test(month)) month = currentMonth();

    const amount = await getSandhaAmount(db);

    const paidQ = await db.prepare(
      `SELECT m.id, m.name, sp.amount, sp.paid_on AS paidOn, sp.method
       FROM sandha_payments sp JOIN members m ON m.id = sp.member_id
       WHERE sp.month = ?
       ORDER BY m.name COLLATE NOCASE`
    ).bind(month).all();
    const paid = paidQ.results || [];

    const pendingQ = await db.prepare(
      `SELECT id, name FROM members
       WHERE name NOT LIKE 'ZZ Selftest%'
         AND id NOT IN (SELECT member_id FROM sandha_payments WHERE month = ?)
       ORDER BY name COLLATE NOCASE`
    ).bind(month).all();
    const pending = pendingQ.results || [];

    // Which months have any activity (for the month selector)
    const monthsQ = await db.prepare(
      "SELECT DISTINCT month FROM sandha_payments ORDER BY month DESC LIMIT 24"
    ).all();
    const months = (monthsQ.results || []).map(r => r.month);
    if (!months.includes(month)) months.unshift(month);

    const collected = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    return json({
      success: true,
      month,
      amount,
      paid,
      pending: pending.map(p => ({ id: p.id, name: p.name })),
      totals: {
        paidCount: paid.length,
        pendingCount: pending.length,
        collected: Math.round(collected * 100) / 100
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

  const auth = await requireAuth(context, "manage_sandha");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action;
    const memberId = Number(body.memberId);
    const month = String(body.month || "").trim();

    if (!memberId || !MONTH_RE.test(month)) {
      return json({ success: false, message: "memberId and month (YYYY-MM) are required" }, 400);
    }

    const member = await db.prepare("SELECT id, name FROM members WHERE id = ?").bind(memberId).first();
    if (!member) return json({ success: false, message: "Member not found" }, 404);

    if (action === "mark_paid") {
      const configured = await getSandhaAmount(db);
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
        action: "sandha.mark_paid", entityType: "sandha", entityId: `${memberId}:${month}`,
        details: { member: member.name, month, amount, method }
      });
      return json({ success: true, message: `${member.name} marked paid for ${month}` }, 200, corsHeaders());
    }

    if (action === "unmark") {
      const res = await db.prepare("DELETE FROM sandha_payments WHERE member_id = ? AND month = ?")
        .bind(memberId, month).run();
      if (!res.meta || res.meta.changes === 0) {
        return json({ success: false, message: "No Sandha record for that member/month" }, 404);
      }
      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "sandha.unmark", entityType: "sandha", entityId: `${memberId}:${month}`,
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
