// Cloudflare Pages Function: /api/prayer
// Milestone v2, Phase 3 — prayer requests. Always private (never public GET);
// persisted first, email sent second, so a mail-provider failure never loses a
// submission (SAFETY-AND-TESTS.md).
//
//   POST /api/prayer          → public: { request, name?, email?, phone?, wantsCallback?, language?, churchId? }
//   GET  /api/prayer          → admin (manage_content): inbox (?status=)
//   PUT  /api/prayer          → admin (manage_content): update status (body.id)

import { requireAuth, audit, json } from "./_lib.js";
import { notifyBoth, escapeHtml } from "./_mail.js";

const VALID_STATUSES = ["new", "praying", "contacted", "closed"];

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toRequest(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    request: row.request,
    wantsCallback: !!row.wants_callback,
    language: row.language,
    churchId: row.church_id,
    status: row.status,
    ackSent: !!row.ack_sent,
    teamNotified: !!row.team_notified,
    createdAt: row.created_at,
    handledBy: row.handled_by,
    handledAt: row.handled_at
  };
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  try {
    const body = await request.json();
    const requestText = String(body.request || "").trim();
    if (!requestText) return json({ success: false, message: "request is required" }, 400);
    if (requestText.length > 4000) return json({ success: false, message: "request is too long" }, 400);

    const email = body.email ? String(body.email).trim() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "email must be valid" }, 400);
    }

    // Persist first — the record must exist even if mail fails below.
    const res = await db.prepare(
      `INSERT INTO prayer_requests (name, email, phone, request, wants_callback, language, church_id, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(body.name || "").trim().slice(0, 200) || null, email, body.phone || null, requestText,
      body.wantsCallback ? 1 : 0, body.language === "ta" ? "ta" : "en",
      body.churchId ? Number(body.churchId) : null,
      request.headers.get("CF-Connecting-IP") || ""
    ).run();

    const id = res.meta && res.meta.last_row_id;

    const { ack, team } = await notifyBoth(env, {
      senderEmail: email,
      ackSubject: "We received your prayer request",
      ackHtml: `<p>Dear ${escapeHtml(body.name || "friend")},</p><p>Thank you for trusting us with your prayer request. Our prayer team is standing with you.</p><p><em>"${escapeHtml(requestText)}"</em></p><p>— Light of Jesus Ministry</p>`,
      teamSubject: "New prayer request",
      teamHtml: `<p><strong>${escapeHtml(body.name || "Anonymous")}</strong> (${escapeHtml(email || "no email")}${body.phone ? ", " + escapeHtml(body.phone) : ""}) submitted a prayer request${body.wantsCallback ? " and requested a callback" : ""}:</p><p>${escapeHtml(requestText)}</p>`
    });

    if (ack.ok || team.ok) {
      await db.prepare("UPDATE prayer_requests SET ack_sent=?, team_notified=? WHERE id=?")
        .bind(ack.ok ? 1 : 0, team.ok ? 1 : 0, id).run();
    }

    await audit(context, {
      actorEmail: null, actorType: "public", verified: false,
      action: "prayer.submit", entityType: "prayer_request", entityId: id,
      details: { wantsCallback: !!body.wantsCallback, ackSent: ack.ok, teamNotified: team.ok }
    });

    return json({ success: true, id, message: "Your prayer request has been received." }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const status = new URL(request.url).searchParams.get("status");
    let sql = "SELECT * FROM prayer_requests";
    const binds = [];
    if (status && VALID_STATUSES.includes(status)) { sql += " WHERE status=?"; binds.push(status); }
    sql += " ORDER BY (status='new') DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...binds).all();
    return json({ success: true, requests: (q.results || []).map(toRequest) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Request id is required" }, 400);
    if (!VALID_STATUSES.includes(body.status)) return json({ success: false, message: "Invalid status" }, 400);

    const res = await db.prepare(
      "UPDATE prayer_requests SET status=?, handled_by=?, handled_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(body.status, auth.email, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Request not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "prayer.update_status", entityType: "prayer_request", entityId: id, details: { status: body.status }
    });

    return json({ success: true, message: "Prayer request updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
