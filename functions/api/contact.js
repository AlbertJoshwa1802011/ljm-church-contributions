// Cloudflare Pages Function: /api/contact
// Contact form (PRD §7.6). Persist first, then best-effort noreply
// acknowledgement + internal team notification — a mail failure never loses
// a message.
//
//   POST /api/contact              → public: submit
//   GET  /api/contact              → admin (manage_content): inbox, newest first (?status=)
//   PUT  /api/contact              → admin: update status (body.id, status)

import { requireAuth, audit, json } from "./_lib.js";
import { sendMail, teamNotifyAddress, ackEmailHtml, teamNotifyHtml } from "./_mail.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

const STATUSES = ["new", "acknowledged", "replied", "closed"];

// No length cap existed here at all — an unbounded public POST body is a
// storage/DoS surface (see CONTRIBUTING.md's "extremely long text" test case).
const MAX_SHORT_LEN = 300;
const MAX_BODY_LEN = 10000;
function tooLong(value, max) { return typeof value === "string" && value.length > max; }

function toContactMessage(row) {
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
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const conditions = [];
    const args = [];
    if (status && STATUSES.includes(status)) { conditions.push("status = ?"); args.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const q = await db.prepare(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC`).bind(...args).all();

    return json({ success: true, messages: (q.results || []).map(toContactMessage) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
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
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ success: false, message: "A valid email is required" }, 400);
    if (!message) return json({ success: false, message: "Please include a message" }, 400);

    if (tooLong(email, MAX_SHORT_LEN) || tooLong(body.name, MAX_SHORT_LEN) || tooLong(body.subject, MAX_SHORT_LEN)) {
      return json({ success: false, message: `Name/email/subject must be ${MAX_SHORT_LEN} characters or fewer` }, 400);
    }
    if (tooLong(message, MAX_BODY_LEN)) {
      return json({ success: false, message: `Message must be ${MAX_BODY_LEN} characters or fewer` }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || null;

    const res = await db.prepare(
      `INSERT INTO contact_messages (name, email, subject, message, church_id, language, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.name || null, email, body.subject || null, message,
      body.churchId ? Number(body.churchId) : null, body.language === "ta" ? "ta" : "en", ip
    ).run();

    const id = res.meta && res.meta.last_row_id;

    // Persisted above already — notifications are best-effort from here.
    const ack = await sendMail(env, { to: email, subject: "Thank you for contacting Light of Jesus Ministry", html: ackEmailHtml({ name: body.name }) });

    const teamEmail = teamNotifyAddress(env);
    let teamNotified = false;
    if (teamEmail) {
      const res2 = await sendMail(env, {
        to: teamEmail,
        subject: "New contact message — Light of Jesus Ministry",
        html: teamNotifyHtml({ kind: "contact message", fields: { Name: body.name, Email: email, Subject: body.subject, Message: message } }),
        replyTo: email
      });
      teamNotified = res2.sent;
    }

    if (ack.sent || teamNotified) {
      await db.prepare("UPDATE contact_messages SET ack_sent = ?, team_notified = ? WHERE id = ?")
        .bind(ack.sent ? 1 : 0, teamNotified ? 1 : 0, id).run();
    }

    await audit(context, {
      actorEmail: email, actorType: "public", verified: false,
      action: "contact.submit", entityType: "contact_message", entityId: id
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
    if (!STATUSES.includes(body.status)) return json({ success: false, message: "Invalid status" }, 400);

    const res = await db.prepare(
      "UPDATE contact_messages SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(body.status, auth.email, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Contact message not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contact.status_update", entityType: "contact_message", entityId: id, details: { status: body.status }
    });

    return json({ success: true, message: "Contact message updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
