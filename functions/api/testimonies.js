// Cloudflare Pages Function: /api/testimonies
// Milestone v2, Phase 2 — testimonies & miracles.
//
//   GET    /api/testimonies              → public: published rows (?kind=&church=)
//          /api/testimonies?id=NN        → public: single published row (or any
//                                           status for an authenticated moderator)
//          /api/testimonies?all=1        → admin (manage_content): moderation queue,
//                                           every status
//   POST   /api/testimonies               → public: submit → lands 'pending'
//   PUT    /api/testimonies               → admin (manage_content): moderate/edit (body.id)
//   DELETE /api/testimonies?id=NN         → admin (manage_content): delete

import { requireAuth, audit, json } from "./_lib.js";

const VALID_KINDS = ["testimony", "miracle"];
const VALID_STATUSES = ["pending", "published", "rejected"];
const MAX_LEN = 8000;

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toTestimony(row) {
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
    publishedAt: row.published_at
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const wantsAll = url.searchParams.get("all") === "1";
  const kind = url.searchParams.get("kind");
  const church = url.searchParams.get("church");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM testimonies ORDER BY (status='pending') DESC, created_at DESC").all();
      return json({ success: true, testimonies: (q.results || []).map(toTestimony) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    if (id) {
      const row = await db.prepare("SELECT * FROM testimonies WHERE id=?").bind(Number(id)).first();
      if (!row) return json({ success: false, message: "Testimony not found" }, 404);
      if (row.status !== "published") {
        const auth = await requireAuth(context, "manage_content");
        if (!auth.ok) return json({ success: false, message: "Testimony not found" }, 404);
      }
      return json({ success: true, testimony: toTestimony(row) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    let sql = "SELECT * FROM testimonies WHERE status='published'";
    const binds = [];
    if (kind && VALID_KINDS.includes(kind)) { sql += " AND kind=?"; binds.push(kind); }
    if (church) { sql += " AND church_id=?"; binds.push(Number(church)); }
    sql += " ORDER BY published_at DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...binds).all();
    return json({ success: true, testimonies: (q.results || []).map(toTestimony) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  try {
    const body = await request.json();
    const titleEn = String(body.titleEn || "").trim();
    const bodyEn = String(body.bodyEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);
    if (titleEn.length > 300) return json({ success: false, message: "titleEn is too long" }, 400);
    if (bodyEn.length > MAX_LEN) return json({ success: false, message: "bodyEn is too long" }, 400);

    const kind = VALID_KINDS.includes(body.kind) ? body.kind : "testimony";

    // Public submissions always land 'pending' for moderation. A signed-in
    // moderator (manage_content) may add a testimony directly at any status —
    // e.g. entering an already-approved story straight into 'published'.
    const auth = await requireAuth(context, "manage_content");
    const status = auth.ok && VALID_STATUSES.includes(body.status) ? body.status : "pending";
    const publishedAt = status === "published" ? new Date().toISOString() : null;

    const res = await db.prepare(
      `INSERT INTO testimonies (title_en, title_ta, body_en, body_ta, author_name, place, kind, media_url, church_id, status, submitted_ip, published_at, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      titleEn, body.titleTa || null, bodyEn, body.bodyTa || null,
      String(body.authorName || "").trim().slice(0, 200) || null,
      body.place || null, kind, body.mediaUrl || null, body.churchId ? Number(body.churchId) : null,
      status, request.headers.get("CF-Connecting-IP") || "", publishedAt, auth.ok ? auth.email : null
    ).run();

    const id = res.meta && res.meta.last_row_id;
    await audit(context, {
      actorEmail: auth.ok ? auth.email : null, actorType: auth.ok ? "admin" : "public", verified: auth.verified,
      action: "testimonies.submit", entityType: "testimony", entityId: id, details: { kind, status }
    });

    return json({
      success: true, id,
      message: status === "pending" ? "Thank you — your story has been submitted for review." : "Testimony added"
    }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Testimony id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM testimonies WHERE id=?").bind(id).first();
    if (!existing) return json({ success: false, message: "Testimony not found" }, 404);

    const status = VALID_STATUSES.includes(body.status) ? body.status : existing.status;
    const titleEn = body.titleEn !== undefined ? String(body.titleEn).trim() : existing.title_en;
    const bodyEn = body.bodyEn !== undefined ? String(body.bodyEn).trim() : existing.body_en;
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);

    const publishedAt = status === "published"
      ? (existing.published_at || new Date().toISOString())
      : existing.published_at;

    await db.prepare(
      `UPDATE testimonies SET title_en=?, title_ta=?, body_en=?, body_ta=?, author_name=?, place=?, kind=?, media_url=?, church_id=?, status=?, published_at=?, reviewed_by=?
       WHERE id=?`
    ).bind(
      titleEn, body.titleTa !== undefined ? body.titleTa : existing.title_ta,
      bodyEn, body.bodyTa !== undefined ? body.bodyTa : existing.body_ta,
      body.authorName !== undefined ? body.authorName : existing.author_name,
      body.place !== undefined ? body.place : existing.place,
      VALID_KINDS.includes(body.kind) ? body.kind : existing.kind,
      body.mediaUrl !== undefined ? body.mediaUrl : existing.media_url,
      body.churchId !== undefined ? (body.churchId ? Number(body.churchId) : null) : existing.church_id,
      status, publishedAt, auth.email, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "testimonies.moderate", entityType: "testimony", entityId: id, details: { status }
    });

    return json({ success: true, message: "Testimony updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Testimony id is required" }, 400);

    const res = await db.prepare("DELETE FROM testimonies WHERE id=?").bind(id).run();
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
