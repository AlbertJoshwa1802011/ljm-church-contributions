// Cloudflare Pages Function: /api/media
// Serves admin-uploaded media (hero slides, video thumbnails, church photos)
// out of the EVENT_PHOTOS R2 bucket by key.
//
//   GET /api/media?key=hero/<uuid>.jpg
//
// Keys are checked against the strict allowlist in _media.js, so this endpoint
// can only ever read the hero/, videos/ and churches/ prefixes — it cannot be
// walked into event photo keys or anything else in the bucket.

import { isValidMediaKey } from "./_media.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(extra || {})
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const key = new URL(request.url).searchParams.get("key");

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key query parameter" }), {
      status: 404, headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }

  if (!isValidMediaKey(key)) {
    return new Response(JSON.stringify({ error: "Invalid media key" }), {
      status: 400, headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }

  if (!env.EVENT_PHOTOS) {
    return new Response(JSON.stringify({ error: "Media storage not configured" }), {
      status: 404, headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }

  try {
    const obj = await env.EVENT_PHOTOS.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Media not found" }), {
        status: 404, headers: corsHeaders({ "Content-Type": "application/json" })
      });
    }

    return new Response(obj.body, {
      headers: corsHeaders({
        "Content-Type": (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg",
        // Keys are content-addressed by UUID, so a stored object never changes.
        "Cache-Control": "public, max-age=31536000, immutable"
      })
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders({ "Content-Type": "application/json" })
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
