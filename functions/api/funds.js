// Cloudflare Pages Function: /api/funds
// Dynamic fund registry: public listing/detail + admin CRUD + member assignment.
// Legacy funds (tech-contributions, christmas-fund) are seeded with is_system=1 and
// stay served by /api/contributions unchanged; here they are list-only + goal edits.

import { requireAuth, verifyGoogleToken, audit, json } from "./_lib.js";

const RESERVED_SLUGS = ["purchases", "api", "admin", "all"];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

// Resolve viewer email (for members-only funds): Bearer Google token, legacy email token, or null.
async function resolveViewer(context) {
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
  if (raw.includes("@")) return { email: raw.toLowerCase(), verified: false };
  return { email: null, verified: false };
}

async function getFundBySlug(db, slug) {
  return db.prepare("SELECT * FROM funds WHERE slug = ?").bind(slug).first();
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase().trim();

  try {
    if (!slug) {
      // ── Listing ──
      const auth = await requireAuth(context, "manage_funds").catch(() => null);
      const isAdmin = auth && auth.ok;

      const where = isAdmin
        ? "WHERE f.status != 'deleted'"
        : "WHERE f.status = 'active' AND f.visibility = 'public'";

      const query = await db.prepare(
        `SELECT f.id, f.slug, f.name, f.description, f.goal_amount AS goalAmount,
                f.status, f.visibility, f.is_system AS isSystem,
                f.created_by AS createdBy, f.created_at AS createdAt,
                COALESCE((SELECT SUM(c.amount) FROM contributions c WHERE c.fund = f.slug), 0) AS totalCollected,
                COALESCE((SELECT SUM(p.fund_contribution) FROM purchases p WHERE p.fund = f.slug AND p.status = 'Active'), 0) AS spentOnProducts,
                (SELECT COUNT(*) FROM fund_members fm WHERE fm.fund_id = f.id) AS memberCount
         FROM funds f ${where}
         ORDER BY f.is_system DESC, f.created_at ASC`
      ).all();

      const funds = (query.results || []).map(f => ({
        ...f,
        availableBalance: Math.max((f.totalCollected || 0) - (f.spentOnProducts || 0), 0)
      }));

      return json({ success: true, funds, count: funds.length }, 200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": isAdmin ? "no-store" : "public, max-age=15"
      });
    }

    // ── Detail (legacy-compatible payload shape) ──
    const fund = await getFundBySlug(db, slug);
    if (!fund || fund.status === "deleted") {
      return json({ error: "Fund not found" }, 404);
    }

    // members-only funds: viewer must be assigned, or hold manage_funds
    if (fund.visibility === "members") {
      const viewer = await resolveViewer(context);
      let allowed = false;
      if (viewer.email) {
        const assigned = await db.prepare(
          `SELECT 1 FROM fund_members fm JOIN members m ON m.id = fm.member_id
           WHERE fm.fund_id = ? AND LOWER(m.email) = ?`
        ).bind(fund.id, viewer.email).first();
        allowed = !!assigned;
        if (!allowed) {
          const auth = await requireAuth(context, "manage_funds");
          allowed = auth.ok;
        }
      }
      if (!allowed) return json({ error: "This fund is restricted to assigned members. Please sign in." }, 403);
    }

    const contributionsQuery = await db.prepare(
      `SELECT member_name AS Member, amount AS Amount, date AS Date, category AS Category,
              notes AS Notes, email AS Email, phone AS Phone, proof_id AS ProofID
       FROM contributions WHERE fund = ? ORDER BY date DESC`
    ).bind(fund.slug).all();
    const contributions = contributionsQuery.results || [];

    const membersQuery = await db.prepare("SELECT name, email, phone, is_verified FROM members").all();
    const memberEmails = {}, memberPhones = {}, memberStatus = {};
    (membersQuery.results || []).forEach(m => {
      if (!m.name) return;
      if (m.email) memberEmails[m.name] = m.email;
      if (m.phone) memberPhones[m.name] = m.phone;
      memberStatus[m.name] = m.is_verified === 1;
    });

    const spentQuery = await db.prepare(
      "SELECT SUM(fund_contribution) AS total, COUNT(id) AS count FROM purchases WHERE fund = ? AND status = 'Active'"
    ).bind(fund.slug).first();
    const spentOnProducts = spentQuery?.total || 0;
    const productsBoughtCount = spentQuery?.count || 0;

    const assignedQuery = await db.prepare(
      `SELECT m.id, m.name, m.email FROM fund_members fm JOIN members m ON m.id = fm.member_id WHERE fm.fund_id = ?`
    ).bind(fund.id).all();

    const totalCollected = contributions.reduce((s, c) => s + (Number(c.Amount) || 0), 0);

    return json({
      // legacy contract fields (script.js renders these)
      goalAmount: fund.goal_amount || 0,
      contributions,
      memberEmails,
      memberPhones,
      memberStatus,
      spentOnProducts,
      productsBoughtCount,
      availableBalance: Math.max(totalCollected - spentOnProducts, 0),
      // fund metadata extensions
      fund: {
        slug: fund.slug,
        name: fund.name,
        description: fund.description || "",
        status: fund.status,
        visibility: fund.visibility,
        isSystem: fund.is_system === 1
      },
      assignedMembers: assignedQuery.results || []
    }, 200, { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=15" });

  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
}

// POST: create fund, or member assignment actions
export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action || "create";

    if (action === "add_member" || action === "remove_member") {
      const slug = (body.slug || "").toLowerCase().trim();
      const memberId = Number(body.memberId);
      if (!slug || !memberId) return json({ success: false, message: "Missing slug or memberId" }, 400);

      const fund = await getFundBySlug(db, slug);
      if (!fund || fund.status === "deleted") return json({ success: false, message: "Fund not found" }, 404);

      if (action === "add_member") {
        await db.prepare("INSERT OR IGNORE INTO fund_members (fund_id, member_id, added_by) VALUES (?, ?, ?)")
          .bind(fund.id, memberId, auth.email).run();
      } else {
        await db.prepare("DELETE FROM fund_members WHERE fund_id = ? AND member_id = ?")
          .bind(fund.id, memberId).run();
      }

      await audit(context, {
        actorEmail: auth.email, actorType: "admin", verified: auth.verified,
        action: action === "add_member" ? "fund.member_add" : "fund.member_remove",
        entityType: "fund", entityId: slug, details: { memberId }
      });

      return json({ success: true, message: action === "add_member" ? "Member added to fund" : "Member removed from fund" });
    }

    // ── Create fund ──
    const name = (body.name || "").trim();
    if (!name) return json({ success: false, message: "Fund name is required" }, 400);

    let slug = slugify(body.slug || name);
    if (!slug || RESERVED_SLUGS.includes(slug)) {
      return json({ success: false, message: `Invalid or reserved slug '${slug}'` }, 400);
    }

    const existing = await getFundBySlug(db, slug);
    if (existing) return json({ success: false, message: `A fund with slug '${slug}' already exists` }, 409);

    const goal = Number(body.goal_amount || body.goalAmount || 0) || 0;
    const visibility = body.visibility === "members" ? "members" : "public";

    await db.prepare(
      `INSERT INTO funds (slug, name, description, goal_amount, status, visibility, is_system, created_by, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, 0, ?, CURRENT_TIMESTAMP)`
    ).bind(slug, name, body.description || "", goal, visibility, auth.email).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "fund.create", entityType: "fund", entityId: slug,
      details: { name, goal_amount: goal, visibility }
    });

    return json({ success: true, message: `Fund '${name}' created`, slug });

  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// PUT: update fund (system funds: goal_amount only)
