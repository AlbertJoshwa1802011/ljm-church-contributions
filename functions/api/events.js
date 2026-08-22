// Cloudflare Pages Function: /api/events
// Church events + photo galleries. Admin manages entries (manage_events);
// the public portal reads published events only.
//
//   GET    /api/events              → public: published events + distinct categories
//          /api/events?id=NN        → published: public detail + photos; draft/other: admin (manage_events) only
//          /api/events?all=1        → admin (manage_events): every event, all statuses
//   POST   /api/events              → admin: create (with optional cover + gallery photos)
//   PUT    /api/events              → admin: update (body.id), add/remove photos
//   DELETE /api/events?id=NN        → admin: delete (and its photos)
//
// Photos are stored in R2 (env.EVENT_PHOTOS binding) when available, served back
// through /api/events/photo?key=... . Without an R2 binding, photos fall back to
// base64 data URLs stored directly in D1 (see storePhoto()).

import { requireAuth, audit, json, errorResponse } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB decoded

// Store a photo (data URL) in R2 if bound, otherwise fall back to base64-in-D1.
// Non-data-URL strings are treated as already-hosted external URLs.
// Rejects (returns null) any data URL whose MIME type isn't an allowed image
// type, or whose decoded size exceeds MAX_PHOTO_BYTES — without these checks
// a crafted `data:text/html;base64,...` payload would be stored and later
// served back through /api/events/photo with that same, attacker-chosen
// Content-Type (a stored-content-type risk on a public endpoint).
async function storePhoto(env, eventId, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;

  if (!dataUrl.startsWith("data:")) {
    return { photo_url: dataUrl, storage: "external" };
  }

  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;

  const mime = (match[1] || "").toLowerCase();
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(mime)) return null;

  const b64 = match[2] || "";
  // base64 decodes to ~3/4 its length; check before decoding to avoid
  // wasting work on an oversized payload.
  if (b64.length * 0.75 > MAX_PHOTO_BYTES) return null;

  if (env.EVENT_PHOTOS) {
    const binary = atob(b64);
    if (binary.length > MAX_PHOTO_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext = mime.split("/")[1];
    const key = `events/${eventId}/${crypto.randomUUID()}.${ext}`;

    await env.EVENT_PHOTOS.put(key, bytes, { httpMetadata: { contentType: mime } });

    return { photo_url: "/api/events/photo?key=" + encodeURIComponent(key), storage: "r2" };
  }

  return { photo_url: dataUrl, storage: "base64" };
}

// Best-effort delete of the underlying R2 object for a photo row. Never throws.
async function deletePhotoObject(env, photo) {
  if (!photo || photo.storage !== "r2" || !env.EVENT_PHOTOS) return;
  try {
    const url = new URL(photo.photo_url, "http://internal");
    const key = url.searchParams.get("key");
    if (key) await env.EVENT_PHOTOS.delete(key);
  } catch (_) {
    // best-effort — ignore
  }
}

