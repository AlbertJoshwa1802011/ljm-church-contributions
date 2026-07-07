// Cloudflare Pages Function: /api/roles
// Manages dynamic role configurations and permissions directly in D1 SQL

// Helper: Check if an email has a specific permission scope
async function checkPermission(email, requiredPermission, db) {
  if (!email) return false;
  
  // Bootstrap safety fallback for original admins
  const hardcodedAdmins = ["albertjoshrock101@gmail.com", "thinkmuthu@gmail.com", "augustinraja261@gmail.com"];
  if (hardcodedAdmins.includes(email.toLowerCase().trim())) {
    return true;
  }

  try {
    const userRole = await db.prepare("SELECT role_name FROM member_roles WHERE LOWER(email) = LOWER(?)")
      .bind(email.trim())
      .first();
    
    if (!userRole) return false;

    const rolePerms = await db.prepare("SELECT permissions FROM roles WHERE role_name = ?")
      .bind(userRole.role_name)
      .first();

    if (!rolePerms) return false;

    const permissions = JSON.parse(rolePerms.permissions || "[]");
    return permissions.includes(requiredPermission);
  } catch (_) {
    return false;
  }
}

// 1. GET: Fetch roles list and email mappings (Admin-only)
export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const url = new URL(request.url);
  const adminEmail = url.searchParams.get("token"); // Admin session token (email)

  const authorized = await checkPermission(adminEmail, "manage_roles", db);
  if (!authorized) {
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

  const url = new URL(request.url);
  const adminEmail = url.searchParams.get("token");

  const authorized = await checkPermission(adminEmail, "manage_roles", db);
  if (!authorized) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 200 });
  }

  try {
    const body = await request.json();
    const { action, roleName, permissions, email } = body;

    if (action === "save_role") {
      if (!roleName || !permissions) {
        return new Response(JSON.stringify({ success: false, message: "Missing roleName or permissions" }));
      }
      
      const permissionsJson = JSON.stringify(permissions);
      await db.prepare("INSERT OR REPLACE INTO roles (role_name, permissions) VALUES (?, ?)")
        .bind(roleName, permissionsJson)
        .run();

      return new Response(JSON.stringify({ success: true, message: `Role '${roleName}' saved successfully` }));

    } else if (action === "link_email") {
      if (!email || !roleName) {
        return new Response(JSON.stringify({ success: false, message: "Missing email or roleName" }));
      }

      await db.prepare("INSERT OR REPLACE INTO member_roles (email, role_name) VALUES (?, ?)")
        .bind(email.trim().toLowerCase(), roleName)
        .run();

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
  const adminEmail = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  const authorized = await checkPermission(adminEmail, "manage_roles", db);
  if (!authorized) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 200 });
  }

  try {
    if (action === "delete_role") {
      const roleName = url.searchParams.get("roleName");
      if (roleName === "super_admin") {
        return new Response(JSON.stringify({ success: false, message: "Cannot delete built-in super_admin role" }));
      }
      await db.prepare("DELETE FROM roles WHERE role_name = ?").bind(roleName).run();
      return new Response(JSON.stringify({ success: true, message: `Role '${roleName}' deleted` }));

    } else if (action === "unlink_email") {
      const email = url.searchParams.get("email");
      const hardcodedAdmins = ["albertjoshrock101@gmail.com", "thinkmuthu@gmail.com", "augustinraja261@gmail.com"];
      if (hardcodedAdmins.includes(email.toLowerCase().trim())) {
        return new Response(JSON.stringify({ success: false, message: "Cannot unlink built-in super admin email" }));
      }
      await db.prepare("DELETE FROM member_roles WHERE email = ?").bind(email.toLowerCase().trim()).run();
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
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
