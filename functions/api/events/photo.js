// Cloudflare Pages Function: /api/events/photo
// Serves event photos stored in the EVENT_PHOTOS R2 bucket by key.
// Usage: GET /api/events/photo?key=events/12/<uuid>.jpg

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key query parameter" }), { status: 404 });
  }

  if (!env.EVENT_PHOTOS) {
    return new Response(JSON.stringify({ error: "Photo storage not configured" }), { status: 404 });
  }

  try {
    const obj = await env.EVENT_PHOTOS.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "Photo not found" }), { status: 404 });
    }

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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
