// Cloudflare Pages Function: /api/blog
// Milestone v2, Phase 5 — blog / articles. Also backs the Youth Ministry hub via
// ?ministry=youth (PRD §7.9-7.10) so youth content reuses this one CMS type.
//
//   GET    /api/blog                  → public: published posts (?category=&ministry=)
//          /api/blog?slug=my-post     → public: single published post by slug
//          /api/blog?all=1            → admin (manage_content): every post, any status
//   POST   /api/blog                  → admin (manage_content): create
//   PUT    /api/blog                  → admin (manage_content): update (body.id)
//   DELETE /api/blog?id=NN            → admin (manage_content): delete

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

function toPost(row) {
  return {
    id: row.id,
    slug: row.slug,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    bodyEn: row.body_en,
    bodyTa: row.body_ta,
    excerptEn: row.excerpt_en,
    excerptTa: row.excerpt_ta,
    category: row.category,
    coverUrl: row.cover_url,
    ministryArea: row.ministry_area,
    status: row.status,
    author: row.author,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at
  };
}

function slugify(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const wantsAll = url.searchParams.get("all") === "1";
  const category = url.searchParams.get("category");
  const ministry = url.searchParams.get("ministry");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare("SELECT * FROM blog_posts ORDER BY created_at DESC").all();
      return json({ success: true, posts: (q.results || []).map(toPost) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    if (slug) {
      const row = await db.prepare("SELECT * FROM blog_posts WHERE slug=?").bind(slug).first();
      if (!row || row.status !== "published") return json({ success: false, message: "Post not found" }, 404);
      return json({ success: true, post: toPost(row) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
    }

    let sql = "SELECT * FROM blog_posts WHERE status='published'";
    const binds = [];
    if (category) { sql += " AND category=?"; binds.push(category); }
    if (ministry) { sql += " AND ministry_area=?"; binds.push(ministry); }
    sql += " ORDER BY published_at DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...binds).all();
    return json({ success: true, posts: (q.results || []).map(toPost) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ success: false, message: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const titleEn = String(body.titleEn || "").trim();
    const bodyEn = String(body.bodyEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);

    const slug = slugify(body.slug || titleEn);
    if (!slug) return json({ success: false, message: "Could not derive a slug — provide one" }, 400);

    const status = body.status === "published" ? "published" : "draft";
    const publishedAt = status === "published" ? new Date().toISOString() : null;

    const res = await db.prepare(
      `INSERT INTO blog_posts (slug, title_en, title_ta, body_en, body_ta, excerpt_en, excerpt_ta, category, cover_url, ministry_area, status, author, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      slug, titleEn, body.titleTa || null, bodyEn, body.bodyTa || null,
      body.excerptEn || null, body.excerptTa || null, body.category || null, body.coverUrl || null,
      body.ministryArea || null, status, auth.email, publishedAt
    ).run();

    const id = res.meta && res.meta.last_row_id;
    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "blog.add", entityType: "blog_post", entityId: id, details: { slug, status }
    });

    return json({ success: true, id, slug, message: "Post added" }, 200, corsHeaders());
  } catch (err) {
    const message = /UNIQUE/.test(err.message) ? "A post with that slug already exists" : err.message;
    return json({ success: false, message }, 400);
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
    if (!id) return json({ success: false, message: "Post id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM blog_posts WHERE id=?").bind(id).first();
    if (!existing) return json({ success: false, message: "Post not found" }, 404);

    const titleEn = body.titleEn !== undefined ? String(body.titleEn).trim() : existing.title_en;
    const bodyEn = body.bodyEn !== undefined ? String(body.bodyEn).trim() : existing.body_en;
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);

    const status = body.status === "published" || body.status === "draft" ? body.status : existing.status;
    const publishedAt = status === "published" ? (existing.published_at || new Date().toISOString()) : existing.published_at;

    await db.prepare(
      `UPDATE blog_posts SET title_en=?, title_ta=?, body_en=?, body_ta=?, excerpt_en=?, excerpt_ta=?, category=?, cover_url=?, ministry_area=?, status=?, published_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      titleEn, body.titleTa !== undefined ? body.titleTa : existing.title_ta,
      bodyEn, body.bodyTa !== undefined ? body.bodyTa : existing.body_ta,
      body.excerptEn !== undefined ? body.excerptEn : existing.excerpt_en,
      body.excerptTa !== undefined ? body.excerptTa : existing.excerpt_ta,
      body.category !== undefined ? body.category : existing.category,
      body.coverUrl !== undefined ? body.coverUrl : existing.cover_url,
      body.ministryArea !== undefined ? body.ministryArea : existing.ministry_area,
      status, publishedAt, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "blog.update", entityType: "blog_post", entityId: id, details: { status }
    });

    return json({ success: true, message: "Post updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Post id is required" }, 400);

    const res = await db.prepare("DELETE FROM blog_posts WHERE id=?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Post not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "blog.delete", entityType: "blog_post", entityId: id
    });

    return json({ success: true, message: "Post deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
