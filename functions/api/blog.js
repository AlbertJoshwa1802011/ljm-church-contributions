// Cloudflare Pages Function: /api/blog
// Admin-authored articles/updates — PRD §7.9 (Blog) and §7.10 (Youth Ministry, via
// ministry_area='youth'), schema doc §2.6.
//
//   GET    /api/blog                    → public: published posts, newest first
//          /api/blog?slug=SLUG          → public: single published post by slug
//          /api/blog?ministryArea=youth → public: filter by ministry area
//          /api/blog?all=1              → admin (manage_content): every status
//   POST   /api/blog                    → admin: create
//   PUT    /api/blog                    → admin: update (body.id)
//   DELETE /api/blog?id=NN              → admin: delete

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

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const ministryArea = url.searchParams.get("ministryArea");

  try {
    if (url.searchParams.get("all") === "1") {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;

      const q = await db.prepare("SELECT * FROM blog_posts ORDER BY created_at DESC").all();
      return json({ success: true, posts: (q.results || []).map(toCamel) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    if (slug) {
      const row = await db.prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'").bind(slug).first();
      if (!row) return json({ success: false, message: "Post not found" }, 404);
      return json({ success: true, post: toCamel(row) }, 200, corsHeaders({ "Cache-Control": "public, max-age=60" }));
    }

    let sql = "SELECT * FROM blog_posts WHERE status = 'published'";
    const params = [];
    if (ministryArea) {
      sql += " AND ministry_area = ?";
      params.push(ministryArea);
    }
    sql += " ORDER BY published_at DESC, created_at DESC";

    const q = await db.prepare(sql).bind(...params).all();
    return json({ success: true, posts: (q.results || []).map(toCamel) }, 200,
      corsHeaders({ "Cache-Control": "public, max-age=30" }));
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
    const bodyEn = String(body.bodyEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn is required" }, 400);

    const slug = slugify(body.slug || titleEn);
    if (!slug) return json({ success: false, message: "A valid slug is required" }, 400);

    const existing = await db.prepare("SELECT id FROM blog_posts WHERE slug = ?").bind(slug).first();
    if (existing) return json({ success: false, message: `A post with slug '${slug}' already exists` }, 409);

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
      action: "blog.add", entityType: "blog_post", entityId: id,
      details: { slug, status }
    });

    return json({ success: true, id, slug, message: `Post '${titleEn}' added` }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Post id is required" }, 400);

    const existing = await db.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first();
    if (!existing) return json({ success: false, message: "Post not found" }, 404);

    const titleEn = body.titleEn !== undefined ? String(body.titleEn).trim() : existing.title_en;
    const bodyEn = body.bodyEn !== undefined ? String(body.bodyEn).trim() : existing.body_en;
    if (!titleEn) return json({ success: false, message: "titleEn cannot be empty" }, 400);
    if (!bodyEn) return json({ success: false, message: "bodyEn cannot be empty" }, 400);

    let slug = existing.slug;
    if (body.slug !== undefined) {
      const newSlug = slugify(body.slug);
      if (!newSlug) return json({ success: false, message: "A valid slug is required" }, 400);
      if (newSlug !== existing.slug) {
        const clash = await db.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?").bind(newSlug, id).first();
        if (clash) return json({ success: false, message: `A post with slug '${newSlug}' already exists` }, 409);
      }
      slug = newSlug;
    }

    const status = body.status === "published" || body.status === "draft" ? body.status : existing.status;
    const publishedAt = status === "published" && existing.status !== "published"
      ? new Date().toISOString()
      : existing.published_at;

    const merged = {
      title_ta: body.titleTa !== undefined ? body.titleTa : existing.title_ta,
      body_ta: body.bodyTa !== undefined ? body.bodyTa : existing.body_ta,
      excerpt_en: body.excerptEn !== undefined ? body.excerptEn : existing.excerpt_en,
      excerpt_ta: body.excerptTa !== undefined ? body.excerptTa : existing.excerpt_ta,
      category: body.category !== undefined ? body.category : existing.category,
      cover_url: body.coverUrl !== undefined ? body.coverUrl : existing.cover_url,
      ministry_area: body.ministryArea !== undefined ? body.ministryArea : existing.ministry_area
    };

    await db.prepare(
      `UPDATE blog_posts SET slug=?, title_en=?, title_ta=?, body_en=?, body_ta=?, excerpt_en=?, excerpt_ta=?, category=?, cover_url=?, ministry_area=?, status=?, published_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      slug, titleEn, merged.title_ta, bodyEn, merged.body_ta, merged.excerpt_en, merged.excerpt_ta,
      merged.category, merged.cover_url, merged.ministry_area, status, publishedAt, id
    ).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "blog.update", entityType: "blog_post", entityId: id,
      details: { status }
    });

    return json({ success: true, message: "Post updated" }, 200, corsHeaders());
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
    if (!id) return json({ success: false, message: "Post id is required" }, 400);

    const res = await db.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id).run();
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
