// Cloudflare Pages Function: /api/prayer
// Prayer requests (PRD §7.5) — NEVER public. Persist first, then best-effort
// notify (team + optional ack); a mail failure never loses a request.
//
//   POST /api/prayer              → public: submit a request
//   GET  /api/prayer              → admin (manage_content): inbox, newest first (?status=)
//   PUT  /api/prayer              → admin: update status (body.id, status)

import { requireAuth, audit, json, errorResponse } from "./_lib.js";
import { sendMail, teamNotifyAddress, ackEmailHtml, teamNotifyHtml } from "./_mail.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

const STATUSES = ["new", "praying", "contacted", "closed"];

// No length cap existed here at all — an unbounded public POST body is a
// storage/DoS surface (see CONTRIBUTING.md's "extremely long text" test case).
const MAX_SHORT_LEN = 300;
const MAX_BODY_LEN = 10000;
function tooLong(value, max) { return typeof value === "string" && value.length > max; }

function toPrayerRequest(row) {
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
    const q = await db.prepare(`SELECT * FROM prayer_requests ${where} ORDER BY created_at DESC`).bind(...args).all();

    return json({ success: true, requests: (q.results || []).map(toPrayerRequest) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
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
    const requestText = String(body.request || "").trim();
    if (!requestText) return json({ success: false, message: "Please share what you'd like prayer for." }, 400);

    if (tooLong(body.name, MAX_SHORT_LEN) || tooLong(body.email, MAX_SHORT_LEN) || tooLong(body.phone, MAX_SHORT_LEN)) {
      return json({ success: false, message: `Name/email/phone must be ${MAX_SHORT_LEN} characters or fewer` }, 400);
    }
    if (tooLong(requestText, MAX_BODY_LEN)) {
      return json({ success: false, message: `Prayer request must be ${MAX_BODY_LEN} characters or fewer` }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || null;
    const name = body.name != null ? String(body.name).trim().substring(0, 120) : null;
    const email = body.email != null ? String(body.email).trim().substring(0, 200) : null;
    const phone = body.phone != null ? String(body.phone).trim().substring(0, 40) : null;

    const res = await db.prepare(
      `INSERT INTO prayer_requests (name, email, phone, request, wants_callback, language, church_id, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name, email, phone, requestText,
      body.wantsCallback ? 1 : 0, body.language === "ta" ? "ta" : "en",
      body.churchId ? Number(body.churchId) : null, ip
    ).run();

    const id = res.meta && res.meta.last_row_id;

    // Best-effort notifications — the request is already durably saved above.
    const teamEmail = teamNotifyAddress(env);
    if (teamEmail) {
      await sendMail(env, {
        to: teamEmail,
        subject: "New prayer request — Light of Jesus Ministry",
        html: teamNotifyHtml({ kind: "prayer request", fields: { Name: name, Email: email, Phone: phone, Request: requestText } })
      });
    }
    if (email) {
      await sendMail(env, { to: email, subject: "We received your prayer request", html: ackEmailHtml({ name }) });
    }

    await audit(context, {
      actorEmail: email || "anonymous", actorType: "public", verified: false,
      action: "prayer.submit", entityType: "prayer_request", entityId: id
    });

    return json({ success: true, id, message: "Thank you — our team will be praying for you." }, 200, corsHeaders());
  } catch (err) {
    return errorResponse(err);
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
    if (!id) return json({ success: false, message: "Prayer request id is required" }, 400);
    if (!STATUSES.includes(body.status)) return json({ success: false, message: "Invalid status" }, 400);

    const res = await db.prepare(
      "UPDATE prayer_requests SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(body.status, auth.email, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Prayer request not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "prayer.status_update", entityType: "prayer_request", entityId: id, details: { status: body.status }
    });

    return json({ success: true, message: "Prayer request updated" }, 200, corsHeaders());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
