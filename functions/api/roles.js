// Cloudflare Pages Function: /api/roles
// Manages dynamic role configurations and permissions directly in D1 SQL

import { requireAuth, audit, HARDCODED_SUPER_ADMINS } from "./_lib.js";

// Every permission scope the API understands. save_role rejects anything else
// (including "*") so a manage_roles holder cannot invent or widen scopes.
const VALID_PERMISSIONS = [
  "edit_purchases", "edit_wishlist", "manage_roles",
  "view_members", "manage_funds", "delete_funds", "view_audit"
];

// 1. GET: Fetch roles list and email mappings (Admin-only)
export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const auth = await requireAuth(context, "manage_roles");
  if (!auth.ok) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized: manage_roles permission required" }), { status: 200 });
  }

  try {
    const rolesList = await db.prepare("SELECT role_name, permissions FROM roles").all();
    const mappingsList = await db.prepare("SELECT email, role_name FROM member_roles").all();

    return new Response(JSON.stringify({
      success: true,
      roles: rolesList.results || [],
      mappings: mappingsList.results || []
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 200 });
  }
}

// 2. POST: Create/edit role OR link an email to a role (Admin-only)
export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const auth = await requireAuth(context, "manage_roles");
  if (!auth.ok) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 200 });
  }

  try {
    const body = await request.json();
    const { action, roleName, permissions, email } = body;

    if (action === "save_role") {
      if (!roleName || !permissions) {
        return new Response(JSON.stringify({ success: false, message: "Missing roleName or permissions" }));
      }
      if (roleName === "super_admin") {
        return new Response(JSON.stringify({ success: false, message: "Built-in super_admin role cannot be modified via API" }));
      }
      const invalid = !Array.isArray(permissions)
        ? null
        : permissions.filter(p => !VALID_PERMISSIONS.includes(p));
      if (!Array.isArray(permissions) || invalid.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          message: `Invalid permissions${invalid ? `: ${invalid.join(", ")}` : ""}. Allowed: ${VALID_PERMISSIONS.join(", ")}`
        }));
      }

      const permissionsJson = JSON.stringify(permissions);
      await db.prepare("INSERT OR REPLACE INTO roles (role_name, permissions) VALUES (?, ?)")
        .bind(roleName, permissionsJson)
        .run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "role.save", entityType: "role", entityId: roleName, details: { permissions }
      });

      return new Response(JSON.stringify({ success: true, message: `Role '${roleName}' saved successfully` }));

    } else if (action === "link_email") {
      if (!email || !roleName) {
        return new Response(JSON.stringify({ success: false, message: "Missing email or roleName" }));
      }

      await db.prepare("INSERT OR REPLACE INTO member_roles (email, role_name) VALUES (?, ?)")
        .bind(email.trim().toLowerCase(), roleName)
        .run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "role.link", entityType: "role", entityId: roleName, details: { linkedEmail: email.trim().toLowerCase() }
      });

      return new Response(JSON.stringify({ success: true, message: `Linked ${email} to role ${roleName}` }));
    }

    return new Response(JSON.stringify({ success: false, message: "Unknown action" }));
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }));
  }
}

// 3. DELETE: Delete a role OR remove an email mapping (Admin-only)
export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const auth = await requireAuth(context, "manage_roles");
  if (!auth.ok) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 200 });
  }

  try {
    if (action === "delete_role") {
      const roleName = url.searchParams.get("roleName");
      if (roleName === "super_admin") {
        return new Response(JSON.stringify({ success: false, message: "Cannot delete built-in super_admin role" }));
      }
      await db.prepare("DELETE FROM roles WHERE role_name = ?").bind(roleName).run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "role.delete", entityType: "role", entityId: roleName
      });

      return new Response(JSON.stringify({ success: true, message: `Role '${roleName}' deleted` }));

    } else if (action === "unlink_email") {
      const email = url.searchParams.get("email");
      if (HARDCODED_SUPER_ADMINS.includes(email.toLowerCase().trim())) {
        return new Response(JSON.stringify({ success: false, message: "Cannot unlink built-in super admin email" }));
      }
      await db.prepare("DELETE FROM member_roles WHERE email = ?").bind(email.toLowerCase().trim()).run();

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: "role.unlink", entityType: "role", entityId: email.toLowerCase().trim()
      });

      return new Response(JSON.stringify({ success: true, message: `Unlinked email ${email}` }));
    }

    return new Response(JSON.stringify({ success: false, message: "Unknown action" }));
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }));
  }
}
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
