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

const PASTOR_KEYS = ["pastor_name", "pastor_address", "pastor_phone", "pastor_email"];
// The whole About page, editable by the pastor from the admin console — a
// single JSON blob (see ABOUT_PAGE.md) so new fields don't need a migration.
const CONTENT_KEYS = ["about_content"];
// Livestream/podcast URLs (PRD §7.11, TRD §3) — plain config rows, admin-editable,
// no schema change needed. Team-notify address is intentionally NOT here: it's an
// operational secret, set via env.TEAM_NOTIFY_EMAIL, not a public-readable setting.
const MEDIA_KEYS = ["sunday_live_url", "daily_prayer_url", "podcast_playlist_url"];
const PUBLIC_KEYS = ["force_login", "sandha_amount", ...VERSE_KEYS, ...PASTOR_KEYS, ...CONTENT_KEYS, ...MEDIA_KEYS];
const WRITABLE_KEYS = ["force_login", "tech_goal_amount", "christmas_goal_amount", "sandha_amount", ...VERSE_KEYS, ...PASTOR_KEYS, ...CONTENT_KEYS, ...MEDIA_KEYS];
// Money-moving keys stay manage_funds-only. Everything else here (verses,
// pastor/About info, Watch & Listen media links, force_login) is ministry
// content, not a financial control, so a manage_content-only editor should
// be able to write it too — see onRequestPut's permission check below.
const FINANCIAL_KEYS = ["tech_goal_amount", "christmas_goal_amount", "sandha_amount"];

const MAX_VALUE_LEN = 1000;
// about_content is a whole page's worth of JSON (hero, mission cards, verses,
// connect links) — bounded generously above the plain-field default so a
// pastor can write freely without hitting a cryptic length error.
const MAX_VALUE_LEN_BY_KEY = { about_content: 20000 };

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

  // manage_funds can write everything (unchanged from before). A caller with
  // only manage_content can still write the non-financial keys -- Watch &
  // Listen links, verses, pastor/About info -- which used to be wrongly
  // gated behind the finance permission even though they're ministry
  // content, not a money control. Financial keys always require manage_funds.
  let auth = await requireAuth(context, "manage_funds");
  let contentOnly = false;
  if (!auth.ok) {
    const contentAuth = await requireAuth(context, "manage_content");
    if (!contentAuth.ok) return auth.response;
    auth = contentAuth;
    contentOnly = true;
  }

  try {
    const body = await request.json();

    // Accept either a single { key, value } or a batch { updates: { k: v, ... } }
    // so multi-field forms (like the verse editor) save in one request.
    const updates = body.updates && typeof body.updates === "object"
      ? body.updates
      : { [String(body.key || "")]: body.value ?? "" };

    const entries = Object.entries(updates);
    if (entries.length === 0) return json({ success: false, message: "No updates provided" }, 400);

    if (contentOnly) {
      const deniedKey = entries.map(([key]) => key).find((key) => FINANCIAL_KEYS.includes(key));
      if (deniedKey) {
        return json({ success: false, message: `'${deniedKey}' requires manage_funds permission` }, 403);
      }
    }

    for (const [key, raw] of entries) {
      const value = String(raw ?? "");
      if (!WRITABLE_KEYS.includes(key)) {
        return json({ success: false, message: `Key '${key}' is not writable via API` }, 400);
      }
      if (key === "force_login" && !["true", "false"].includes(value)) {
        return json({ success: false, message: "force_login must be 'true' or 'false'" }, 400);
      }
      if (key === "pastor_email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return json({ success: false, message: "pastor_email must be a valid email address" }, 400);
      }
      if (key === "about_content" && value) {
        try { JSON.parse(value); } catch (_) {
          return json({ success: false, message: "about_content must be valid JSON" }, 400);
        }
      }
      if (MEDIA_KEYS.includes(key) && value && !/^https?:\/\//i.test(value)) {
        return json({ success: false, message: `${key} must be a valid http(s) URL` }, 400);
      }
      const maxLen = MAX_VALUE_LEN_BY_KEY[key] || MAX_VALUE_LEN;
      if (value.length > maxLen) {
        return json({ success: false, message: `Value for '${key}' exceeds ${maxLen} characters` }, 400);
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
