// Cloudflare Pages Function: /api/appearance
// Per-member accent-color theme preference (light + dark), synced across devices.
//   GET — returns the caller's saved palette ids (or nulls if none / not signed in).
//   PUT — upserts the caller's palette ids. Requires a VERIFIED Google identity so a
//         legacy email token can't overwrite another member's prefs while
//         ALLOW_LEGACY_EMAIL_TOKEN is enabled.
//
// Identity is resolved with resolveViewer (any signed-in member), NOT requireAuth
// (which is admin/permission-gated) — this is member self-service, not admin.

import { resolveViewer, json } from "./_lib.js";

// Keep in sync with the PALETTES catalog in theme.js. Stored as ids (not hex) so
// the palette's actual colors can change client-side without a data migration.
const PALETTE_IDS = ["wedgwood", "sage", "heather", "aubergine", "claret", "terracotta", "ochre", "teal", "slate"];

function isValidId(v) {
  return v == null || v === "" || PALETTE_IDS.includes(v);
}

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const viewer = await resolveViewer(context);
  // Signed-out is not an error — the client just falls back to its device-local
  // (localStorage) choice. Return empty defaults so the caller can proceed.
  if (!viewer.email) {
    return json({ success: true, signedIn: false, accent_light: null, accent_dark: null }, 200, {
      "Access-Control-Allow-Origin": "*"
    });
  }

  try {
    const row = await db
      .prepare("SELECT accent_light, accent_dark FROM member_preferences WHERE email = ?")
      .bind(viewer.email)
      .first();
    return json({
      success: true,
      signedIn: true,
      accent_light: row ? row.accent_light : null,
      accent_dark: row ? row.accent_dark : null
    }, 200, { "Access-Control-Allow-Origin": "*" });
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const viewer = await resolveViewer(context);
  if (!viewer.email) return json({ success: false, message: "Sign in required" }, 401);
  // Writes require cryptographic proof of identity (a real Google token), not a
  // bare email string — otherwise one member could overwrite another's prefs.
  if (!viewer.verified) return json({ success: false, message: "A verified Google sign-in is required to save appearance" }, 403);

  try {
    const body = await request.json();
    const light = body.accent_light;
    const dark = body.accent_dark;

    if (!isValidId(light)) return json({ success: false, message: `Unknown accent id '${light}'` }, 400);
    if (!isValidId(dark)) return json({ success: false, message: `Unknown accent id '${dark}'` }, 400);
    if (light === undefined && dark === undefined) {
      return json({ success: false, message: "No appearance fields provided" }, 400);
    }

    // Merge provided fields over any existing row so a partial update (only light
    // OR only dark) never wipes the other mode's saved choice.
    const existing = await db
      .prepare("SELECT accent_light, accent_dark FROM member_preferences WHERE email = ?")
      .bind(viewer.email)
      .first();

    const nextLight = light !== undefined ? (light || null) : (existing ? existing.accent_light : null);
    const nextDark = dark !== undefined ? (dark || null) : (existing ? existing.accent_dark : null);

    await db
      .prepare(
        `INSERT INTO member_preferences (email, accent_light, accent_dark, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           accent_light = excluded.accent_light,
           accent_dark = excluded.accent_dark,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(viewer.email, nextLight, nextDark)
      .run();

    return json({ success: true, accent_light: nextLight, accent_dark: nextDark }, 200, {
      "Access-Control-Allow-Origin": "*"
    });
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
