// Cloudflare Pages Function: /api/programs
// Service times & recurring programs, scoped per church — PRD §7.8, schema doc §2.7.
//
//   GET    /api/programs             → public: active programs, optional ?church=<id>
//          /api/programs?all=1       → admin (manage_content): every status
//   POST   /api/programs             → admin: create
//   PUT    /api/programs             → admin: update (body.id)
//   DELETE /api/programs?id=NN       → admin: delete

import { requireAuth, audit, json } from "./_lib.js";

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
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const church = url.searchParams.get("church");

  try {
    if (url.searchParams.get("all") === "1") {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;

      const q = await db.prepare("SELECT * FROM programs ORDER BY sort_order ASC, day_of_week ASC, id ASC").all();
      return json({ success: true, programs: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    let sql = "SELECT * FROM programs WHERE status = 'active'";
    const params = [];
    if (church) {
      sql += " AND church_id = ?";
      params.push(Number(church));
    }
    sql += " ORDER BY sort_order ASC, day_of_week ASC, id ASC";

    const q = await db.prepare(sql).bind(...params).all();
    return json({ success: true, programs: (q.results || []).map(toCamel) }, 200,
      corsHeaders({ "Cache-Control": "public, max-age=60" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const titleEn = String(body.titleEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);

    const res = await db.prepare(
      `INSERT INTO programs (title_en, title_ta, description_en, description_ta, church_id, ministry_area, day_of_week, start_time, end_time, recurrence, location, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId || null, body.ministryArea || null,
      body.dayOfWeek !== undefined && body.dayOfWeek !== null ? Number(body.dayOfWeek) : null,
      body.startTime || null, body.endTime || null,
      ["weekly", "monthly", "once"].includes(body.recurrence) ? body.recurrence : "weekly",
      body.location || null,
      body.status === "inactive" ? "inactive" : "active",
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.add", entityType: "program", entityId: id,
      details: { titleEn, churchId: body.churchId || null }
    });

    return json({ success: true, id, message: `Program '${titleEn}' added` }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Program id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM programs WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Program not found" }, 404);

    const titleEn = body.titleEn !== undefined ? String(body.titleEn).trim() : existing.title_en;
    if (!titleEn) return json({ success: false, message: "titleEn cannot be empty" }, 400);

    const merged = {
      title_ta: body.titleTa !== undefined ? body.titleTa : existing.title_ta,
      description_en: body.descriptionEn !== undefined ? body.descriptionEn : existing.description_en,
      description_ta: body.descriptionTa !== undefined ? body.descriptionTa : existing.description_ta,
      church_id: body.churchId !== undefined ? body.churchId : existing.church_id,
      ministry_area: body.ministryArea !== undefined ? body.ministryArea : existing.ministry_area,
      day_of_week: body.dayOfWeek !== undefined ? body.dayOfWeek : existing.day_of_week,
      start_time: body.startTime !== undefined ? body.startTime : existing.start_time,
      end_time: body.endTime !== undefined ? body.endTime : existing.end_time,
      recurrence: ["weekly", "monthly", "once"].includes(body.recurrence) ? body.recurrence : existing.recurrence,
      location: body.location !== undefined ? body.location : existing.location,
      status: body.status === "inactive" || body.status === "active" ? body.status : existing.status,
      sort_order: body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sort_order
    };

    await db.prepare(
      `UPDATE programs SET title_en=?, title_ta=?, description_en=?, description_ta=?, church_id=?, ministry_area=?, day_of_week=?, start_time=?, end_time=?, recurrence=?, location=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      titleEn, merged.title_ta, merged.description_en, merged.description_ta, merged.church_id,
      merged.ministry_area, merged.day_of_week, merged.start_time, merged.end_time,
      merged.recurrence, merged.location, merged.status, merged.sort_order, id
    ).run();

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
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Program id is required" }, 400);

    const res = await db.prepare("DELETE FROM programs WHERE id = ?").bind(id).run();
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
