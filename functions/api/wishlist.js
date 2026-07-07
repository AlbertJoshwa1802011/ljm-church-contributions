// Cloudflare Pages Function: /api/wishlist
// Handles listing (public) and CRUD operations (admin-only) for the Church Contribution Wishlist.

import { requireAuth, audit } from "./_lib.js";

// 1. GET: Fetch entire wishlist (Public)
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
  }

  try {
    const query = await db.prepare("SELECT id, item_name AS name, cost, priority, notes FROM wishlist ORDER BY priority DESC, created_at DESC").all();
    const wishlist = query.results || [];

    return new Response(JSON.stringify({ wishlist }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// 2. POST: Add item to wishlist (Admin-only)
export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const auth = await requireAuth(context, "edit_wishlist");
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized: edit_wishlist permission required" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, cost, priority, notes } = body;

    if (!name || !cost) {
      return new Response(JSON.stringify({ error: "Missing name or cost parameters" }), { status: 400 });
    }

    const result = await db.prepare(
      "INSERT INTO wishlist (item_name, cost, priority, notes) VALUES (?, ?, ?, ?)"
    )
    .bind(name, Number(cost), priority || "Medium", notes || "")
    .run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "wishlist.add", entityType: "wishlist", entityId: result.meta.last_row_id,
      details: { name, cost: Number(cost), priority: priority || "Medium" }
    });

    return new Response(JSON.stringify({ success: true, message: "Wishlist item added successfully", id: result.meta.last_row_id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// 3. PUT: Update wishlist item (Admin-only)
export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const auth = await requireAuth(context, "edit_wishlist");
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized: edit_wishlist permission required" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, cost, priority, notes } = body;

    if (!id || !name || !cost) {
      return new Response(JSON.stringify({ error: "Missing id, name, or cost parameters" }), { status: 400 });
    }

    await db.prepare(
      "UPDATE wishlist SET item_name = ?, cost = ?, priority = ?, notes = ? WHERE id = ?"
    )
    .bind(name, Number(cost), priority || "Medium", notes || "", Number(id))
    .run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "wishlist.update", entityType: "wishlist", entityId: id,
      details: { name, cost: Number(cost), priority: priority || "Medium" }
    });

    return new Response(JSON.stringify({ success: true, message: "Wishlist item updated successfully" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// 4. DELETE: Remove item from wishlist (Admin-only)
export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const auth = await requireAuth(context, "edit_wishlist");
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized: edit_wishlist permission required" }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id query parameter" }), { status: 400 });
    }

    await db.prepare("DELETE FROM wishlist WHERE id = ?")
      .bind(Number(id))
      .run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "wishlist.delete", entityType: "wishlist", entityId: id
    });

    return new Response(JSON.stringify({ success: true, message: "Wishlist item deleted successfully" }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// Support CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
