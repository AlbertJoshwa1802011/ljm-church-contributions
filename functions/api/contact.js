// Cloudflare Pages Function: /api/contact
// Milestone v2, Phase 3 — contact messages. Persisted first, email sent second
// (SAFETY-AND-TESTS.md): a mail-provider failure never loses a submission.
//
//   POST /api/contact          → public: { name, email, subject?, message, churchId?, language? }
//   GET  /api/contact          → admin (manage_content): inbox (?status=)
//   PUT  /api/contact          → admin (manage_content): update status (body.id)

import { requireAuth, audit, json } from "./_lib.js";
import { notifyBoth, escapeHtml } from "./_mail.js";

const VALID_STATUSES = ["new", "acknowledged", "replied", "closed"];

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toMessage(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    churchId: row.church_id,
    language: row.language,
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
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "A valid email is required" }, 400);
    }
    if (!message) return json({ success: false, message: "message is required" }, 400);
    if (message.length > 4000) return json({ success: false, message: "message is too long" }, 400);

    const res = await db.prepare(
      `INSERT INTO contact_messages (name, email, subject, message, church_id, language, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(body.name || "").trim().slice(0, 200) || null, email,
      String(body.subject || "").trim().slice(0, 300) || null, message,
      body.churchId ? Number(body.churchId) : null, body.language === "ta" ? "ta" : "en",
      request.headers.get("CF-Connecting-IP") || ""
    ).run();

    const id = res.meta && res.meta.last_row_id;

    const { ack, team } = await notifyBoth(env, {
      senderEmail: email,
      ackSubject: "We received your message",
      ackHtml: `<p>Dear ${escapeHtml(body.name || "friend")},</p><p>Thank you for reaching out to Light of Jesus Ministry. We've received your message and our team will respond soon.</p><p><em>"${escapeHtml(message)}"</em></p>`,
      teamSubject: `New contact message${body.subject ? ": " + body.subject : ""}`,
      teamHtml: `<p><strong>${escapeHtml(body.name || "Anonymous")}</strong> (${escapeHtml(email)}) wrote:</p><p>${escapeHtml(message)}</p>`
    });

    if (ack.ok || team.ok) {
      await db.prepare("UPDATE contact_messages SET ack_sent=?, team_notified=? WHERE id=?")
        .bind(ack.ok ? 1 : 0, team.ok ? 1 : 0, id).run();
    }

    await audit(context, {
      actorEmail: null, actorType: "public", verified: false,
      action: "contact.submit", entityType: "contact_message", entityId: id,
      details: { ackSent: ack.ok, teamNotified: team.ok }
    });

    return json({ success: true, id, message: "Your message has been sent." }, 200, corsHeaders());
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
    let sql = "SELECT * FROM contact_messages";
    const binds = [];
    if (status && VALID_STATUSES.includes(status)) { sql += " WHERE status=?"; binds.push(status); }
    sql += " ORDER BY (status='new') DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...binds).all();
    return json({ success: true, messages: (q.results || []).map(toMessage) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
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
    if (!id) return json({ success: false, message: "Message id is required" }, 400);
    if (!VALID_STATUSES.includes(body.status)) return json({ success: false, message: "Invalid status" }, 400);

    const res = await db.prepare(
      "UPDATE contact_messages SET status=?, handled_by=?, handled_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(body.status, auth.email, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Message not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contact.update_status", entityType: "contact_message", entityId: id, details: { status: body.status }
    });

    return json({ success: true, message: "Message updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
