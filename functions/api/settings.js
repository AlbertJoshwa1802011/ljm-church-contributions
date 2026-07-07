// Cloudflare Pages Function: /api/settings
// GET — public read of safe config flags (force_login) so pages can honor them.
// PUT — admin write (manage_funds) restricted to a whitelist of keys, audited.

import { requireAuth, audit, json } from "./_lib.js";

const PUBLIC_KEYS = ["force_login"];
const WRITABLE_KEYS = ["force_login", "tech_goal_amount", "christmas_goal_amount"];

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    const query = await db.prepare(
      `SELECT key, value FROM config WHERE key IN (${PUBLIC_KEYS.map(() => "?").join(",")})`
    ).bind(...PUBLIC_KEYS).all();

    const settings = {};
    (query.results || []).forEach(r => { settings[r.key] = r.value; });

    return json({ success: true, settings }, 200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=30"
    });
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const key = String(body.key || "");
    const value = String(body.value ?? "");

    if (!WRITABLE_KEYS.includes(key)) {
      return json({ success: false, message: `Key '${key}' is not writable via API` }, 400);
    }
    if (key === "force_login" && !["true", "false"].includes(value)) {
      return json({ success: false, message: "force_login must be 'true' or 'false'" }, 400);
    }

    await db.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(key, value).run();

    // Keep funds table in sync when goals are edited through settings
    if (key === "tech_goal_amount") {
      await db.prepare("UPDATE funds SET goal_amount = ? WHERE slug = 'tech-contributions'").bind(Number(value) || 0).run();
    } else if (key === "christmas_goal_amount") {
      await db.prepare("UPDATE funds SET goal_amount = ? WHERE slug = 'christmas-fund'").bind(Number(value) || 0).run();
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "config.update", entityType: "config", entityId: key, details: { value }
    });

    return json({ success: true, message: `Setting '${key}' updated` });
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
