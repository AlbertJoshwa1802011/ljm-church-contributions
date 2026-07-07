// Cloudflare Pages Function: /api/logs
// POST — view-event ingestion from the public site (navigator.sendBeacon friendly).
// GET  — audit-log viewer for the admin panel (view_audit permission).

import { requireAuth, verifyGoogleToken, getPermissions, audit, json } from "./_lib.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    let body = {};
    try { body = await request.json(); } catch (_) { /* beacon may send empty */ }

    const path = String(body.path || "/").substring(0, 200);
    const fund = body.fund ? String(body.fund).substring(0, 60) : null;
    const event = body.event === "view.fund" ? "view.fund" : "view.page";

    // Resolve actor: Google ID token in body (sendBeacon can't set headers)
    let actorEmail = null;
    let actorType = "anonymous";
    let verified = false;
    if (body.token && String(body.token).split(".").length === 3) {
      const identity = await verifyGoogleToken(body.token, env);
      if (identity) {
        actorEmail = identity.email;
        verified = true;
        const perms = await getPermissions(actorEmail, db);
        actorType = perms.length > 0 ? "admin" : "member";
      }
    }

    // Cheap dedupe: skip identical view from same IP within 10 seconds
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const recent = await db.prepare(
      `SELECT id FROM activity_logs
       WHERE ip = ? AND action = ? AND entity_id = ?
         AND created_at > datetime('now', '-10 seconds')
       LIMIT 1`
    ).bind(ip, event, path).first();

    if (!recent) {
      await audit(context, {
        actorEmail, actorType, verified,
        action: event,
        entityType: "page",
        entityId: path,
        details: fund ? { fund } : null
      });
    }

    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    // Never fail loudly for analytics ingestion
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_audit");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const filters = [];
    const binds = [];

    const actor = url.searchParams.get("actor");
    if (actor) { filters.push("actor_email LIKE ?"); binds.push(`%${actor}%`); }

    const action = url.searchParams.get("action");
    if (action) { filters.push("action LIKE ?"); binds.push(`${action}%`); }

    const actorType = url.searchParams.get("actorType");
    if (actorType) { filters.push("actor_type = ?"); binds.push(actorType); }

    const from = url.searchParams.get("from");
    if (from) { filters.push("created_at >= ?"); binds.push(from); }

    const to = url.searchParams.get("to");
    if (to) { filters.push("created_at <= ?"); binds.push(to + " 23:59:59"); }

    const where = filters.length ? "WHERE " + filters.join(" AND ") : "";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM activity_logs ${where}`)
      .bind(...binds).first();

    const rows = await db.prepare(
      `SELECT id, actor_email AS actorEmail, actor_type AS actorType, action,
              entity_type AS entityType, entity_id AS entityId, details,
              ip, user_agent AS userAgent, verified, created_at AS createdAt
       FROM activity_logs ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    return json({
      success: true,
      logs: rows.results || [],
      total: totalRow?.total || 0,
      limit, offset
    }, 200, { "Cache-Control": "no-store" });

  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
