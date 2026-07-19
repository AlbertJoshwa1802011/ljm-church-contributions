// Cloudflare Pages Function: /api/contributions
// Fetches the entire state of a fund (goal, list of contributions, purchases, and member database)
// Also supports manual add/edit/(soft)delete of contributions from the admin console.

import { requireAuth, audit, json } from "./_lib.js";

// TODO: replace with a real role-based permission ("edit_contributions",
// already registered in roles.js's VALID_PERMISSIONS) once ready to extend
// manual contribution entry beyond this one admin.
const MANUAL_ENTRY_ALLOWLIST = ["albertjoshrock101@gmail.com"];

function normalizeFund(fund) {
  fund = String(fund || "").toLowerCase().replace(/\s+/g, "");
  if (fund === "tech" || fund === "techfund") return "tech-contributions";
  if (fund === "christmas" || fund === "christmasfund") return "christmas-fund";
  return fund || "tech-contributions";
}

async function requireManualEntryAdmin(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth;
  const email = (auth.email || "").toLowerCase();
  if (email !== "api-token" && !MANUAL_ENTRY_ALLOWLIST.includes(email)) {
    return { ...auth, ok: false, response: json({ success: false, message: "Not authorized for manual contribution entry" }, 403) };
  }
  return auth;
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const db = env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ error: "Cloudflare D1 Database binding 'DB' not found." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Determine fund parameter
    const url = new URL(request.url);
    let fund = url.searchParams.get("fund") || "tech-contributions";
    
    // Normalize fund name
    fund = fund.toLowerCase().replace(/\s+/g, '');
    
    if (fund === "purchases") {
      const purchasesQuery = await db.prepare(
        "SELECT id, name, amount AS cost, date, fund, photo, vendor, description, status, fund_contribution AS fundContribution, external_contribution AS externalContribution, external_sources AS externalSources FROM purchases ORDER BY date DESC"
      ).all();
      
      const purchases = purchasesQuery.results || [];
      const totalSpent = purchases.reduce((sum, p) => sum + (p.fundContribution || 0), 0);
      const totalCost = purchases.reduce((sum, p) => sum + (p.cost || 0), 0);
      
      // Match the Apps Script fund capitalization for frontend compatibility
      purchases.forEach(p => {
        if (p.fund === "tech-contributions") p.fund = "Tech Fund";
        else if (p.fund === "christmas-fund") p.fund = "Christmas Fund";
      });

      return new Response(JSON.stringify({
        purchases,
        totalSpent,
        totalCost,
        count: purchases.length
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=15, s-maxage=300"
        }
      });
    }

    if (fund === "tech" || fund === "techfund" || fund === "tech-contributions") {
      fund = "tech-contributions";
    } else if (fund === "christmas" || fund === "christmasfund" || fund === "christmas-fund") {
      fund = "christmas-fund";
    } else {
      fund = "tech-contributions"; // Fallback default
    }

    // 2. Fetch Goal Amount — funds table is the source of truth; config keys are the legacy fallback
    let goalAmount = 0;
    try {
      const fundRow = await db.prepare("SELECT goal_amount FROM funds WHERE slug = ?").bind(fund).first();
      if (fundRow) goalAmount = Number(fundRow.goal_amount) || 0;
    } catch (_) { /* funds table may not exist yet (pre-0002 database) */ }
    if (!goalAmount) {
      const goalKey = fund === "tech-contributions" ? "tech_goal_amount" : "christmas_goal_amount";
      const goalResult = await db.prepare("SELECT value FROM config WHERE key = ?")
        .bind(goalKey)
        .first();
      goalAmount = goalResult ? Number(goalResult.value) || 0 : 0;
    }

    // 3. Fetch Contributions for this fund
    // includeDeleted is only honored for a recognized admin — public dashboard
    // callers never see soft-deleted rows even if they happen to pass the flag.
    let includeDeleted = false;
    if (url.searchParams.get("includeDeleted") === "1") {
      const viewerAuth = await requireAuth(context);
      includeDeleted = viewerAuth.ok;
    }
    const contributionsQuery = await db.prepare(
      `SELECT id, member_name AS Member, amount AS Amount, date AS Date, category AS Category, notes AS Notes, email AS Email, phone AS Phone, proof_id AS ProofID, created_by AS createdBy, updated_by AS updatedBy, is_deleted AS IsDeleted
       FROM contributions WHERE fund = ?${includeDeleted ? "" : " AND is_deleted = 0"} ORDER BY date DESC`
    )
    .bind(fund)
    .all();
    const contributions = contributionsQuery.results || [];

    // 4. Fetch Member Profiles (emails, phones, verified statuses)
    const membersQuery = await db.prepare(
      "SELECT name, email, phone, is_verified FROM members"
    ).all();
    const membersList = membersQuery.results || [];

    const memberEmails = {};
    const memberPhones = {};
    const memberStatus = {};
    
    membersList.forEach(m => {
      if (m.name) {
        if (m.email) memberEmails[m.name] = m.email;
        if (m.phone) memberPhones[m.name] = m.phone;
        memberStatus[m.name] = m.is_verified === 1;
      }
    });

    // 5. Fetch Purchases ("What We Bought" stats)
    // Spent = fund_contribution only (the portion actually taken from the fund),
    // not total sticker cost — external donor top-ups must not reduce the balance.
    const purchasesQuery = await db.prepare(
      "SELECT SUM(fund_contribution) as total, COUNT(id) as count FROM purchases WHERE fund = ? AND status = 'Active'"
    )
    .bind(fund)
    .first();
    const spentOnProducts = purchasesQuery?.total || 0;
    const productsBoughtCount = purchasesQuery?.count || 0;

    // 6. Calculate available balance — always excludes soft-deleted rows,
    // even when the admin-only includeDeleted flag included them above.
    const totalCollected = contributions.reduce((sum, c) => (c.IsDeleted ? sum : sum + (Number(c.Amount) || 0)), 0);
    const availableBalance = Math.max(totalCollected - spentOnProducts, 0);

    // Return combined payload
    const responsePayload = {
      goalAmount,
      contributions,
      memberEmails,
      memberPhones,
      memberStatus,
      spentOnProducts,
      productsBoughtCount,
      availableBalance
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15, s-maxage=300" // Cache client-side and CDN edge
      }
    });

  } catch (err) {
    let msg = err.message || err.toString();
    if (msg.includes("no such table")) {
      msg = `Database tables are missing. Please run D1 migrations: npx wrangler d1 execute ljm-contributions-db --remote --file=schema.sql (Original error: ${msg})`;
    }
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Manually add a contribution (e.g. a cash gift handed in person, previously
// only recorded in the Google Sheet). Defaults to "Direct Cash" category
// with no proof_id, distinguishing it from Razorpay-verified online payments.
export async function onRequestPost(context) {
  const auth = await requireManualEntryAdmin(context);
  if (!auth.ok) return auth.response;
  const db = context.env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    const body = await context.request.json();
    const member_name = String(body.member_name || "").trim().substring(0, 120);
    const amount = Number(body.amount);
    const date = String(body.date || "").trim();
    const fund = normalizeFund(body.fund);
    const category = String(body.category || "Direct Cash").trim().substring(0, 60);
    const notes = body.notes != null ? String(body.notes).trim().substring(0, 500) : null;
    const email = body.email != null ? String(body.email).trim().toLowerCase().substring(0, 200) : null;
    const phone = body.phone != null ? String(body.phone).trim().substring(0, 30) : null;

    if (!member_name) return json({ success: false, message: "member_name is required" }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ success: false, message: "amount must be a positive number" }, 400);
    if (!date) return json({ success: false, message: "date is required" }, 400);

    const res = await db.prepare(
      "INSERT INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund, created_by) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)"
    ).bind(member_name, amount, date, category, notes, email, phone, fund, auth.email).run();
    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contribution.add", entityType: "contribution", entityId: id,
      details: { member_name, amount, date, category, fund }
    });

    return json({ success: true, message: `Contribution for '${member_name}' added`, id });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// Edit a contribution. Allowed even on Razorpay-verified rows (fixing a typo'd
