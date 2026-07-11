// Cloudflare Pages Function: /api/purchases
// Handles D1 purchases table mutations (admin-only) and listings (public).
// Backwards compatible with Google Apps Script query string routing.

import { requireAuth, audit } from "./_lib.js";

// GET: Handles both public listings and action-routed admin mutations (GET requests with action parameters)
export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action) {
    // Validate authorization (Google ID token or legacy email token) + permission scope
    const auth = await requireAuth(context, "edit_purchases");
    if (!auth.ok) {
      // Keep the legacy 200-with-success:false shape this endpoint always used
      return new Response(JSON.stringify({ success: false, message: "Unauthorized Admin Token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    const logMutation = (act, id, details) => audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: act, entityType: "purchase", entityId: id, details
    });

    try {
      const P = (key) => url.searchParams.get(key) || "";

      if (action === "add_purchase") {
        const id = P("id") || "P" + String(Date.now()).substring(7);
        const cost = Number(P("cost") || 0);
        const fundContrib = P("fundContribution") !== "" ? Number(P("fundContribution")) : cost;
        const extContrib = P("externalContribution") !== "" ? Number(P("externalContribution")) : 0;

        await db.prepare(
          "INSERT INTO purchases (id, name, amount, date, fund, photo, vendor, description, status, fund_contribution, external_contribution, external_sources, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          id,
          P("productName"),
          cost,
          P("purchaseDate"),
          P("fundSource"),
          P("photoURL"),
          P("vendorLink"),
          P("description"),
          P("status") || "Active",
          fundContrib,
          extContrib,
          P("externalSources"),
          auth.email || ""
        )
        .run();

        await logMutation("purchase.add", id, { name: P("productName"), cost, fund: P("fundSource") });

        return new Response(JSON.stringify({ success: true, message: "Purchase added to D1 successfully", id }), {
          headers: { "Content-Type": "application/json" }
        });

      } else if (action === "update_purchase") {
        const id = P("id");
        if (!id) return new Response(JSON.stringify({ success: false, message: "Missing purchase id" }), { headers: { "Content-Type": "application/json" } });
        
        const cost = Number(P("cost") || 0);
        const fundContrib = P("fundContribution") !== "" ? Number(P("fundContribution")) : cost;
        const extContrib = P("externalContribution") !== "" ? Number(P("externalContribution")) : 0;

        await db.prepare(
          "UPDATE purchases SET name = ?, amount = ?, date = ?, fund = ?, photo = ?, vendor = ?, description = ?, status = ?, fund_contribution = ?, external_contribution = ?, external_sources = ? WHERE id = ?"
        )
        .bind(
          P("productName"), 
          cost, 
          P("purchaseDate"), 
          P("fundSource"), 
          P("photoURL"), 
          P("vendorLink"), 
          P("description"), 
          P("status") || "Active", 
          fundContrib, 
          extContrib, 
          P("externalSources"),
          id
        )
        .run();

        await logMutation("purchase.update", id, { name: P("productName"), cost, fund: P("fundSource") });

        return new Response(JSON.stringify({ success: true, message: "Purchase updated in D1 successfully" }), {
          headers: { "Content-Type": "application/json" }
        });

      } else if (action === "delete_purchase") {
        const id = P("id");
        if (!id) return new Response(JSON.stringify({ success: false, message: "Missing purchase id" }), { headers: { "Content-Type": "application/json" } });

        await db.prepare("DELETE FROM purchases WHERE id = ?").bind(id).run();

        await logMutation("purchase.delete", id, null);

        return new Response(JSON.stringify({ success: true, message: "Purchase deleted from D1 successfully" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: err.message || err.toString() }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Default Listing (Public)
  try {
    const query = await db.prepare("SELECT id, name, amount AS cost, date, fund, photo, vendor, description, status, fund_contribution AS fundContribution, external_contribution AS externalContribution, external_sources AS externalSources, created_by AS createdBy FROM purchases ORDER BY date DESC").all();
    const purchases = query.results || [];
    const totalSpent = purchases.reduce((sum, p) => sum + (p.fundContribution || 0), 0);
    const totalCost = purchases.reduce((sum, p) => sum + (p.cost || 0), 0);

    return new Response(JSON.stringify({ success: true, purchases, totalSpent, totalCost, count: purchases.length }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// Support preflight OPTIONS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
