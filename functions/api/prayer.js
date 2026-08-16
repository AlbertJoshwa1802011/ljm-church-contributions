// Cloudflare Pages Function: /api/prayer
// "Pray" flow — PRD §7.5, schema doc §2.4. Prayer requests are never public;
// only the requester and the admin team ever see the content.
//
//   POST /api/prayer            → public: submit a request. Persisted FIRST, then a
//                                  best-effort team notification (email failure never
//                                  loses the request — see _mail.js).
//   GET  /api/prayer            → admin (manage_content): inbox, newest first,
//                                  optional ?status=
//   PUT  /api/prayer            → admin (manage_content): update status (body.id)

import { requireAuth, audit, json } from "./_lib.js";
import { notifyTeam } from "./_mail.js";

const STATUSES = ["new", "praying", "contacted", "closed"];

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
    phone: row.phone,
    request: row.request,
    wantsCallback: !!row.wants_callback,
    language: row.language,
    churchId: row.church_id,
    memberId: row.member_id,
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
    const status = new URL(request.url).searchParams.get("status");
    let sql = "SELECT * FROM prayer_requests";
    const params = [];
    if (status && STATUSES.includes(status)) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const q = await db.prepare(sql).bind(...params).all();
    return json({ success: true, requests: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
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
    if (!requestText) return json({ success: false, message: "request is required" }, 400);

    // Persist first — a mail-provider outage must never lose a prayer request.
    const res = await db.prepare(
      `INSERT INTO prayer_requests (name, email, phone, request, wants_callback, language, church_id, member_id, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.name || null, body.email || null, body.phone || null, requestText,
      body.wantsCallback ? 1 : 0, body.language === "ta" ? "ta" : "en",
      body.churchId || null, body.memberId || null,
      request.headers.get("CF-Connecting-IP") || ""
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await notifyTeam({
      env,
      subject: "New prayer request",
      text: `A new prayer request was submitted (id ${id}).\n\nFrom: ${body.name || "Anonymous"}\nCallback requested: ${body.wantsCallback ? "yes" : "no"}\n\n${requestText}`
    });

    await audit(context, {
      actorEmail: null, actorType: "anonymous", verified: false,
      action: "prayer.submit", entityType: "prayer_request", entityId: id,
      details: { wantsCallback: !!body.wantsCallback }
    });

    return json({ success: true, id, message: "Your request has been received. Our team will reach out and pray with you." }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Prayer request id is required" }, 400);
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` }, 400);
    }

    const existing = await db.prepare("SELECT * FROM prayer_requests WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Prayer request not found" }, 404);

    const status = body.status !== undefined ? body.status : existing.status;

    await db.prepare(
      "UPDATE prayer_requests SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(status, auth.email, id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "prayer.update", entityType: "prayer_request", entityId: id,
      details: { status }
    });

    return json({ success: true, message: "Prayer request updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
