// Cloudflare Pages Function: /api/events
// Church events + photo galleries. Admin manages entries (manage_events);
// the public portal reads published events only.
//
//   GET    /api/events              → public: published events + distinct categories
//          /api/events?id=NN        → single event (any status) + its photos
//          /api/events?all=1        → admin (manage_events): every event, all statuses
//   POST   /api/events              → admin: create (with optional cover + gallery photos)
//   PUT    /api/events              → admin: update (body.id), add/remove photos
//   DELETE /api/events?id=NN        → admin: delete (and its photos)
//
// Photos are stored in R2 (env.EVENT_PHOTOS binding) when available, served back
// through /api/events/photo?key=... . Without an R2 binding, photos fall back to
// base64 data URLs stored directly in D1 (see storePhoto()).

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

// Store a photo (data URL) in R2 if bound, otherwise fall back to base64-in-D1.
// Non-data-URL strings are treated as already-hosted external URLs.
async function storePhoto(env, eventId, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;

  if (!dataUrl.startsWith("data:")) {
    return { photo_url: dataUrl, storage: "external" };
  }

  if (env.EVENT_PHOTOS) {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!match) return { photo_url: dataUrl, storage: "base64" };

    const mime = match[1] || "image/jpeg";
    const b64 = match[2] || "";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext = (mime.split("/")[1] || "jpg").split("+")[0];
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

  try {
    if (id) {
      const eventRow = await db.prepare("SELECT * FROM events WHERE id = ?").bind(Number(id)).first();
      if (!eventRow) return json({ success: false, message: "Event not found" }, 404);

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
        `SELECT id, title, category, event_date, location, description, cover_photo, status, featured, extra, created_at, updated_at
         FROM events ORDER BY featured DESC, event_date DESC, id DESC`
      ).all();
      const events = (q.results || []).map(toEventCamel);

      return json({ events }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    // Public listing — published events only.
    const q = await db.prepare(
      `SELECT id, title, category, event_date, location, description, cover_photo, featured, status,
              (SELECT COUNT(*) FROM event_photos p WHERE p.event_id = events.id) AS photoCount
       FROM events
       WHERE status = 'published'
       ORDER BY featured DESC, event_date DESC, id DESC`
    ).all();
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
      photoCount: r.photoCount || 0
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
    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) return json({ success: false, message: "Title is required" }, 400);

    const category = body.category || null;
    const eventDate = body.eventDate || null;
    const location = body.location || null;
    const description = body.description || null;
    const status = body.status === "published" ? "published" : (body.status || "draft");
    const featured = body.featured ? 1 : 0;
    const extra = JSON.stringify(body.extra || {});

    // The event id (used as the R2 key prefix) isn't known until after INSERT,
    // so the cover photo — if a data URL — is stored/patched in once we have it.
    let coverPhotoUrl = null;

    const res = await db.prepare(
      `INSERT INTO events (title, category, event_date, location, description, cover_photo, status, featured, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title, category, eventDate, location, description, null, status, featured, extra).run();

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
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_events");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Event id is required" }, 400);

    const title = String(body.title || "").trim();
    if (!title) return json({ success: false, message: "Title is required" }, 400);

    const category = body.category || null;
    const eventDate = body.eventDate || null;
    const location = body.location || null;
    const description = body.description || null;
    const status = body.status === "published" ? "published" : (body.status || "draft");
    const featured = body.featured ? 1 : 0;
    const extra = JSON.stringify(body.extra || {});

    let coverPhotoUrl = body.coverPhoto && typeof body.coverPhoto === "string" && !body.coverPhoto.startsWith("data:")
      ? body.coverPhoto
      : undefined; // undefined = leave as-is unless we compute a new one below

    if (body.coverPhoto && typeof body.coverPhoto === "string" && body.coverPhoto.startsWith("data:")) {
      const stored = await storePhoto(env, id, body.coverPhoto);
      if (stored) coverPhotoUrl = stored.photo_url;
    }

    const res = coverPhotoUrl !== undefined
      ? await db.prepare(
          `UPDATE events SET title=?, category=?, event_date=?, location=?, description=?, cover_photo=?, status=?, featured=?, extra=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(title, category, eventDate, location, description, coverPhotoUrl, status, featured, extra, id).run()
      : await db.prepare(
          `UPDATE events SET title=?, category=?, event_date=?, location=?, description=?, status=?, featured=?, extra=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        ).bind(title, category, eventDate, location, description, status, featured, extra, id).run();

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
    return json({ success: false, message: err.message }, 500);
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
