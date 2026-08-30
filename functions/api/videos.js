// Cloudflare Pages Function: /api/videos
// Admin-managed YouTube videos with optional custom thumbnails, played inline
// on the site (docs/milestone-v2/13-home-experience-rework.md, issue 5).
//
//   GET    /api/videos          → public: published videos
//          /api/videos?all=1    → admin (manage_content): every status
//   POST   /api/videos          → admin: create
//   PUT    /api/videos          → admin: update (body.id)
//   DELETE /api/videos?id=NN    → admin: delete
//
// The YouTube id is normalised server-side so the frontend never has to parse
// URLs, and so a pasted link that isn't YouTube is rejected at the door rather
// than rendering a broken embed.

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

// A YouTube video id is exactly 11 URL-safe characters.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts every form an admin might paste — watch?v=, youtu.be/, /live/,
// /embed/, /shorts/, or a bare id — and returns the 11-character id, or null
// when the link isn't a recognisable YouTube video.
export function parseYouTubeId(input) {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  if (VIDEO_ID.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.startsWith("http") ? raw : "https://" + raw);
  } catch (_) {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const isYouTube = host === "youtube.com" || host === "m.youtube.com" ||
    host === "youtube-nocookie.com" || host === "youtu.be";
  if (!isYouTube) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && VIDEO_ID.test(id) ? id : null;
  }

  const v = url.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["live", "embed", "shorts", "v"].includes(parts[0])) {
    return VIDEO_ID.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

function toVideo(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    descriptionEn: row.description_en,
    descriptionTa: row.description_ta,
    youtubeUrl: row.youtube_url,
    videoId: row.video_id,
    // No custom thumbnail uploaded → fall back to YouTube's own still, so a
    // video always has a picture without the admin having to make one.
    thumbnailUrl: row.thumbnail_url || (row.video_id ? `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg` : null),
    hasCustomThumbnail: !!row.thumbnail_url,
    churchId: row.church_id,
    churchNameEn: row.church_name_en || undefined,
    isLive: !!row.is_live,
    status: row.status,
    sortOrder: row.sort_order,
    publishedAt: row.published_at
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
      const q = await db.prepare(
        `SELECT v.*, c.name_en AS church_name_en
         FROM videos v LEFT JOIN churches c ON c.id = v.church_id
         ORDER BY v.sort_order ASC, v.id DESC`
      ).all();
      return json({ success: true, videos: (q.results || []).map(toVideo) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const q = await db.prepare(
      `SELECT v.*, c.name_en AS church_name_en
       FROM videos v LEFT JOIN churches c ON c.id = v.church_id
       WHERE v.status = 'published'
       ORDER BY v.is_live DESC, v.sort_order ASC, v.id DESC`
    ).all();

    return json({ success: true, videos: (q.results || []).map(toVideo) }, 200, corsHeaders({ "Cache-Control": "public, max-age=120" }));
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

    const youtubeUrl = String(body.youtubeUrl || "").trim();
    if (!youtubeUrl) return json({ success: false, message: "youtubeUrl is required" }, 400);
    const videoId = parseYouTubeId(youtubeUrl);
    if (!videoId) return json({ success: false, message: "That doesn't look like a YouTube video link" }, 400);

    const thumb = await storeMedia(env, "videos", body.thumbnailUrl);

    const res = await db.prepare(
      `INSERT INTO videos (title_en, title_ta, description_en, description_ta, youtube_url, video_id,
         thumbnail_url, thumbnail_storage, church_id, is_live, status, sort_order, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      youtubeUrl, videoId, thumb ? thumb.url : null, thumb ? thumb.storage : null,
      body.churchId ? Number(body.churchId) : null, body.isLive ? 1 : 0,
      body.status === "draft" ? "draft" : "published", Number(body.sortOrder) || 0,
      body.publishedAt || null
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "videos.add", entityType: "video", entityId: id, details: { titleEn, videoId }
    });

    return json({ success: true, id, videoId, message: `Video '${titleEn}' added` }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Video id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM videos WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Video not found" }, 404);

    const titleEn = String(body.titleEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);

    const youtubeUrl = String(body.youtubeUrl || "").trim();
    if (!youtubeUrl) return json({ success: false, message: "youtubeUrl is required" }, 400);
    const videoId = parseYouTubeId(youtubeUrl);
    if (!videoId) return json({ success: false, message: "That doesn't look like a YouTube video link" }, 400);

    const thumb = await storeMedia(env, "videos", body.thumbnailUrl);

    const status = body.status === undefined || body.status === null || body.status === ""
      ? existing.status
      : (body.status === "draft" ? "draft" : "published");

    await db.prepare(
      `UPDATE videos SET title_en=?, title_ta=?, description_en=?, description_ta=?, youtube_url=?, video_id=?,
         thumbnail_url=?, thumbnail_storage=?, church_id=?, is_live=?, status=?, sort_order=?, published_at=?,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      youtubeUrl, videoId, thumb ? thumb.url : null, thumb ? thumb.storage : null,
      body.churchId ? Number(body.churchId) : null, body.isLive ? 1 : 0,
      status, Number(body.sortOrder) || 0, body.publishedAt || null, id
    ).run();

    if (existing.thumbnail_url && existing.thumbnail_url !== (thumb ? thumb.url : null)) {
      await deleteMedia(env, existing.thumbnail_url, existing.thumbnail_storage);
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "videos.update", entityType: "video", entityId: id, details: { titleEn, videoId }
    });

    return json({ success: true, videoId, message: "Video updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Video id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM videos WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Video not found" }, 404);

    await db.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
    await deleteMedia(env, existing.thumbnail_url, existing.thumbnail_storage);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "videos.delete", entityType: "video", entityId: id
    });

    return json({ success: true, message: "Video deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
