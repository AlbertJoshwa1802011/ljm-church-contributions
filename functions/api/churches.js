// Cloudflare Pages Function: /api/churches
// The two-church directory (Church of Light — mother church — and City
// Worship Center), plus room to add more campuses later. Ministry-wide
// content elsewhere leaves church_id null; this endpoint just lists/manages
// the churches themselves.
//
//   GET    /api/churches            → public: active churches, sorted
//          /api/churches?all=1      → admin (manage_content): every church
//   POST   /api/churches            → admin: create
//   PUT    /api/churches            → admin: update (body.id)
//   DELETE /api/churches?id=NN      → admin: archive (soft-delete: status='archived')

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toChurch(row) {
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
    sortOrder: row.sort_order
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
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM churches ORDER BY sort_order ASC, id ASC").all();
      return json({ success: true, churches: (q.results || []).map(toChurch) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const q = await db.prepare("SELECT * FROM churches WHERE status = 'active' ORDER BY sort_order ASC, id ASC").all();
    return json({ success: true, churches: (q.results || []).map(toChurch) }, 200, corsHeaders({ "Cache-Control": "public, max-age=300" }));
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
    const slug = String(body.slug || "").trim().toLowerCase();
    const nameEn = String(body.nameEn || "").trim();
    if (!slug || !nameEn) return json({ success: false, message: "slug and nameEn are required" }, 400);

    const res = await db.prepare(
      `INSERT INTO churches (slug, name_en, name_ta, is_mother_church, address_en, address_ta, city, country, phone, email, map_url, service_times_en, service_times_ta, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      slug, nameEn, body.nameTa || null, body.isMotherChurch ? 1 : 0,
      body.addressEn || null, body.addressTa || null, body.city || null, body.country || "India",
      body.phone || null, body.email || null, body.mapUrl || null,
      body.serviceTimesEn || null, body.serviceTimesTa || null, Number(body.sortOrder) || 0
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.add", entityType: "church", entityId: id, details: { slug, nameEn }
    });

    return json({ success: true, id, message: `Church '${nameEn}' added` }, 200, corsHeaders());
  } catch (err) {
    const message = /UNIQUE/.test(err.message) ? "A church with that slug already exists" : err.message;
    return json({ success: false, message }, 500);
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
    if (!id) return json({ success: false, message: "Church id is required" }, 400);

    const nameEn = String(body.nameEn || "").trim();
    if (!nameEn) return json({ success: false, message: "nameEn is required" }, 400);

    const res = await db.prepare(
      `UPDATE churches SET name_en=?, name_ta=?, is_mother_church=?, address_en=?, address_ta=?, city=?, country=?, phone=?, email=?, map_url=?, service_times_en=?, service_times_ta=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      nameEn, body.nameTa || null, body.isMotherChurch ? 1 : 0,
      body.addressEn || null, body.addressTa || null, body.city || null, body.country || "India",
      body.phone || null, body.email || null, body.mapUrl || null,
      body.serviceTimesEn || null, body.serviceTimesTa || null,
      body.status === "archived" ? "archived" : "active", Number(body.sortOrder) || 0, id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Church not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.update", entityType: "church", entityId: id, details: { nameEn }
    });

    return json({ success: true, message: "Church updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Church id is required" }, 400);

    // Soft-delete: churches are referenced by other content (events, programs,
    // testimonies), so archive rather than hard-delete.
    const res = await db.prepare("UPDATE churches SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Church not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "churches.archive", entityType: "church", entityId: id
    });

    return json({ success: true, message: "Church archived" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
