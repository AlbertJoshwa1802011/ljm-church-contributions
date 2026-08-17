// Cloudflare Pages Function: /api/programs
// Service times & recurring programs, per church (PRD §7.8).
//
//   GET    /api/programs           → public: active programs (?church=slug, ?ministryArea=)
//          /api/programs?all=1     → admin (manage_content): every status
//   POST   /api/programs           → admin: create
//   PUT    /api/programs           → admin: update (body.id)
//   DELETE /api/programs?id=NN     → admin: delete

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

// 0=Sunday..6=Saturday, matching the DAYS[] index the public pages render
// against — an out-of-range value throws inside that render and breaks the
// entire public programs list, not just the one bad row.
function parseDayOfWeek(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 6) return { ok: false };
  return { ok: true, value: n };
}

function toProgram(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    descriptionEn: row.description_en,
    descriptionTa: row.description_ta,
    churchId: row.church_id,
    churchSlug: row.church_slug || undefined,
    churchNameEn: row.church_name_en || undefined,
    ministryArea: row.ministry_area,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrence: row.recurrence,
    location: row.location,
    status: row.status,
    sortOrder: row.sort_order
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  const churchSlug = url.searchParams.get("church");
  const ministryArea = url.searchParams.get("ministryArea");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare(
        `SELECT p.*, c.slug AS church_slug, c.name_en AS church_name_en
         FROM programs p LEFT JOIN churches c ON c.id = p.church_id
         ORDER BY p.sort_order ASC, p.day_of_week ASC, p.id ASC`
      ).all();
      return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const conditions = ["p.status = 'active'"];
    const args = [];
    if (churchSlug) { conditions.push("c.slug = ?"); args.push(churchSlug); }
    if (ministryArea) { conditions.push("p.ministry_area = ?"); args.push(ministryArea); }

    const q = await db.prepare(
      `SELECT p.*, c.slug AS church_slug, c.name_en AS church_name_en
       FROM programs p LEFT JOIN churches c ON c.id = p.church_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.sort_order ASC, p.day_of_week ASC, p.id ASC`
    ).bind(...args).all();

    return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "public, max-age=120" }));
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

    const dayOfWeek = parseDayOfWeek(body.dayOfWeek);
    if (!dayOfWeek.ok) return json({ success: false, message: "dayOfWeek must be 0 (Sunday) through 6 (Saturday)" }, 400);

    const res = await db.prepare(
      `INSERT INTO programs (title_en, title_ta, description_en, description_ta, church_id, ministry_area, day_of_week, start_time, end_time, recurrence, location, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      dayOfWeek.value,
      body.startTime || null, body.endTime || null, body.recurrence || "weekly",
      body.location || null, body.status === "inactive" ? "inactive" : "active", Number(body.sortOrder) || 0
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.add", entityType: "program", entityId: id, details: { titleEn }
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
    const titleEn = String(body.titleEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);

    const dayOfWeek = parseDayOfWeek(body.dayOfWeek);
    if (!dayOfWeek.ok) return json({ success: false, message: "dayOfWeek must be 0 (Sunday) through 6 (Saturday)" }, 400);

    const res = await db.prepare(
      `UPDATE programs SET title_en=?, title_ta=?, description_en=?, description_ta=?, church_id=?, ministry_area=?, day_of_week=?, start_time=?, end_time=?, recurrence=?, location=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      dayOfWeek.value,
      body.startTime || null, body.endTime || null, body.recurrence || "weekly",
      body.location || null, body.status === "inactive" ? "inactive" : "active", Number(body.sortOrder) || 0, id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Program not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.update", entityType: "program", entityId: id, details: { titleEn }
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
