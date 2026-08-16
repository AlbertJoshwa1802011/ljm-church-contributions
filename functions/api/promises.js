// Cloudflare Pages Function: /api/promises
// Daily/Monthly/Yearly "promise word" content — PRD §7.1–7.2, schema doc §2.2.
//
//   GET    /api/promises?when=today   → public: today's resolved daily/monthly/yearly
//                                        promise (IST), each falling back to the most
//                                        recently published row of that scope if none
//                                        is assigned for the exact date/month/year.
//          /api/promises              → admin (manage_content): full list, newest first
//          /api/promises?id=NN        → admin (manage_content): single promise
//   POST   /api/promises              → admin: create
//   PUT    /api/promises              → admin: update (body.id)
//   DELETE /api/promises?id=NN        → admin: delete

import { requireAuth, audit, json } from "./_lib.js";

const SCOPES = ["daily", "monthly", "yearly"];

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
    scope: row.scope,
    onDate: row.on_date,
    month: row.month,
    year: row.year,
    reference: row.reference,
    textEn: row.text_en,
    textTa: row.text_ta,
    reflectionEn: row.reflection_en,
    reflectionTa: row.reflection_ta,
    isPublished: !!row.is_published,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// "Today" in ministry timezone (IST, UTC+5:30) — matches the convention already
// established by webhook.js for contribution timestamps.
function istNow() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

async function resolveDaily(db, ist) {
  const onDate = ist.toISOString().slice(0, 10);
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='daily' AND on_date=? AND is_published=1 LIMIT 1"
  ).bind(onDate).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='daily' AND is_published=1 ORDER BY on_date DESC LIMIT 1"
  ).first();
}

async function resolveMonthly(db, ist) {
  const month = ist.getUTCMonth() + 1;
  const year = ist.getUTCFullYear();
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='monthly' AND month=? AND year=? AND is_published=1 LIMIT 1"
  ).bind(month, year).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='monthly' AND is_published=1 ORDER BY year DESC, month DESC LIMIT 1"
  ).first();
}

async function resolveYearly(db, ist) {
  const year = ist.getUTCFullYear();
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='yearly' AND year=? AND is_published=1 LIMIT 1"
  ).bind(year).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='yearly' AND is_published=1 ORDER BY year DESC LIMIT 1"
  ).first();
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);

  try {
    if (url.searchParams.get("when") === "today") {
      const ist = istNow();
      const [daily, monthly, yearly] = await Promise.all([
        resolveDaily(db, ist), resolveMonthly(db, ist), resolveYearly(db, ist)
      ]);
      return json({
        success: true,
        today: {
          daily: daily ? toCamel(daily) : null,
          monthly: monthly ? toCamel(monthly) : null,
          yearly: yearly ? toCamel(yearly) : null
        }
      }, 200, corsHeaders({ "Cache-Control": "public, max-age=300" }));
    }

    const auth = await requireAuth(context, "manage_content");
    if (!auth.ok) return auth.response;

    const id = url.searchParams.get("id");
    if (id) {
      const row = await db.prepare("SELECT * FROM promises WHERE id = ?").bind(Number(id)).first();
      if (!row) return json({ success: false, message: "Promise not found" }, 404);
      return json({ success: true, promise: toCamel(row) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const q = await db.prepare(
      "SELECT * FROM promises ORDER BY scope ASC, year DESC, month DESC, on_date DESC, id DESC"
    ).all();
    return json({ success: true, promises: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

function validateBody(body) {
  const scope = body.scope;
  if (!SCOPES.includes(scope)) return `scope must be one of: ${SCOPES.join(", ")}`;
  if (!String(body.textEn || "").trim()) return "textEn is required";
  if (scope === "daily" && !body.onDate) return "onDate is required for scope='daily'";
  if (scope === "monthly" && (!body.month || !body.year)) return "month and year are required for scope='monthly'";
  if (scope === "yearly" && !body.year) return "year is required for scope='yearly'";
  return null;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const error = validateBody(body);
    if (error) return json({ success: false, message: error }, 400);

    const res = await db.prepare(
      `INSERT INTO promises (scope, on_date, month, year, reference, text_en, text_ta, reflection_en, reflection_ta, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.scope, body.onDate || null, body.month || null, body.year || null, body.reference || null,
      String(body.textEn).trim(), body.textTa || null, body.reflectionEn || null, body.reflectionTa || null,
      body.isPublished === false ? 0 : 1, auth.email
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "promises.add", entityType: "promise", entityId: id,
      details: { scope: body.scope, onDate: body.onDate, month: body.month, year: body.year }
    });

    return json({ success: true, id, message: "Promise added" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Promise id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM promises WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Promise not found" }, 404);

    const merged = {
      scope: body.scope !== undefined ? body.scope : existing.scope,
      onDate: body.onDate !== undefined ? body.onDate : existing.on_date,
      month: body.month !== undefined ? body.month : existing.month,
      year: body.year !== undefined ? body.year : existing.year,
      textEn: body.textEn !== undefined ? body.textEn : existing.text_en
    };
    const error = validateBody(merged);
    if (error) return json({ success: false, message: error }, 400);

    await db.prepare(
      `UPDATE promises SET scope=?, on_date=?, month=?, year=?, reference=?, text_en=?, text_ta=?, reflection_en=?, reflection_ta=?, is_published=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      merged.scope, merged.onDate || null, merged.month || null, merged.year || null,
      body.reference !== undefined ? body.reference : existing.reference,
      String(merged.textEn).trim(),
      body.textTa !== undefined ? body.textTa : existing.text_ta,
      body.reflectionEn !== undefined ? body.reflectionEn : existing.reflection_en,
      body.reflectionTa !== undefined ? body.reflectionTa : existing.reflection_ta,
      body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
      id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "promises.update", entityType: "promise", entityId: id
    });

    return json({ success: true, message: "Promise updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Promise id is required" }, 400);

    const res = await db.prepare("DELETE FROM promises WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Promise not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "promises.delete", entityType: "promise", entityId: id
    });

    return json({ success: true, message: "Promise deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
