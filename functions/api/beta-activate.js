// Cloudflare Pages Function: /api/beta-activate
// Verifies a Google ID token, checks the email against the beta_testers
// allowlist, and — only if it matches — sets the signed ljm_beta cookie
// that functions/_middleware.js checks on every page request.
//
// See docs/milestone-v2/11-v2-flow-implementation.md for the full design.
// This is intentionally separate from /api/auth: it never creates or
// touches a member record, it only decides "does this browser get routed
// to the new flow." The existing sign-in path is completely untouched.

import { verifyGoogleToken, json } from "./_lib.js";
import { signBetaCookie, BETA_COOKIE_NAME, BETA_COOKIE_MAX_AGE_SECONDS, DEFAULT_BETA_COOKIE_SECRET } from "./_beta.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const secret = env.BETA_COOKIE_SECRET || DEFAULT_BETA_COOKIE_SECRET;

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid request body." }, 400);
  }

  const { token } = body || {};
  if (!token) return json({ success: false, message: "Missing identity token." }, 400);

  const identity = await verifyGoogleToken(token, env);
  if (!identity) return json({ success: false, message: "Google token verification failed." }, 401);

  const row = await db.prepare("SELECT email FROM beta_testers WHERE LOWER(email) = ?")
    .bind(identity.email)
    .first();

  if (!row) {
    return json({ success: false, message: "This account doesn't have beta access." }, 403);
  }

  const cookieValue = await signBetaCookie(identity.email, secret);
  const cookie = [
    `${BETA_COOKIE_NAME}=${cookieValue}`,
    "Path=/",
    `Max-Age=${BETA_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");

  return json({ success: true, email: identity.email }, 200, { "Set-Cookie": cookie });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
