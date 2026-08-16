// Cloudflare Pages Function: /api/promises
// Milestone v2, Phase 1 — daily/monthly/yearly "promise word" cards.
//
//   GET    /api/promises?when=today   → public: { daily, monthly, yearly } resolved
//                                        for the ministry's timezone (IST), each
//                                        falling back to the most recent published
//                                        row of that scope when none is assigned.
//          /api/promises?scope=daily  → public: published rows of one scope, newest first
//          /api/promises?all=1        → admin (manage_content): every row, any status
//   POST   /api/promises              → admin (manage_content): create
//   PUT    /api/promises              → admin (manage_content): update (body.id)
//   DELETE /api/promises?id=NN        → admin (manage_content): delete
//
// The resolver is intentionally forgiving: an empty calendar (nothing scheduled for
// today) must never render a blank Home hero — it always has a published fallback.

import { requireAuth, audit, json } from "./_lib.js";

const VALID_SCOPES = ["daily", "monthly", "yearly"];

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toPromise(row) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// IST = UTC+5:30, no DST. Returns { dateStr: 'YYYY-MM-DD', year, month(1-12) }.
export function istToday(now = new Date()) {
  const ist = new Date(now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000);
  const year = ist.getFullYear();
  const month = ist.getMonth() + 1;
  const day = ist.getDate();
  const pad = n => String(n).padStart(2, "0");
  return { dateStr: `${year}-${pad(month)}-${pad(day)}`, year, month };
}

async function resolveDaily(db, dateStr) {
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='daily' AND on_date=? AND is_published=1 LIMIT 1"
  ).bind(dateStr).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='daily' AND is_published=1 ORDER BY on_date DESC, id DESC LIMIT 1"
  ).first();
}

async function resolveMonthly(db, year, month) {
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='monthly' AND year=? AND month=? AND is_published=1 LIMIT 1"
  ).bind(year, month).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='monthly' AND is_published=1 ORDER BY year DESC, month DESC, id DESC LIMIT 1"
  ).first();
}

async function resolveYearly(db, year) {
  const exact = await db.prepare(
    "SELECT * FROM promises WHERE scope='yearly' AND year=? AND is_published=1 LIMIT 1"
  ).bind(year).first();
  if (exact) return exact;
  return db.prepare(
    "SELECT * FROM promises WHERE scope='yearly' AND is_published=1 ORDER BY year DESC, id DESC LIMIT 1"
  ).first();
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  const when = url.searchParams.get("when");
  const scope = url.searchParams.get("scope");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM promises ORDER BY scope, COALESCE(on_date, ''), year DESC, month DESC, id DESC").all();
      return json({ success: true, promises: (q.results || []).map(toPromise) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    if (when === "today") {
      const { dateStr, year, month } = istToday();
      const [daily, monthly, yearly] = await Promise.all([
        resolveDaily(db, dateStr),
        resolveMonthly(db, year, month),
        resolveYearly(db, year)
      ]);
      return json({
        success: true,
        today: {
          daily: daily ? toPromise(daily) : null,
          monthly: monthly ? toPromise(monthly) : null,
          yearly: yearly ? toPromise(yearly) : null
        }
      }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
    }

    if (scope && VALID_SCOPES.includes(scope)) {
      const q = await db.prepare(
        "SELECT * FROM promises WHERE scope=? AND is_published=1 ORDER BY COALESCE(on_date,''), year DESC, month DESC, id DESC"
      ).bind(scope).all();
      return json({ success: true, promises: (q.results || []).map(toPromise) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
    }

    const q = await db.prepare(
      "SELECT * FROM promises WHERE is_published=1 ORDER BY created_at DESC, id DESC"
    ).all();
    return json({ success: true, promises: (q.results || []).map(toPromise) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

function validateBody(body) {
  const scope = body.scope;
  if (!VALID_SCOPES.includes(scope)) return "scope must be 'daily', 'monthly', or 'yearly'";
  const textEn = String(body.textEn || "").trim();
  if (!textEn) return "textEn is required";
  if (scope === "daily" && !body.onDate) return "onDate is required for scope='daily'";
  if ((scope === "monthly" || scope === "yearly") && !body.year) return "year is required for this scope";
  if (scope === "monthly" && !body.month) return "month is required for scope='monthly'";
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
      action: "promises.add", entityType: "promise", entityId: id, details: { scope: body.scope }
    });

    return json({ success: true, id, message: "Promise added" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Promise id is required" }, 400);
    const err = validateBody(body);
    if (err) return json({ success: false, message: err }, 400);

    const res = await db.prepare(
      `UPDATE promises SET scope=?, on_date=?, month=?, year=?, reference=?, text_en=?, text_ta=?, reflection_en=?, reflection_ta=?, is_published=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      body.scope, body.onDate || null, body.month || null, body.year || null, body.reference || null,
      String(body.textEn).trim(), body.textTa || null, body.reflectionEn || null, body.reflectionTa || null,
      body.isPublished === false ? 0 : 1, id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Promise not found" }, 404);

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
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Promise id is required" }, 400);

    const res = await db.prepare("DELETE FROM promises WHERE id=?").bind(id).run();
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
