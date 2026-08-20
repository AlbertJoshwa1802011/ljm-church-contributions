// Cloudflare Pages Function: /api/promises
// Admin-curated daily/monthly/yearly "promise word" content, auto-shipped by
// date (PRD §7.2, backend-schema §2.2). Ministry timezone = IST (UTC+5:30)
// for resolving "today".
//
//   GET    /api/promises?when=today   → public: { daily, monthly, yearly } for right now
//          /api/promises              → admin (manage_content): full list, newest first
//   POST   /api/promises              → admin: create
//   PUT    /api/promises              → admin: update (body.id)
//   DELETE /api/promises?id=NN        → admin: delete

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

// "Today" in IST, as 'YYYY-MM-DD' / month / year — independent of the
// server's own timezone (Cloudflare Workers run in UTC).
function istNow() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return {
    date: ist.toISOString().slice(0, 10),
    month: ist.getUTCMonth() + 1,
    year: ist.getUTCFullYear()
  };
}

function toPromise(row) {
  if (!row) return null;
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
    isPublished: !!row.is_published
  };
}

// Resolve one scope: exact match for "now" first, else fall back to the most
// recent published row of that scope (so a day/month/year with nothing
// assigned still shows something, per backend-schema §2.2).
async function resolveScope(db, scope, now) {
  let exact = null;
  if (scope === "daily") {
    exact = await db.prepare(
      "SELECT * FROM promises WHERE scope='daily' AND on_date=? AND is_published=1"
    ).bind(now.date).first();
  } else if (scope === "monthly") {
    exact = await db.prepare(
      "SELECT * FROM promises WHERE scope='monthly' AND month=? AND year=? AND is_published=1"
    ).bind(now.month, now.year).first();
  } else if (scope === "yearly") {
    exact = await db.prepare(
      "SELECT * FROM promises WHERE scope='yearly' AND year=? AND is_published=1"
    ).bind(now.year).first();
  }
  if (exact) return exact;

  return db.prepare(
    "SELECT * FROM promises WHERE scope=? AND is_published=1 ORDER BY created_at DESC LIMIT 1"
  ).bind(scope).first();
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const when = url.searchParams.get("when");

  try {
    if (when === "today") {
      const now = istNow();
      const [daily, monthly, yearly] = await Promise.all([
        resolveScope(db, "daily", now),
        resolveScope(db, "monthly", now),
        resolveScope(db, "yearly", now)
      ]);
      return json({
        success: true,
        today: { daily: toPromise(daily), monthly: toPromise(monthly), yearly: toPromise(yearly) }
      }, 200, corsHeaders({ "Cache-Control": "public, max-age=300" }));
    }

    // Admin listing — every promise, any scope.
    const auth = await requireAuth(context, "manage_content");
    if (!auth.ok) return auth.response;

    const q = await db.prepare("SELECT * FROM promises ORDER BY scope ASC, year DESC, month DESC, on_date DESC, id DESC").all();
    return json({ success: true, promises: (q.results || []).map(toPromise) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

const SCOPES = ["daily", "monthly", "yearly"];

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    let body;
    try { body = await request.json(); } catch (_) { return json({ success: false, message: "Invalid JSON body" }, 400); }
    const scope = SCOPES.includes(body.scope) ? body.scope : null;
    const textEn = String(body.textEn || "").trim();
    if (!scope) return json({ success: false, message: "scope must be one of daily/monthly/yearly" }, 400);
    if (!textEn) return json({ success: false, message: "textEn is required" }, 400);
    if (scope === "daily" && !body.onDate) return json({ success: false, message: "onDate is required for a daily promise" }, 400);
    if ((scope === "monthly" || scope === "yearly") && !body.year) return json({ success: false, message: "year is required for a monthly/yearly promise" }, 400);
    if (scope === "monthly" && !body.month) return json({ success: false, message: "month is required for a monthly promise" }, 400);

    const res = await db.prepare(
      `INSERT INTO promises (scope, on_date, month, year, reference, text_en, text_ta, reflection_en, reflection_ta, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      scope, scope === "daily" ? body.onDate : null,
      scope === "monthly" ? Number(body.month) : null,
      scope !== "daily" ? Number(body.year) : null,
      body.reference || null, textEn, body.textTa || null,
      body.reflectionEn || null, body.reflectionTa || null,
      body.isPublished === false ? 0 : 1, auth.email
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "promises.add", entityType: "promise", entityId: id, details: { scope }
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
    let body;
    try { body = await request.json(); } catch (_) { return json({ success: false, message: "Invalid JSON body" }, 400); }
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Promise id is required" }, 400);
    const scope = SCOPES.includes(body.scope) ? body.scope : null;
    const textEn = String(body.textEn || "").trim();
    if (!scope) return json({ success: false, message: "scope must be one of daily/monthly/yearly" }, 400);
    if (!textEn) return json({ success: false, message: "textEn is required" }, 400);

    const res = await db.prepare(
      `UPDATE promises SET scope=?, on_date=?, month=?, year=?, reference=?, text_en=?, text_ta=?, reflection_en=?, reflection_ta=?, is_published=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      scope, scope === "daily" ? body.onDate : null,
      scope === "monthly" ? Number(body.month) : null,
      scope !== "daily" ? Number(body.year) : null,
      body.reference || null, textEn, body.textTa || null,
      body.reflectionEn || null, body.reflectionTa || null,
      body.isPublished === false ? 0 : 1, id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Promise not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "promises.update", entityType: "promise", entityId: id, details: { scope }
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
