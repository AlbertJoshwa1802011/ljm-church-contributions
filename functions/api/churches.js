// Cloudflare Pages Function: /api/churches
// The two-church (and future multi-campus) ministry model — PRD §6, schema doc §2.1.
//
//   GET    /api/churches           → public: active churches, ordered for display
//          /api/churches?all=1     → admin (manage_funds): every church incl. archived
//   POST   /api/churches           → admin: create
//   PUT    /api/churches           → admin: update (body.id)
//   DELETE /api/churches?id=NN     → admin: archive (soft-delete — a church scopes
//                                    real events/programs, so it is never hard-deleted)

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCamel(row) {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameTa: row.name_ta,
    isMotherChurch: !!row.is_mother_church,
    addressEn: row.address_en,
    addressTa: row.address_ta,
    city: row.city,
    country: row.country,
    phone: row.phone,
    email: row.email,
    mapUrl: row.map_url,
    serviceTimesEn: row.service_times_en,
    serviceTimesTa: row.service_times_ta,
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
  const wantsAll = url.searchParams.get("all") === "1";

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_funds");
      if (!auth.ok) return auth.response;

      const q = await db.prepare("SELECT * FROM churches ORDER BY sort_order ASC, id ASC").all();
      return json({ success: true, churches: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const q = await db.prepare(
      "SELECT * FROM churches WHERE status = 'active' ORDER BY sort_order ASC, id ASC"
    ).all();
    return json({ success: true, churches: (q.results || []).map(toCamel) }, 200,
      corsHeaders({ "Cache-Control": "public, max-age=60" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const nameEn = String(body.nameEn || "").trim();
    if (!nameEn) return json({ success: false, message: "nameEn is required" }, 400);

    const slug = slugify(body.slug || nameEn);
    if (!slug) return json({ success: false, message: "A valid slug is required" }, 400);

    const existing = await db.prepare("SELECT id FROM churches WHERE slug = ?").bind(slug).first();
    if (existing) return json({ success: false, message: `A church with slug '${slug}' already exists` }, 409);

    const res = await db.prepare(
      `INSERT INTO churches (slug, name_en, name_ta, is_mother_church, address_en, address_ta, city, country, phone, email, map_url, service_times_en, service_times_ta, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      slug, nameEn, body.nameTa || null, body.isMotherChurch ? 1 : 0,
      body.addressEn || null, body.addressTa || null, body.city || null, body.country || "India",
      body.phone || null, body.email || null, body.mapUrl || null,
      body.serviceTimesEn || null, body.serviceTimesTa || null,
      body.status === "archived" ? "archived" : "active",
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.add", entityType: "church", entityId: id,
      details: { slug, nameEn }
    });

    return json({ success: true, id, message: `Church '${nameEn}' added` }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Church id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM churches WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Church not found" }, 404);

    const fields = {
      name_en: body.nameEn !== undefined ? String(body.nameEn).trim() : existing.name_en,
      name_ta: body.nameTa !== undefined ? body.nameTa : existing.name_ta,
      is_mother_church: body.isMotherChurch !== undefined ? (body.isMotherChurch ? 1 : 0) : existing.is_mother_church,
      address_en: body.addressEn !== undefined ? body.addressEn : existing.address_en,
      address_ta: body.addressTa !== undefined ? body.addressTa : existing.address_ta,
      city: body.city !== undefined ? body.city : existing.city,
      country: body.country !== undefined ? body.country : existing.country,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      email: body.email !== undefined ? body.email : existing.email,
      map_url: body.mapUrl !== undefined ? body.mapUrl : existing.map_url,
      service_times_en: body.serviceTimesEn !== undefined ? body.serviceTimesEn : existing.service_times_en,
      service_times_ta: body.serviceTimesTa !== undefined ? body.serviceTimesTa : existing.service_times_ta,
      status: body.status === "archived" || body.status === "active" ? body.status : existing.status,
      sort_order: body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sort_order
    };

    if (!fields.name_en) return json({ success: false, message: "nameEn cannot be empty" }, 400);

    await db.prepare(
      `UPDATE churches SET name_en=?, name_ta=?, is_mother_church=?, address_en=?, address_ta=?, city=?, country=?, phone=?, email=?, map_url=?, service_times_en=?, service_times_ta=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      fields.name_en, fields.name_ta, fields.is_mother_church, fields.address_en, fields.address_ta,
      fields.city, fields.country, fields.phone, fields.email, fields.map_url,
      fields.service_times_en, fields.service_times_ta, fields.status, fields.sort_order, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.update", entityType: "church", entityId: id,
      details: { nameEn: fields.name_en, status: fields.status }
    });

    return json({ success: true, message: "Church updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

// Soft-delete only: a church scopes real events/programs, so hard-deleting it
// would orphan or silently un-scope that data. DELETE archives it instead —
// the same "status flip, not a row removal" pattern funds.js already uses.
export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Church id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM churches WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Church not found" }, 404);

    await db.prepare("UPDATE churches SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.archive", entityType: "church", entityId: id
    });

    return json({ success: true, message: `Church '${existing.name_en}' archived. Its events/programs are preserved.` }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
