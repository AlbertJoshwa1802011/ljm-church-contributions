// Shared helpers for Pages Functions: auth (Google ID token + legacy email fallback),
// role/permission lookup, and audit logging.
// Underscore-prefixed file — Cloudflare Pages does not route it as an endpoint.

export const HARDCODED_SUPER_ADMINS = [
  "albertjoshrock101@gmail.com",
  "thinkmuthu@gmail.com",
  "augustinraja261@gmail.com"
];

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

// Verify a Google Identity Services ID token. Returns { email, name, picture } or null.
export async function verifyGoogleToken(token, env) {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return null;
    const payload = await res.json();

    const clientID = env.GOOGLE_CLIENT_ID;
    if (clientID && payload.aud !== clientID) return null;
    if (!payload.email) return null;

    return {
      email: String(payload.email).toLowerCase().trim(),
      name: payload.name || "",
      picture: payload.picture || ""
    };
  } catch (_) {
    return null;
  }
}

// Resolve the CURRENT caller's identity for member (non-admin) self-service
// endpoints — i.e. "who is signed in?", not "is this an admin?". Unlike
// requireAuth, it never checks roles/permissions, so any signed-in member passes.
//
// Token sources (in order): "Authorization: Bearer <token>" header, then ?token=.
//  - Google ID token (three dot-segments) → verified identity ({ verified: true }).
//  - Plain email string → legacy fallback, only when ALLOW_LEGACY_EMAIL_TOKEN="true",
//    and always { verified: false } (an email string is not proof of identity).
// Returns { email, verified }; email is null when there is no usable credential.
export async function resolveViewer(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let raw = request.headers.get("Authorization") || "";
  if (raw.toLowerCase().startsWith("bearer ")) raw = raw.slice(7);
  raw = (raw || url.searchParams.get("token") || "").trim();
  if (!raw) return { email: null, verified: false };
  if (raw.split(".").length === 3) {
    const identity = await verifyGoogleToken(raw, env);
    return identity ? { email: identity.email, verified: true } : { email: null, verified: false };
  }
  if (raw.includes("@") && env.ALLOW_LEGACY_EMAIL_TOKEN === "true") {
    return { email: raw.toLowerCase(), verified: false };
  }
  return { email: null, verified: false };
}

// Resolve the permission scopes for an email.
// Hardcoded super admins get the wildcard '*' (bootstrap safety, matches roles.js behavior).
export async function getPermissions(email, db) {
  if (!email) return [];
  const normalized = email.toLowerCase().trim();
  if (HARDCODED_SUPER_ADMINS.includes(normalized)) return ["*"];

  try {
    const userRole = await db
      .prepare("SELECT role_name FROM member_roles WHERE LOWER(email) = ?")
      .bind(normalized)
      .first();
    if (!userRole) return [];

    const rolePerms = await db
      .prepare("SELECT permissions FROM roles WHERE role_name = ?")
      .bind(userRole.role_name)
      .first();
    if (!rolePerms) return [];

    return JSON.parse(rolePerms.permissions || "[]");
  } catch (_) {
    return [];
  }
}

// Extract the caller identity and check a required permission.
//
// Token sources (in order): "Authorization: Bearer <token>" header, then ?token= query param.
// - Google ID token (JWT, contains two dots): verified identity (verified: true).
// - env.ADMIN_API_TOKEN exact match: machine token, wildcard permissions.
// - Plain email string: LEGACY transition fallback (verified: false) — still must
//   resolve to real permissions via member_roles. Audit rows record verified=0.
//
// Returns { ok, email, actorType, verified, permissions } — when !ok, `response`
// carries the ready-made error Response.
export async function requireAuth(context, permission) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  let raw = request.headers.get("Authorization") || "";
  if (raw.toLowerCase().startsWith("bearer ")) raw = raw.slice(7);
  raw = (raw || url.searchParams.get("token") || "").trim();

  const denied = (message) => ({
    ok: false,
    email: null,
    actorType: "anonymous",
    verified: false,
    permissions: [],
    response: json({ success: false, message }, 401)
  });

  if (!raw) return denied("Missing credentials");

  // Machine API token
  if (env.ADMIN_API_TOKEN && raw === env.ADMIN_API_TOKEN) {
    return { ok: true, email: "api-token", actorType: "admin", verified: true, permissions: ["*"] };
  }

  let email = null;
  let verified = false;

  if (raw.split(".").length === 3) {
    // Looks like a JWT — verify with Google
    const identity = await verifyGoogleToken(raw, env);
    if (!identity) return denied("Google token verification failed");
    email = identity.email;
    verified = true;
  } else if (raw.includes("@")) {
    // Legacy plain-email token: an email string is not proof of identity, so this
    // path is disabled unless ALLOW_LEGACY_EMAIL_TOKEN="true" is set in the environment.
    if (env.ALLOW_LEGACY_EMAIL_TOKEN !== "true") {
      return denied("Legacy email tokens are disabled. Sign in with Google.");
    }
    email = raw.toLowerCase();
  } else {
    return denied("Unrecognized credential format");
  }

  const permissions = await getPermissions(email, db);
  const allowed = permissions.includes("*") || (permission && permissions.includes(permission));
  if (!permission && permissions.length > 0) {
    // No specific permission required — any recognized admin/role holder passes
    return { ok: true, email, actorType: "admin", verified, permissions };
  }
  if (!allowed) {
    return {
      ...denied(`Unauthorized: '${permission}' permission required`),
      email,
      verified
    };
  }

  return { ok: true, email, actorType: "admin", verified, permissions };
}

// Write an audit row. Never throws — audit failure must not break the real operation.
export async function audit(context, entry) {
  try {
    const { request, env } = context;
    await env.DB.prepare(
      `INSERT INTO activity_logs (actor_email, actor_type, action, entity_type, entity_id, details, ip, user_agent, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.actorEmail || null,
        entry.actorType || "anonymous",
        entry.action,
        entry.entityType || null,
        entry.entityId != null ? String(entry.entityId) : null,
        entry.details ? JSON.stringify(entry.details) : null,
        request.headers.get("CF-Connecting-IP") || "",
        (request.headers.get("User-Agent") || "").substring(0, 300),
        entry.verified ? 1 : 0
      )
      .run();
  } catch (err) {
    console.error("audit log write failed:", err && err.message);
  }
}