// member match), but the audit log flags wasVerifiedProof so it's traceable.
export async function onRequestPut(context) {
  const auth = await requireManualEntryAdmin(context);
  if (!auth.ok) return auth.response;
  const db = context.env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    const body = await context.request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Missing contribution id" }, 400);

    const row = await db.prepare(
      "SELECT id, member_name, amount, date, category, notes, email, phone, fund, proof_id FROM contributions WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!row) return json({ success: false, message: "Contribution not found" }, 404);

    const member_name = String(body.member_name ?? row.member_name).trim().substring(0, 120);
    const amount = body.amount != null ? Number(body.amount) : row.amount;
    const date = String(body.date ?? row.date).trim();
    const fund = body.fund != null ? normalizeFund(body.fund) : row.fund;
    const category = String(body.category ?? row.category).trim().substring(0, 60);
    const notes = body.notes != null ? String(body.notes).trim().substring(0, 500) : row.notes;
    const email = body.email != null ? String(body.email).trim().toLowerCase().substring(0, 200) : row.email;
    const phone = body.phone != null ? String(body.phone).trim().substring(0, 30) : row.phone;

    if (!member_name) return json({ success: false, message: "member_name is required" }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ success: false, message: "amount must be a positive number" }, 400);
    if (!date) return json({ success: false, message: "date is required" }, 400);

    await db.prepare(
      "UPDATE contributions SET member_name = ?, amount = ?, date = ?, category = ?, notes = ?, email = ?, phone = ?, fund = ?, updated_by = ? WHERE id = ?"
    ).bind(member_name, amount, date, category, notes, email, phone, fund, auth.email, id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contribution.update", entityType: "contribution", entityId: id,
      details: {
        before: { member_name: row.member_name, amount: row.amount, date: row.date, category: row.category, fund: row.fund },
        after: { member_name, amount, date, category, fund },
        wasVerifiedProof: !!row.proof_id
      }
    });

    return json({ success: true, message: `Contribution #${id} updated` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// Soft-delete a contribution: hidden from the public dashboard immediately,
// but the row (and its audit trail) is kept for admin-side reconciliation.
export async function onRequestDelete(context) {
  const auth = await requireManualEntryAdmin(context);
  if (!auth.ok) return auth.response;
  const db = context.env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  try {
    const url = new URL(context.request.url);
    let id = Number(url.searchParams.get("id"));
    if (!id) {
      try { const body = await context.request.json(); id = Number(body.id) || id; } catch (_) { /* no JSON body sent */ }
    }
    if (!id) return json({ success: false, message: "Missing contribution id" }, 400);

    const row = await db.prepare("SELECT id, member_name, amount, fund, proof_id FROM contributions WHERE id = ? AND is_deleted = 0").bind(id).first();
    if (!row) return json({ success: false, message: "Contribution not found" }, 404);

    await db.prepare("UPDATE contributions SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?").bind(auth.email, id).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "contribution.delete", entityType: "contribution", entityId: id,
      details: { member_name: row.member_name, amount: row.amount, fund: row.fund, wasVerifiedProof: !!row.proof_id }
    });

    return json({ success: true, message: `Contribution #${id} deleted` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// Support CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
