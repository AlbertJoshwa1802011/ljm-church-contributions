// Shared helpers for the flag-gated "v2" beta flow.
// See docs/milestone-v2/11-v2-flow-implementation.md for the full design.
// Underscore-prefixed file — Cloudflare Pages does not route it as an endpoint.

export const BETA_COOKIE_NAME = "ljm_beta";
export const BETA_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h

// Built-in fallback so beta access works with zero Cloudflare dashboard
// configuration — used only when env.BETA_COOKIE_SECRET isn't set. This
// cookie never grants any real permission by itself (admin actions, roles,
// and personal data are all separately permission-checked at the API layer
// regardless of which UI shell requested them); it only decides which
// front-end a signed-in, allowlisted browser sees. Given that low blast
// radius, a repo-visible default is an acceptable tradeoff to remove setup
// friction. Set a real env.BETA_COOKIE_SECRET to override this.
export const DEFAULT_BETA_COOKIE_SECRET = "sRGnITmbI5I__r3Kux4CsWfZ5GTnQOFqDMMBUkpwStY";

function b64urlEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Mints a signed "<payload>.<signature>" token. Payload = { email, exp }.
export async function signBetaCookie(email, secret) {
  const payload = JSON.stringify({
    email,
    exp: Date.now() + BETA_COOKIE_MAX_AGE_SECONDS * 1000
  });
  const payloadB64 = b64urlEncode(new TextEncoder().encode(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return payloadB64 + "." + b64urlEncode(new Uint8Array(sig));
}

// Verifies a cookie value; returns the email if valid+unexpired, else null.
// Never throws — malformed/tampered/expired input all just fail closed.
export async function verifyBetaCookie(cookieValue, secret) {
  if (!cookieValue || !secret) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (!payload.email || !payload.exp || payload.exp < Date.now()) return null;
    return payload.email;
  } catch (_) {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || "").split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
