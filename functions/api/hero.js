// Cloudflare Pages Function: /api/hero
// Admin-managed header carousel slides for the V2 home page
// (docs/milestone-v2/13-home-experience-rework.md, issues 3 & 4).
//
//   GET    /api/hero            → public: active slides inside their date window
//          /api/hero?all=1      → admin (manage_content): every slide, any status
//   POST   /api/hero            → admin: create
//   PUT    /api/hero            → admin: update (body.id)
//   DELETE /api/hero?id=NN      → admin: archive (soft delete)
//
// Each slide has a required light image and an optional dark one; the frontend
// falls back to the light image when no dark variant was uploaded.

import { requireAuth, audit, json } from "./_lib.js";
import { storeMedia, deleteMedia } from "./_media.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toSlide(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    captionEn: row.caption_en,
    captionTa: row.caption_ta,
    altEn: row.alt_en,
    altTa: row.alt_ta,
    imageLightUrl: row.image_light_url,
    imageDarkUrl: row.image_dark_url,
    linkUrl: row.link_url,
    churchId: row.church_id,
    churchNameEn: row.church_name_en || undefined,
    status: row.status,
    sortOrder: row.sort_order,
    startsOn: row.starts_on,
    endsOn: row.ends_on
  };
}

// Today in IST (UTC+5:30) as 'YYYY-MM-DD'. Workers run on UTC, so a slide
// scheduled for "today" by an admin in Coimbatore must be resolved against
// India time — same approach as promises.js:25-33.
function istToday() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// Optional 'YYYY-MM-DD' string, or null. Anything malformed is rejected so a
// typo can't silently make a slide permanently invisible.
function parseDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) throw new Error(`${field} must be a YYYY-MM-DD date`);
  return str;
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
      const q = await db.prepare(
        `SELECT h.*, c.name_en AS church_name_en
         FROM hero_slides h LEFT JOIN churches c ON c.id = h.church_id
         ORDER BY h.sort_order ASC, h.id ASC`
      ).all();
      return json({ success: true, slides: (q.results || []).map(toSlide) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const today = istToday();
    const q = await db.prepare(
      `SELECT h.*, c.name_en AS church_name_en
       FROM hero_slides h LEFT JOIN churches c ON c.id = h.church_id
       WHERE h.status = 'active'
         AND (h.starts_on IS NULL OR h.starts_on <= ?)
         AND (h.ends_on   IS NULL OR h.ends_on   >= ?)
       ORDER BY h.sort_order ASC, h.id ASC`
    ).bind(today, today).all();

    return json({ success: true, slides: (q.results || []).map(toSlide) }, 200, corsHeaders({ "Cache-Control": "public, max-age=120" }));
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

    const light = await storeMedia(env, "hero", body.imageLightUrl);
    if (!light) return json({ success: false, message: "A light-mode image is required" }, 400);
    const dark = await storeMedia(env, "hero", body.imageDarkUrl);

    const startsOn = parseDate(body.startsOn, "startsOn");
    const endsOn = parseDate(body.endsOn, "endsOn");
    if (startsOn && endsOn && endsOn < startsOn) {
      return json({ success: false, message: "endsOn cannot be before startsOn" }, 400);
    }

    const res = await db.prepare(
      `INSERT INTO hero_slides (title_en, title_ta, caption_en, caption_ta, alt_en, alt_ta,
         image_light_url, image_light_storage, image_dark_url, image_dark_storage,
         link_url, church_id, status, sort_order, starts_on, ends_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.titleEn || null, body.titleTa || null, body.captionEn || null, body.captionTa || null,
      body.altEn || null, body.altTa || null,
      light.url, light.storage, dark ? dark.url : null, dark ? dark.storage : null,
      body.linkUrl || null, body.churchId ? Number(body.churchId) : null,
      body.status === "archived" ? "archived" : "active", Number(body.sortOrder) || 0,
      startsOn, endsOn
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "hero.add", entityType: "hero_slide", entityId: id, details: { titleEn: body.titleEn || null }
    });

    return json({ success: true, id, message: "Header image added" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Slide id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM hero_slides WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Header image not found" }, 404);

    const light = await storeMedia(env, "hero", body.imageLightUrl);
    if (!light) return json({ success: false, message: "A light-mode image is required" }, 400);
    const dark = await storeMedia(env, "hero", body.imageDarkUrl);

    const startsOn = parseDate(body.startsOn, "startsOn");
    const endsOn = parseDate(body.endsOn, "endsOn");
    if (startsOn && endsOn && endsOn < startsOn) {
      return json({ success: false, message: "endsOn cannot be before startsOn" }, 400);
    }

    // An absent `status` keeps whatever the slide already had, so editing an
    // archived slide never silently republishes it (the churches.js bug this
    // rework fixes — see docs/milestone-v2/13-home-experience-rework.md).
    const status = body.status === undefined || body.status === null || body.status === ""
      ? existing.status
      : (body.status === "archived" ? "archived" : "active");

    await db.prepare(
      `UPDATE hero_slides SET title_en=?, title_ta=?, caption_en=?, caption_ta=?, alt_en=?, alt_ta=?,
         image_light_url=?, image_light_storage=?, image_dark_url=?, image_dark_storage=?,
         link_url=?, church_id=?, status=?, sort_order=?, starts_on=?, ends_on=?,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      body.titleEn || null, body.titleTa || null, body.captionEn || null, body.captionTa || null,
      body.altEn || null, body.altTa || null,
      light.url, light.storage, dark ? dark.url : null, dark ? dark.storage : null,
      body.linkUrl || null, body.churchId ? Number(body.churchId) : null,
      status, Number(body.sortOrder) || 0, startsOn, endsOn, id
    ).run();

    // Clean up any R2 object the edit just replaced.
    if (existing.image_light_url !== light.url) {
      await deleteMedia(env, existing.image_light_url, existing.image_light_storage);
    }
    if (existing.image_dark_url && existing.image_dark_url !== (dark ? dark.url : null)) {
      await deleteMedia(env, existing.image_dark_url, existing.image_dark_storage);
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "hero.update", entityType: "hero_slide", entityId: id, details: { titleEn: body.titleEn || null }
    });

    return json({ success: true, message: "Header image updated" }, 200, corsHeaders());
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
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return json({ success: false, message: "Slide id is required" }, 400);

    // Soft-archive by default (recoverable, matching churches.js). ?hard=1
    // removes the row and its R2 objects for good.
    if (url.searchParams.get("hard") === "1") {
      const existing = await db.prepare("SELECT * FROM hero_slides WHERE id = ?").bind(id).first();
      if (!existing) return json({ success: false, message: "Header image not found" }, 404);
      await db.prepare("DELETE FROM hero_slides WHERE id = ?").bind(id).run();
      await deleteMedia(env, existing.image_light_url, existing.image_light_storage);
      await deleteMedia(env, existing.image_dark_url, existing.image_dark_storage);
      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "hero.delete", entityType: "hero_slide", entityId: id
      });
      return json({ success: true, message: "Header image deleted" }, 200, corsHeaders());
    }

    const res = await db.prepare(
      "UPDATE hero_slides SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Header image not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "hero.archive", entityType: "hero_slide", entityId: id
    });

    return json({ success: true, message: "Header image archived" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
