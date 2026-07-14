// Cloudflare Pages Function: /api/search
// GET — cross-entity search for the admin console's search sheet (members, funds,
// families, purchases, wishlist). Each category is gated by the same permission
// scope its own dedicated endpoint uses, so a caller never sees a result here they
// couldn't already see by opening that section directly.

import { requireAuth, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, null);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().substring(0, 100);
  if (q.length < 2) return json({ success: true, results: {} });

  const like = `%${q}%`;
  const can = (scope) => auth.permissions.includes("*") || auth.permissions.includes(scope);
  const results = {};

  try {
    const tasks = [];

    if (can("view_members")) {
      tasks.push(
        db.prepare(
          `SELECT id, name, email, phone FROM members
           WHERE name LIKE ?1 OR email LIKE ?1 OR phone LIKE ?1
           ORDER BY name LIMIT 6`
        ).bind(like).all().then((r) => { results.members = r.results || []; })
      );
      tasks.push(
        db.prepare(
          `SELECT id, family_name AS name, primary_phone AS phone, primary_email AS email FROM families
           WHERE status != 'deleted' AND (family_name LIKE ?1 OR primary_phone LIKE ?1 OR primary_email LIKE ?1)
           ORDER BY family_name LIMIT 6`
        ).bind(like).all().then((r) => { results.families = r.results || []; })
      );
    }

    if (can("manage_funds")) {
      tasks.push(
        db.prepare(
          `SELECT id, slug, name, description FROM funds
           WHERE status != 'deleted' AND (name LIKE ?1 OR slug LIKE ?1 OR description LIKE ?1)
           ORDER BY name LIMIT 6`
        ).bind(like).all().then((r) => { results.funds = r.results || []; })
      );
    }

    if (can("edit_purchases")) {
      tasks.push(
        db.prepare(
          `SELECT id, name, amount, fund FROM purchases
           WHERE name LIKE ?1 OR vendor LIKE ?1 OR description LIKE ?1
           ORDER BY date DESC LIMIT 6`
        ).bind(like).all().then((r) => { results.purchases = r.results || []; })
      );
    }

    if (can("edit_wishlist")) {
      tasks.push(
        db.prepare(
          `SELECT id, item_name AS name, cost, priority FROM wishlist
           WHERE item_name LIKE ?1 OR notes LIKE ?1
           ORDER BY item_name LIMIT 6`
        ).bind(like).all().then((r) => { results.wishlist = r.results || []; })
      );
    }

    await Promise.all(tasks);
    return json({ success: true, results }, 200, { "Cache-Control": "no-store" });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
