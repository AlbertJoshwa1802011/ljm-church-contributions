// Cloudflare Pages Function: /api/testimonies
// Public testimonies & miracles gallery — PRD §7.3, schema doc §2.3.
//
//   GET    /api/testimonies              → public: published only, newest first
//          /api/testimonies?kind=miracle → public: filter by 'testimony' | 'miracle'
//          /api/testimonies?all=1        → admin (manage_content): every status
//   POST   /api/testimonies              → public submit → lands 'pending'
//   PUT    /api/testimonies               → admin (manage_content): moderate (status,
//                                            edits) — body.id
//   DELETE /api/testimonies?id=NN        → admin (manage_content): remove

import { requireAuth, audit, json } from "./_lib.js";

const KINDS = ["testimony", "miracle"];
const STATUSES = ["pending", "published", "rejected"];

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toCamel(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    bodyEn: row.body_en,
    bodyTa: row.body_ta,
    authorName: row.author_name,
    memberId: row.member_id,
    place: row.place,
    kind: row.kind,
    mediaUrl: row.media_url,
    churchId: row.church_id,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    reviewedBy: row.reviewed_by
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");

  try {
    if (url.searchParams.get("all") === "1") {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;

      const q = await db.prepare("SELECT * FROM testimonies ORDER BY created_at DESC").all();
      return json({ success: true, testimonies: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    let sql = "SELECT * FROM testimonies WHERE status = 'published'";
    const params = [];
    if (kind && KINDS.includes(kind)) {
      sql += " AND kind = ?";
      params.push(kind);
    }
    sql += " ORDER BY published_at DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...params).all();
    return json({ success: true, testimonies: (q.results || []).map(toCamel) }, 200,
      corsHeaders({ "Cache-Control": "public, max-age=30" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

// Public submission — no auth. Always lands 'pending'; the caller-supplied
// status/publishedAt/reviewedBy are ignored so a visitor can never self-publish.
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

    const res = await db.prepare(
      `INSERT INTO testimonies (title_en, title_ta, body_en, body_ta, author_name, member_id, place, kind, media_url, church_id, status, submitted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(
      titleEn, body.titleTa || null, bodyEn, body.bodyTa || null,
      body.authorName || null, body.memberId || null, body.place || null, kind,
      body.mediaUrl || null, body.churchId || null,
      request.headers.get("CF-Connecting-IP") || ""
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: null, actorType: "anonymous", verified: false,
      action: "testimonies.submit", entityType: "testimony", entityId: id,
      details: { kind, titleEn }
    });

    return json({ success: true, id, message: "Thank you — your submission is awaiting review." }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Testimony id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM testimonies WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Testimony not found" }, 404);

    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` }, 400);
    }

    const merged = {
      title_en: body.titleEn !== undefined ? String(body.titleEn).trim() : existing.title_en,
      title_ta: body.titleTa !== undefined ? body.titleTa : existing.title_ta,
      body_en: body.bodyEn !== undefined ? String(body.bodyEn).trim() : existing.body_en,
      body_ta: body.bodyTa !== undefined ? body.bodyTa : existing.body_ta,
      author_name: body.authorName !== undefined ? body.authorName : existing.author_name,
      place: body.place !== undefined ? body.place : existing.place,
      kind: KINDS.includes(body.kind) ? body.kind : existing.kind,
      media_url: body.mediaUrl !== undefined ? body.mediaUrl : existing.media_url,
      church_id: body.churchId !== undefined ? body.churchId : existing.church_id,
      status: body.status !== undefined ? body.status : existing.status
    };
    if (!merged.title_en) return json({ success: false, message: "titleEn cannot be empty" }, 400);
    if (!merged.body_en) return json({ success: false, message: "bodyEn cannot be empty" }, 400);

    const publishedAt = merged.status === "published" && existing.status !== "published"
      ? new Date().toISOString()
      : existing.published_at;

    await db.prepare(
      `UPDATE testimonies SET title_en=?, title_ta=?, body_en=?, body_ta=?, author_name=?, place=?, kind=?, media_url=?, church_id=?, status=?, published_at=?, reviewed_by=?
       WHERE id=?`
    ).bind(
      merged.title_en, merged.title_ta, merged.body_en, merged.body_ta, merged.author_name,
      merged.place, merged.kind, merged.media_url, merged.church_id, merged.status,
      publishedAt, auth.email, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "testimonies.moderate", entityType: "testimony", entityId: id,
      details: { status: merged.status }
    });

    return json({ success: true, message: "Testimony updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
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
