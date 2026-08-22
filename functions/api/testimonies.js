// Cloudflare Pages Function: /api/testimonies
// Public gallery of testimonies & miracles (PRD §7.3). Visitors submit;
// admin moderates. Only 'published' rows are ever shown publicly.
//
//   GET    /api/testimonies              → public: published, newest first (?kind=)
//          /api/testimonies?all=1        → admin (manage_content): every status
//   POST   /api/testimonies              → public: submit → lands 'pending'
//   PUT    /api/testimonies              → admin: moderate (body.id, status)
//   DELETE /api/testimonies?id=NN        → admin: delete

import { requireAuth, audit, json, errorResponse } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

const KINDS = ["testimony", "miracle"];
const STATUSES = ["pending", "published", "rejected"];

function toTestimony(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    bodyEn: row.body_en,
    bodyTa: row.body_ta,
    authorName: row.author_name,
    place: row.place,
    kind: row.kind,
    mediaUrl: row.media_url,
    churchId: row.church_id,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  const kind = url.searchParams.get("kind");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM testimonies ORDER BY created_at DESC").all();
      return json({ success: true, testimonies: (q.results || []).map(toTestimony) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const conditions = ["status = 'published'"];
    const args = [];
    if (kind && KINDS.includes(kind)) { conditions.push("kind = ?"); args.push(kind); }

    const q = await db.prepare(
      `SELECT * FROM testimonies WHERE ${conditions.join(" AND ")} ORDER BY published_at DESC, created_at DESC`
    ).bind(...args).all();

    return json({ success: true, testimonies: (q.results || []).map(toTestimony) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
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
    const titleEn = String(body.titleEn || "").trim();
    const bodyEn = String(body.bodyEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);

    const kind = KINDS.includes(body.kind) ? body.kind : "testimony";
    const ip = request.headers.get("CF-Connecting-IP") || null;

    const res = await db.prepare(
      `INSERT INTO testimonies (title_en, title_ta, body_en, body_ta, author_name, place, kind, media_url, church_id, status, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(
      titleEn, body.titleTa || null, bodyEn, body.bodyTa || null,
      body.authorName || null, body.place || null, kind,
      body.mediaUrl || null, body.churchId ? Number(body.churchId) : null, ip
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: body.authorName || "anonymous", actorType: "public", verified: false,
      action: "testimonies.submit", entityType: "testimony", entityId: id, details: { kind }
    });

    return json({ success: true, id, message: "Thank you — your testimony was submitted and will appear once reviewed." }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Testimony id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM testimonies WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Testimony not found" }, 404);

    const status = STATUSES.includes(body.status) ? body.status : existing.status;
    const publishedAt = status === "published" && existing.status !== "published" ? new Date().toISOString() : existing.published_at;

    await db.prepare(
      `UPDATE testimonies SET
         title_en = COALESCE(?, title_en), title_ta = COALESCE(?, title_ta),
         body_en = COALESCE(?, body_en), body_ta = COALESCE(?, body_ta),
         status = ?, published_at = ?, reviewed_by = ?
       WHERE id = ?`
    ).bind(
      body.titleEn || null, body.titleTa !== undefined ? body.titleTa : null,
      body.bodyEn || null, body.bodyTa !== undefined ? body.bodyTa : null,
      status, publishedAt, auth.email, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "testimonies.moderate", entityType: "testimony", entityId: id, details: { status }
    });

    return json({ success: true, message: "Testimony updated" }, 200, corsHeaders());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Testimony id is required" }, 400);

    const res = await db.prepare("DELETE FROM testimonies WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Testimony not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "testimonies.delete", entityType: "testimony", entityId: id
    });

    return json({ success: true, message: "Testimony deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
