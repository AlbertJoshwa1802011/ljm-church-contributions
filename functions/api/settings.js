// Cloudflare Pages Function: /api/settings
// GET — public read of safe config flags (force_login) so pages can honor them.
// PUT — admin write (manage_funds) restricted to a whitelist of keys, audited.

import { requireAuth, audit, json } from "./_lib.js";

// Pastor-curated "verse card" content (Verse of the Month / Year), shown on the
// public dashboard. Stored as plain config rows so no schema change is needed.
const VERSE_KEYS = [
  "verse_month_label", "verse_month_text", "verse_month_ref",
  "verse_year_label", "verse_year_text", "verse_year_ref"
];

const PUBLIC_KEYS = ["force_login", ...VERSE_KEYS];
const WRITABLE_KEYS = ["force_login", "tech_goal_amount", "christmas_goal_amount", ...VERSE_KEYS];

const MAX_VALUE_LEN = 1000;

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

    // Accept either a single { key, value } or a batch { updates: { k: v, ... } }
    // so multi-field forms (like the verse editor) save in one request.
    const updates = body.updates && typeof body.updates === "object"
      ? body.updates
      : { [String(body.key || "")]: body.value ?? "" };

    const entries = Object.entries(updates);
    if (entries.length === 0) return json({ success: false, message: "No updates provided" }, 400);

    for (const [key, raw] of entries) {
      const value = String(raw ?? "");
      if (!WRITABLE_KEYS.includes(key)) {
        return json({ success: false, message: `Key '${key}' is not writable via API` }, 400);
      }
      if (key === "force_login" && !["true", "false"].includes(value)) {
        return json({ success: false, message: "force_login must be 'true' or 'false'" }, 400);
      }
      if (value.length > MAX_VALUE_LEN) {
        return json({ success: false, message: `Value for '${key}' exceeds ${MAX_VALUE_LEN} characters` }, 400);
      }
    }

    for (const [key, raw] of entries) {
      const value = String(raw ?? "");
      await db.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(key, value).run();

      // Keep funds table in sync when goals are edited through settings
      if (key === "tech_goal_amount") {
        await db.prepare("UPDATE funds SET goal_amount = ? WHERE slug = 'tech-contributions'").bind(Number(value) || 0).run();
      } else if (key === "christmas_goal_amount") {
        await db.prepare("UPDATE funds SET goal_amount = ? WHERE slug = 'christmas-fund'").bind(Number(value) || 0).run();
      }
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "config.update", entityType: "config", entityId: entries.map(e => e[0]).join(","),
      details: { keys: entries.map(e => e[0]) }
    });

    return json({ success: true, message: `Updated ${entries.length} setting${entries.length !== 1 ? "s" : ""}` });
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