export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_funds");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const slug = (body.slug || "").toLowerCase().trim();
    if (!slug) return json({ success: false, message: "Missing slug" }, 400);

    const fund = await getFundBySlug(db, slug);
    if (!fund || fund.status === "deleted") return json({ success: false, message: "Fund not found" }, 404);

    const changes = {};
    const isSystem = fund.is_system === 1;

    if (body.goal_amount != null || body.goalAmount != null) {
      changes.goal_amount = Number(body.goal_amount ?? body.goalAmount) || 0;
    }
    if (!isSystem) {
      if (body.name) changes.name = String(body.name).trim();
      if (body.description != null) changes.description = String(body.description);
      if (body.visibility && ["public", "members"].includes(body.visibility)) changes.visibility = body.visibility;
      if (body.status && ["active", "archived"].includes(body.status)) changes.status = body.status;
    } else if (body.name || body.status || body.visibility) {
      return json({ success: false, message: "System funds (Tech/Christmas) allow only goal amount edits" }, 400);
    }

    if (Object.keys(changes).length === 0) {
      return json({ success: false, message: "No editable fields provided" }, 400);
    }

    const setClause = Object.keys(changes).map(k => `${k} = ?`).join(", ");
    await db.prepare(
      `UPDATE funds SET ${setClause}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?`
    ).bind(...Object.values(changes), auth.email, slug).run();

    // Keep legacy config keys in sync so /api/contributions fallback stays consistent
    if (changes.goal_amount != null && isSystem) {
      const configKey = slug === "tech-contributions" ? "tech_goal_amount" : "christmas_goal_amount";
      await db.prepare("UPDATE config SET value = ? WHERE key = ?")
        .bind(String(changes.goal_amount), configKey).run();
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "fund.update", entityType: "fund", entityId: slug,
      details: { before: { name: fund.name, goal_amount: fund.goal_amount, status: fund.status, visibility: fund.visibility }, after: changes }
    });

    return json({ success: true, message: `Fund '${slug}' updated` });

  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// DELETE: soft delete (super admin only via delete_funds scope); system funds blocked
export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "delete_funds");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get("slug") || "").toLowerCase().trim();
    if (!slug) return json({ success: false, message: "Missing slug" }, 400);

    const fund = await getFundBySlug(db, slug);
    if (!fund || fund.status === "deleted") return json({ success: false, message: "Fund not found" }, 404);
    if (fund.is_system === 1) return json({ success: false, message: "System funds cannot be deleted" }, 400);

    await db.prepare("UPDATE funds SET status = 'deleted', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?")
      .bind(auth.email, slug).run();

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "fund.delete", entityType: "fund", entityId: slug,
      details: { name: fund.name }
    });

    return json({ success: true, message: `Fund '${fund.name}' deleted (soft). Contribution records are preserved.` });

  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
