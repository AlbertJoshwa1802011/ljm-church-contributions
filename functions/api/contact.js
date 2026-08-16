// Cloudflare Pages Function: /api/contact
// "Contact" flow — PRD §7.6, schema doc §2.5.
//
//   POST /api/contact           → public: submit. Persisted FIRST, then a best-effort
//                                  noreply acknowledgement to the sender + a team
//                                  notification (see _mail.js — a mail failure never
//                                  loses the message).
//   GET  /api/contact           → admin (manage_content): inbox, newest first,
//                                  optional ?status=
//   PUT  /api/contact           → admin (manage_content): update status (body.id)

import { requireAuth, audit, json } from "./_lib.js";
import { sendMail, notifyTeam } from "./_mail.js";

const STATUSES = ["new", "acknowledged", "replied", "closed"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toCamel(row) {
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

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const status = new URL(request.url).searchParams.get("status");
    let sql = "SELECT * FROM contact_messages";
    const params = [];
    if (status && STATUSES.includes(status)) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const q = await db.prepare(sql).bind(...params).all();
    return json({ success: true, messages: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const message = String(body.message || "").trim();
    if (!email || !EMAIL_RE.test(email)) return json({ success: false, message: "A valid email is required" }, 400);
    if (!message) return json({ success: false, message: "message is required" }, 400);

    // Persist first — a mail-provider outage must never lose the enquiry.
    const res = await db.prepare(
      `INSERT INTO contact_messages (name, email, subject, message, church_id, language, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.name || null, email, body.subject || null, message, body.churchId || null,
      body.language === "ta" ? "ta" : "en",
      request.headers.get("CF-Connecting-IP") || ""
    ).run();

    const id = res.meta && res.meta.last_row_id;

    const ack = await sendMail({
      env, to: email,
      subject: "Thank you for contacting Light of Jesus Ministry",
      text: "Thank you for contacting us — our team will reach you soon."
    });
    const teamNotify = await notifyTeam({
      env,
      subject: `New contact message: ${body.subject || "(no subject)"}`,
      text: `From: ${body.name || "Unknown"} <${email}>\n\n${message}`
    });

    if (ack.sent || teamNotify.sent) {
      await db.prepare(
        "UPDATE contact_messages SET ack_sent = ?, team_notified = ? WHERE id = ?"
      ).bind(ack.sent ? 1 : 0, teamNotify.sent ? 1 : 0, id).run();
    }

    await audit(context, {
      actorEmail: null, actorType: "anonymous", verified: false,
      action: "contact.submit", entityType: "contact_message", entityId: id,
      details: { ackSent: ack.sent, teamNotified: teamNotify.sent }
    });

    return json({ success: true, id, message: "Thank you for contacting us — our team will reach you soon." }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Contact message id is required" }, 400);
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` }, 400);
    }

    const existing = await db.prepare("SELECT * FROM contact_messages WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Contact message not found" }, 404);

    const status = body.status !== undefined ? body.status : existing.status;

    await db.prepare(
      "UPDATE contact_messages SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(status, auth.email, id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contact.update", entityType: "contact_message", entityId: id,
      details: { status }
    });

    return json({ success: true, message: "Contact message updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