function toEventCamel(row) {
  let extra = {};
  try {
    extra = row.extra ? JSON.parse(row.extra) : {};
  } catch (_) {
    extra = {};
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    eventDate: row.event_date,
    location: row.location,
    description: row.description,
    coverPhoto: row.cover_photo,
    status: row.status,
    featured: !!row.featured,
    extra,
    // Additive (migration 0021): nullable church/beneficiary fields — a church-less
    // event (churchId: null) is ministry-wide, per backend-schema §2.8.
    churchId: row.church_id ?? null,
    churchSlug: row.church_slug || undefined,
    churchNameEn: row.church_name_en || undefined,
    beneficiariesCount: row.beneficiaries_count ?? null,
    goodDeedSummaryEn: row.good_deed_summary_en || null,
    goodDeedSummaryTa: row.good_deed_summary_ta || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const wantsAll = url.searchParams.get("all") === "1";
  const churchSlug = url.searchParams.get("church");

  try {
    if (id) {
      const eventRow = await db.prepare(
        `SELECT e.*, c.slug AS church_slug, c.name_en AS church_name_en
         FROM events e LEFT JOIN churches c ON c.id = e.church_id WHERE e.id = ?`
      ).bind(Number(id)).first();
      if (!eventRow) return json({ success: false, message: "Event not found" }, 404);

      // Unpublished events (draft/other) are admin-only — an anonymous or
      // unprivileged caller must not be able to read draft content (internal
      // descriptions, beneficiary counts, unreleased gallery photos) just by
      // guessing/incrementing the numeric id. Respond identically to the
      // not-found case so existence of a draft isn't leaked either.
      if (eventRow.status !== "published") {
        const auth = await requireAuth(context, "manage_events");
        if (!auth.ok) return json({ success: false, message: "Event not found" }, 404);
      }

      const photosQ = await db.prepare(
        "SELECT id, photo_url AS photoUrl, caption, sort_order AS sortOrder FROM event_photos WHERE event_id = ? ORDER BY sort_order ASC, id ASC"
      ).bind(Number(id)).all();

      return json({ event: toEventCamel(eventRow), photos: photosQ.results || [] }, 200,
        corsHeaders({ "Cache-Control": "no-store" }));
    }

    if (wantsAll) {
      const auth = await requireAuth(context, "manage_events");
      if (!auth.ok) return auth.response;

      const q = await db.prepare(
        `SELECT e.*, c.slug AS church_slug, c.name_en AS church_name_en
         FROM events e LEFT JOIN churches c ON c.id = e.church_id
         ORDER BY e.featured DESC, e.event_date DESC, e.id DESC`
      ).all();
      const events = (q.results || []).map(toEventCamel);

      return json({ events }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    // Public listing — published events only, optionally scoped to a church.
    const conditions = ["e.status = 'published'"];
    const args = [];
    if (churchSlug) { conditions.push("c.slug = ?"); args.push(churchSlug); }

    const q = await db.prepare(
      `SELECT e.id, e.title, e.category, e.event_date, e.location, e.description, e.cover_photo, e.featured, e.status,
              e.church_id, c.slug AS church_slug, c.name_en AS church_name_en,
              e.beneficiaries_count, e.good_deed_summary_en, e.good_deed_summary_ta,
              (SELECT COUNT(*) FROM event_photos p WHERE p.event_id = e.id) AS photoCount
       FROM events e LEFT JOIN churches c ON c.id = e.church_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY e.featured DESC, e.event_date DESC, e.id DESC`
    ).bind(...args).all();
    const rows = q.results || [];

    const events = rows.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      eventDate: r.event_date,
      location: r.location,
      description: r.description,
      coverPhoto: r.cover_photo,
      featured: !!r.featured,
      status: r.status,
      photoCount: r.photoCount || 0,
      churchId: r.church_id ?? null,
      churchSlug: r.church_slug || undefined,
      churchNameEn: r.church_name_en || undefined,
      beneficiariesCount: r.beneficiaries_count ?? null,
      goodDeedSummaryEn: r.good_deed_summary_en || null,
      goodDeedSummaryTa: r.good_deed_summary_ta || null
    }));

    const categories = [...new Set(rows.map(r => r.category).filter(Boolean))];

    return json({ events, categories }, 200, corsHeaders({ "Cache-Control": "public, max-age=20" }));
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_events");
  if (!auth.ok) return auth.response;

  try {
    let body;
    try { body = await request.json(); } catch (_) { return json({ success: false, message: "Invalid JSON body" }, 400); }
    const title = String(body.title || "").trim();
    if (!title) return json({ success: false, message: "Title is required" }, 400);

    const category = body.category || null;
    const eventDate = body.eventDate || null;
    const location = body.location || null;
    const description = body.description || null;
    // Only 'draft'/'published' are real statuses (schema.sql's documented
    // enum) — anything else collapses to 'draft' rather than being stored
    // verbatim, matching blog.js's create pattern.
    const status = body.status === "published" ? "published" : "draft";
    const featured = body.featured ? 1 : 0;
    const extra = JSON.stringify(body.extra || {});
    const churchId = body.churchId ? Number(body.churchId) : null;
    const beneficiariesCount = body.beneficiariesCount !== undefined && body.beneficiariesCount !== null && body.beneficiariesCount !== ""
      ? Number(body.beneficiariesCount) : null;
    const goodDeedSummaryEn = body.goodDeedSummaryEn || null;
    const goodDeedSummaryTa = body.goodDeedSummaryTa || null;

    // The event id (used as the R2 key prefix) isn't known until after INSERT,
    // so the cover photo — if a data URL — is stored/patched in once we have it.
    let coverPhotoUrl = null;

    const res = await db.prepare(
      `INSERT INTO events (title, category, event_date, location, description, cover_photo, status, featured, extra, church_id, beneficiaries_count, good_deed_summary_en, good_deed_summary_ta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title, category, eventDate, location, description, null, status, featured, extra, churchId, beneficiariesCount, goodDeedSummaryEn, goodDeedSummaryTa).run();

    const id = res.meta && res.meta.last_row_id;

    if (body.coverPhoto && typeof body.coverPhoto === "string") {
      const stored = await storePhoto(env, id, body.coverPhoto);
      if (stored) {
        coverPhotoUrl = stored.photo_url;
        await db.prepare("UPDATE events SET cover_photo = ? WHERE id = ?").bind(coverPhotoUrl, id).run();
      }
    }

    const photos = Array.isArray(body.photos) ? body.photos : [];
    let firstGalleryPhotoUrl = null;
    for (let i = 0; i < photos.length; i++) {
      const item = photos[i];
      if (!item || !item.dataUrl) continue;
      const stored = await storePhoto(env, id, item.dataUrl);
      if (!stored) continue;
      await db.prepare(
        "INSERT INTO event_photos (event_id, photo_url, storage, caption, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, stored.photo_url, stored.storage, item.caption || null, i).run();
      if (!firstGalleryPhotoUrl) firstGalleryPhotoUrl = stored.photo_url;
    }

    // If no cover was supplied but gallery photos were, use the first gallery photo as cover.
    if (!coverPhotoUrl && firstGalleryPhotoUrl) {
      coverPhotoUrl = firstGalleryPhotoUrl;
      await db.prepare("UPDATE events SET cover_photo = ? WHERE id = ?").bind(coverPhotoUrl, id).run();
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "events.add", entityType: "event", entityId: id,
      details: { title, status, photoCount: photos.length }
    });

    return json({ success: true, id, message: `Event '${title}' added` }, 200, corsHeaders());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_events");
  if (!auth.ok) return auth.response;

  try {
    let body;
    try { body = await request.json(); } catch (_) { return json({ success: false, message: "Invalid JSON body" }, 400); }
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Event id is required" }, 400);

    const title = String(body.title || "").trim();
    if (!title) return json({ success: false, message: "Title is required" }, 400);

    // A caller updating unrelated fields (e.g. just adding/removing photos)
    // must not silently unpublish (or un-draft) the event by omitting
    // `status` — only an explicit 'published'/'draft' changes it, otherwise
    // the existing status carries forward. Matches blog.js's PUT pattern.
    const existing = await db.prepare("SELECT status FROM events WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Event not found" }, 404);

    const category = body.category || null;
    const eventDate = body.eventDate || null;
    const location = body.location || null;
    const description = body.description || null;
    const status = body.status === "published" ? "published" : (body.status === "draft" ? "draft" : existing.status);
    const featured = body.featured ? 1 : 0;
    const extra = JSON.stringify(body.extra || {});
    const churchId = body.churchId ? Number(body.churchId) : null;
    const beneficiariesCount = body.beneficiariesCount !== undefined && body.beneficiariesCount !== null && body.beneficiariesCount !== ""
      ? Number(body.beneficiariesCount) : null;
    const goodDeedSummaryEn = body.goodDeedSummaryEn || null;
    const goodDeedSummaryTa = body.goodDeedSummaryTa || null;

    let coverPhotoUrl = body.coverPhoto && typeof body.coverPhoto === "string" && !body.coverPhoto.startsWith("data:")
      ? body.coverPhoto
      : undefined; // undefined = leave as-is unless we compute a new one below

    if (body.coverPhoto && typeof body.coverPhoto === "string" && body.coverPhoto.startsWith("data:")) {
      const stored = await storePhoto(env, id, body.coverPhoto);
      if (stored) coverPhotoUrl = stored.photo_url;
    }

    const res = coverPhotoUrl !== undefined
      ? await db.prepare(
          `UPDATE events SET title=?, category=?, event_date=?, location=?, description=?, cover_photo=?, status=?, featured=?, extra=?, church_id=?, beneficiaries_count=?, good_deed_summary_en=?, good_deed_summary_ta=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(title, category, eventDate, location, description, coverPhotoUrl, status, featured, extra, churchId, beneficiariesCount, goodDeedSummaryEn, goodDeedSummaryTa, id).run()
      : await db.prepare(
          `UPDATE events SET title=?, category=?, event_date=?, location=?, description=?, status=?, featured=?, extra=?, church_id=?, beneficiaries_count=?, good_deed_summary_en=?, good_deed_summary_ta=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(title, category, eventDate, location, description, status, featured, extra, churchId, beneficiariesCount, goodDeedSummaryEn, goodDeedSummaryTa, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Event not found" }, 404);

    const removePhotoIds = Array.isArray(body.removePhotoIds) ? body.removePhotoIds.map(Number).filter(Boolean) : [];
    for (const photoId of removePhotoIds) {
      const photo = await db.prepare("SELECT * FROM event_photos WHERE id = ? AND event_id = ?").bind(photoId, id).first();
      if (!photo) continue;
      await deletePhotoObject(env, photo);
      await db.prepare("DELETE FROM event_photos WHERE id = ?").bind(photoId).run();
    }

    const addPhotos = Array.isArray(body.addPhotos) ? body.addPhotos : [];
    if (addPhotos.length) {
      const countRow = await db.prepare("SELECT COUNT(*) AS c FROM event_photos WHERE event_id = ?").bind(id).first();
      let nextOrder = (countRow && countRow.c) || 0;
      for (const item of addPhotos) {
        if (!item || !item.dataUrl) continue;
        const stored = await storePhoto(env, id, item.dataUrl);
        if (!stored) continue;
        await db.prepare(
          "INSERT INTO event_photos (event_id, photo_url, storage, caption, sort_order) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, stored.photo_url, stored.storage, item.caption || null, nextOrder).run();
        nextOrder++;
      }
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "events.update", entityType: "event", entityId: id,
      details: { title, status, removedPhotos: removePhotoIds.length, addedPhotos: addPhotos.length }
    });

    return json({ success: true, message: "Event updated" }, 200, corsHeaders());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_events");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Event id is required" }, 400);

    const photosQ = await db.prepare("SELECT * FROM event_photos WHERE event_id = ?").bind(id).all();
    const photos = photosQ.results || [];
    for (const photo of photos) {
      await deletePhotoObject(env, photo);
    }

    // Explicit delete first — D1's foreign_keys pragma may not be enabled, so
    // ON DELETE CASCADE alone can't be relied on to clean up event_photos.
    await db.prepare("DELETE FROM event_photos WHERE event_id = ?").bind(id).run();

    const res = await db.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Event not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "events.delete", entityType: "event", entityId: id
    });

    return json({ success: true, message: "Event deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
