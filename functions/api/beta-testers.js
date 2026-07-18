// Cloudflare Pages Function: /api/beta-testers
// Admin CRUD for the flag-gated "v2" flow's allowlist (see beta-activate.js,
// docs/milestone-v2/11-v2-flow-implementation.md). Gated on the existing
// manage_roles permission — this is access control, same family as roles.js
// — so no new permission scope had to be added anywhere.
//
//   GET  /api/beta-testers                          → list (manage_roles)
//   POST { action:'add', email, note? }              → add    (manage_roles)
//   POST { action:'remove', email }                  → remove (manage_roles)

import { requireAuth, audit, json } from "./_lib.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_roles");
  if (!auth.ok) return json({ success: false, message: "Unauthorized: manage_roles permission required" }, 200);

  try {
    const rows = await db.prepare(
      "SELECT email, added_by, note, added_at FROM beta_testers ORDER BY added_at DESC"
    ).all();
    return json({ success: true, testers: rows.results || [] });
  } catch (err) {
    return json({ success: false, message: err.message }, 200);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_roles");
  if (!auth.ok) return json({ success: false, message: "Unauthorized" }, 200);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid request body" }, 200);
  }

  const { action, email, note } = body || {};

  try {
    if (action === "add") {
      const normalized = String(email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        return json({ success: false, message: "A valid email is required" }, 200);
      }

      await db.prepare("INSERT OR REPLACE INTO beta_testers (email, added_by, note) VALUES (?, ?, ?)")
        .bind(normalized, auth.email, note ? String(note).substring(0, 300) : null)
        .run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "beta_tester.add", entityType: "beta_tester", entityId: normalized
      });

      return json({ success: true, message: `${normalized} can now activate the new flow` });
    }

    if (action === "remove") {
      const normalized = String(email || "").trim().toLowerCase();
      if (!normalized) return json({ success: false, message: "Missing email" }, 200);

      await db.prepare("DELETE FROM beta_testers WHERE email = ?").bind(normalized).run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "beta_tester.remove", entityType: "beta_tester", entityId: normalized
      });

      return json({ success: true, message: `${normalized} removed from beta access` });
    }

    return json({ success: false, message: "Unknown action" }, 200);
  } catch (err) {
    return json({ success: false, message: err.message }, 200);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
