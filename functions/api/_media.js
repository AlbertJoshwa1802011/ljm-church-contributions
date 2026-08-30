// Shared image storage for admin-managed media (hero slides, video thumbnails,
// church photos).
//
// This deliberately mirrors — rather than refactors — the proven photo pipeline
// in functions/api/events.js:29-67, which is under test and working. The two
// copies use the same already-bound EVENT_PHOTOS R2 bucket, namespaced by key
// prefix, and are served back through /api/media?key=... (events keep their own
// /api/events/photo endpoint).
//
// Storage modes, matching event_photos.storage:
//   'r2'       — bytes in R2, row stores /api/media?key=<prefix>/<uuid>.<ext>
//   'base64'   — no R2 binding available, row stores the whole data: URL
//   'external' — caller passed an already-hosted https:// URL, stored verbatim

// Key prefixes this module is allowed to write, and /api/media is allowed to
// read. Anything else is rejected so the serve endpoint can't be walked into
// other parts of the bucket (event photos included).
export const MEDIA_PREFIXES = ["hero", "videos", "churches"];

// Matches exactly "<allowed-prefix>/<safe-filename>" — no slashes beyond the
// first, so "../" and nested paths can never appear in a key.
export const MEDIA_KEY_PATTERN = new RegExp(
  "^(" + MEDIA_PREFIXES.join("|") + ")\\/[A-Za-z0-9._-]+$"
);

export function isValidMediaKey(key) {
  return typeof key === "string" && MEDIA_KEY_PATTERN.test(key);
}

// Store one image and return { url, storage }, or null when nothing was given.
// `value` is a data: URL (uploaded file), an https:// URL (already hosted), or
// an existing /api/media?key=... URL (unchanged on re-save).
export async function storeMedia(env, prefix, value) {
  if (!value || typeof value !== "string") return null;
  if (!MEDIA_PREFIXES.includes(prefix)) throw new Error("Unsupported media prefix: " + prefix);

  if (!value.startsWith("data:")) {
    // Already-stored R2 URLs come back through the admin form unchanged on an
    // edit — keep their original storage mode so re-saving doesn't orphan them.
    if (value.startsWith("/api/media?key=")) return { url: value, storage: "r2" };
    return { url: value, storage: "external" };
  }

  if (env.EVENT_PHOTOS) {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(value);
    if (!match) return { url: value, storage: "base64" };

    const mime = match[1] || "image/jpeg";
    const binary = atob(match[2] || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext = (mime.split("/")[1] || "jpg").split("+")[0].replace(/[^a-z0-9]/gi, "") || "jpg";
    const key = `${prefix}/${crypto.randomUUID()}.${ext}`;

    await env.EVENT_PHOTOS.put(key, bytes, { httpMetadata: { contentType: mime } });

    return { url: "/api/media?key=" + encodeURIComponent(key), storage: "r2" };
  }

  return { url: value, storage: "base64" };
}

// Best-effort delete of the R2 object behind a stored media URL. Never throws —
// a failed cleanup must not fail the request that triggered it.
export async function deleteMedia(env, url, storage) {
  if (storage !== "r2" || !url || !env.EVENT_PHOTOS) return;
  try {
    const parsed = new URL(url, "http://internal");
    const key = parsed.searchParams.get("key");
    if (key && isValidMediaKey(key)) await env.EVENT_PHOTOS.delete(key);
  } catch (_) {
    // best-effort — ignore
  }
}
