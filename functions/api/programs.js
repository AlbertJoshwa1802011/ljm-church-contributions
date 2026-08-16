// Cloudflare Pages Function: /api/programs
// Milestone v2, Phase 4 — service times & recurring programs, per church.
// Also backs the Youth Ministry hub via ?ministry=youth (PRD §7.10).
//
//   GET    /api/programs             → public: active programs (?church=&ministry=)
//          /api/programs?all=1       → admin (manage_content): every program, any status
//   POST   /api/programs             → admin (manage_content): create
//   PUT    /api/programs             → admin (manage_content): update (body.id)
//   DELETE /api/programs?id=NN       → admin (manage_content): delete

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toProgram(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    descriptionEn: row.description_en,
    descriptionTa: row.description_ta,
    churchId: row.church_id,
    ministryArea: row.ministry_area,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrence: row.recurrence,
    location: row.location,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  const church = url.searchParams.get("church");
  const ministry = url.searchParams.get("ministry");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM programs ORDER BY sort_order ASC, day_of_week ASC, id ASC").all();
      return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    let sql = "SELECT * FROM programs WHERE status='active'";
    const binds = [];
    if (church) { sql += " AND church_id=?"; binds.push(Number(church)); }
    if (ministry) { sql += " AND ministry_area=?"; binds.push(ministry); }
    sql += " ORDER BY sort_order ASC, day_of_week ASC, id ASC";

    const q = await db.prepare(sql).bind(...binds).all();
    return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "public, max-age=120" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

function validateBody(body) {
  const titleEn = String(body.titleEn || "").trim();
  if (!titleEn) return "titleEn is required";
  if (body.dayOfWeek != null && (body.dayOfWeek < 0 || body.dayOfWeek > 6)) return "dayOfWeek must be 0-6";
  return null;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const err = validateBody(body);
    if (err) return json({ success: false, message: err }, 400);

    const res = await db.prepare(
      `INSERT INTO programs (title_en, title_ta, description_en, description_ta, church_id, ministry_area, day_of_week, start_time, end_time, recurrence, location, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(body.titleEn).trim(), body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      body.dayOfWeek != null ? Number(body.dayOfWeek) : null, body.startTime || null, body.endTime || null,
      body.recurrence || "weekly", body.location || null,
      body.status === "archived" ? "archived" : "active", Number(body.sortOrder) || 0
    ).run();

    const id = res.meta && res.meta.last_row_id;
    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.add", entityType: "program", entityId: id, details: { titleEn: body.titleEn }
    });

    return json({ success: true, id, message: "Program added" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Program id is required" }, 400);
    const err = validateBody(body);
    if (err) return json({ success: false, message: err }, 400);

    const res = await db.prepare(
      `UPDATE programs SET title_en=?, title_ta=?, description_en=?, description_ta=?, church_id=?, ministry_area=?, day_of_week=?, start_time=?, end_time=?, recurrence=?, location=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      String(body.titleEn).trim(), body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      body.dayOfWeek != null ? Number(body.dayOfWeek) : null, body.startTime || null, body.endTime || null,
      body.recurrence || "weekly", body.location || null,
      body.status === "archived" ? "archived" : "active", Number(body.sortOrder) || 0,
      id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Program not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.update", entityType: "program", entityId: id
    });

    return json({ success: true, message: "Program updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Program id is required" }, 400);

    const res = await db.prepare("DELETE FROM programs WHERE id=?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Program not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.delete", entityType: "program", entityId: id
    });

    return json({ success: true, message: "Program deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
