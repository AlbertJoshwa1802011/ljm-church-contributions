// Cloudflare Pages Function: /api/funds
// Dynamic fund registry: public listing/detail + admin CRUD + member assignment.
// Legacy funds (tech-contributions, christmas-fund) are seeded with is_system=1 and
// stay served by /api/contributions unchanged; here they are list-only + goal edits.
//
// Fund Foundation metadata (hero image, message, ranking groundwork, Razorpay
// public-key groundwork — see migrations/0015_fund_foundation_metadata.sql) is
// editable on every fund, including system funds, since it's new metadata with
// no existing restriction to preserve. None of it is read by payment code yet.

import { requireAuth, resolveViewer, audit, json } from "./_lib.js";

const RESERVED_SLUGS = ["purchases", "api", "admin", "all"];

const MESSAGE_MAX_LEN = 5000;
const HERO_IMAGE_EXTERNAL_URL_MAX_LEN = 2000;
// Razorpay key ids (the PUBLIC id, never the secret) always look like
// rzp_live_xxxx / rzp_test_xxxx. Requiring this shape also happens to reject
// a pasted key SECRET (which has no rzp_ prefix) — a small guard against
// accidentally storing a credential in fund metadata.
const RAZORPAY_KEY_ID_RE = /^rzp_[A-Za-z0-9_]+$/;

// Raster types only. image/svg+xml is deliberately excluded: an SVG data URI
// can carry <script>/event-handler markup, so allowing it would let fund
// metadata smuggle attacker-controlled script into anywhere the hero image
// is rendered — unlike a raster format, which is inert as embedded data.
const HERO_IMAGE_ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const HERO_IMAGE_DATA_URI_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/s;
// ~2MB of base64 text ≈ 1.5MB of decoded image bytes — enough for a real
// hero photo while keeping a single fund row (and a D1 write) bounded.
const HERO_IMAGE_DATA_URI_MAX_LEN = 2 * 1024 * 1024;

// Cheap capability probe for the six migrations/0015_fund_foundation_metadata.sql
// columns, mirroring the try/catch "no such column" convention used
// elsewhere in this file (and in functions/api/contributions.js) rather
// than inventing a schema-version table. Only called on the POST/PUT
// (low-traffic, admin-only) paths, and only when the request actually
// touches Fund Foundation metadata — GET stays on the zero-overhead
// try/catch fallback below since it's the hot, public-facing path.
async function fundFoundationColumnsExist(db) {
  try {
    await db.prepare("SELECT hero_image_url FROM funds LIMIT 1").first();
    return true;
  } catch (err) {
    if (/no such column/i.test(err.message || String(err))) return false;
    throw err;
  }
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

// SELECT * is deliberately schema-drift-safe for the migrations/0015 columns:
// it never names hero_image_url/message/etc. explicitly, so it can't throw
// "no such column" on a pre-0015 database. Callers that read those columns
// off the returned row already guard with `|| ""` / `=== 1` (see the GET
// detail handler below), so a pre-0015 row — which simply won't carry those
// keys — degrades to the same "no Fund Foundation metadata set" defaults a
// migrated row has right after creation.
async function getFundBySlug(db, slug) {
  return db.prepare("SELECT * FROM funds WHERE slug = ?").bind(slug).first();
}

function validateHeroImageInput(value) {
  if (typeof value !== "string" || !value.trim()) return "heroImage must be a non-empty string";

  if (!value.startsWith("data:")) {
    if (value.length > HERO_IMAGE_EXTERNAL_URL_MAX_LEN) {
      return `heroImage URL exceeds ${HERO_IMAGE_EXTERNAL_URL_MAX_LEN} characters`;
    }
    return null;
  }

  if (value.length > HERO_IMAGE_DATA_URI_MAX_LEN) {
    return `heroImage data URI exceeds ${HERO_IMAGE_DATA_URI_MAX_LEN} characters`;
  }

  const match = HERO_IMAGE_DATA_URI_RE.exec(value);
  if (!match) return "heroImage data URI is malformed (expected data:<mime>;base64,<payload>)";

  const mime = match[1].toLowerCase();
  if (!HERO_IMAGE_ALLOWED_MIME_TYPES.has(mime)) {
    return `heroImage data URI type '${mime}' is not allowed (allowed: ${[...HERO_IMAGE_ALLOWED_MIME_TYPES].join(", ")})`;
  }

  return null;
}

// Store a fund hero image in R2 if bound, otherwise fall back to base64-in-D1.
// Mirrors functions/api/events.js's storePhoto(): reuses the same EVENT_PHOTOS
// R2 bucket (under a `funds/` key prefix) and the existing
// /api/events/photo?key=... server, so no new binding/endpoint is needed.
// The env.EVENT_PHOTOS branch below is untested offline for the same reason
// events.js's equivalent branch is: tests/helpers/mock-d1.mjs's makeContext()
// never sets an EVENT_PHOTOS binding, and there's no R2 mock yet to add one
// with. Tracked as an accepted gap, not a silent one — see
// docs/testing/COVERAGE-TRACKER.md's "Explicitly accepted gaps" section. The
// base64-fallback branch (taken whenever EVENT_PHOTOS isn't bound) IS covered.
async function storeHeroImage(env, slug, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;

  if (!dataUrl.startsWith("data:")) {
    return { hero_image_url: dataUrl, hero_image_storage: "external" };
  }

  if (env.EVENT_PHOTOS) {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!match) return { hero_image_url: dataUrl, hero_image_storage: "base64" };

    const mime = match[1] || "image/jpeg";
    const b64 = match[2] || "";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext = (mime.split("/")[1] || "jpg").split("+")[0];
    const key = `funds/${slug}/${crypto.randomUUID()}.${ext}`;

    await env.EVENT_PHOTOS.put(key, bytes, { httpMetadata: { contentType: mime } });

    return { hero_image_url: "/api/events/photo?key=" + encodeURIComponent(key), hero_image_storage: "r2" };
  }

  return { hero_image_url: dataUrl, hero_image_storage: "base64" };
}

// Best-effort delete of the underlying R2 object for a fund's hero image. Never throws.
async function deleteHeroImageObject(env, fund) {
  if (!fund || fund.hero_image_storage !== "r2" || !env.EVENT_PHOTOS) return;
  try {
    const url = new URL(fund.hero_image_url, "http://internal");
    const key = url.searchParams.get("key");
    if (key) await env.EVENT_PHOTOS.delete(key);
  } catch (_) {
    // best-effort — ignore
  }
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

      // Soft-deleted contributions (is_deleted, added in migration 0012) must
      // stay out of totalCollected the same way /api/contributions excludes
      // them — otherwise a deleted row would still inflate a fund's total.
      // Older databases without that column fall back to the unfiltered sum
      // (mirrors the schema-drift guard in functions/api/contributions.js).
      //
      // The Fund Foundation metadata columns (hero image, message, ranking
      // groundwork, Razorpay key-id groundwork — migrations/0015) are an
      // INDEPENDENT, later axis of drift: a database can have 0012 (so
      // contributions.is_deleted exists) applied without yet having 0015 (so
      // funds.hero_image_url etc. don't exist). Selecting those columns
      // unconditionally used to make this query fail with "no such column"
      // on exactly that (realistic, mid-deploy) database shape, and — since
      // the old fallback branch still referenced the same 0015 columns —
      // the failure wasn't actually caught, so the whole public funds
      // listing 500'd. Guard the two axes independently: try the full
      // query, then drop the 0015 columns, then drop the is_deleted filter
      // too, so each axis of drift is handled on its own.
      const buildQuery = (includeFoundation, includeIsDeletedFilter) => `
        SELECT f.id, f.slug, f.name, f.description, f.goal_amount AS goalAmount,
               f.status, f.visibility, f.is_system AS isSystem,
               ${includeFoundation ? `f.hero_image_url AS heroImageUrl, f.hero_image_storage AS heroImageStorage,
               f.message, f.ranking_enabled AS rankingEnabled, f.ranking_visibility AS rankingVisibility,
               f.razorpay_key_id AS razorpayKeyId,` : ""}
               f.created_by AS createdBy, f.created_at AS createdAt,
               COALESCE((SELECT SUM(c.amount) FROM contributions c WHERE c.fund = f.slug${includeIsDeletedFilter ? " AND c.is_deleted = 0" : ""}), 0) AS totalCollected,
               COALESCE((SELECT SUM(p.fund_contribution) FROM purchases p WHERE p.fund = f.slug AND p.status = 'Active'), 0) AS spentOnProducts,
               (SELECT COUNT(*) FROM fund_members fm WHERE fm.fund_id = f.id) AS memberCount
        FROM funds f ${where}
        ORDER BY f.is_system DESC, f.created_at ASC`;

      let query;
      try {
        query = await db.prepare(buildQuery(true, true)).all();
      } catch (schemaErr) {
        if (!/no such column/i.test(schemaErr.message || String(schemaErr))) throw schemaErr;
        try {
          query = await db.prepare(buildQuery(false, true)).all();
        } catch (schemaErr2) {
          if (!/no such column/i.test(schemaErr2.message || String(schemaErr2))) throw schemaErr2;
          query = await db.prepare(buildQuery(false, false)).all();
        }
      }

      const funds = (query.results || []).map(f => ({
        ...f,
        heroImageUrl: f.heroImageUrl ?? null,
        heroImageStorage: f.heroImageStorage ?? null,
        message: f.message ?? "",
        rankingEnabled: f.rankingEnabled ?? 0,
        rankingVisibility: f.rankingVisibility ?? "public",
        razorpayKeyId: f.razorpayKeyId ?? null,
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
      }
      if (!allowed) {
        // manage_funds holders (including the email-less machine ADMIN_API_TOKEN)
        // may view members-only funds even without an assignment.
        const auth = await requireAuth(context, "manage_funds");
        allowed = auth.ok;
      }
      if (!allowed) return json({ error: "This fund is restricted to assigned members. Please sign in." }, 403);
    }

    // Same is_deleted exclusion + schema-drift fallback as the listing query above.
    let contributionsQuery;
    try {
      contributionsQuery = await db.prepare(
        `SELECT member_name AS Member, amount AS Amount, date AS Date, category AS Category,
                notes AS Notes, email AS Email, phone AS Phone, proof_id AS ProofID
         FROM contributions WHERE fund = ? AND is_deleted = 0 ORDER BY date DESC`
      ).bind(fund.slug).all();
    } catch (schemaErr) {
      if (!/no such column/i.test(schemaErr.message || String(schemaErr))) throw schemaErr;
      contributionsQuery = await db.prepare(
        `SELECT member_name AS Member, amount AS Amount, date AS Date, category AS Category,
                notes AS Notes, email AS Email, phone AS Phone, proof_id AS ProofID
         FROM contributions WHERE fund = ? ORDER BY date DESC`
      ).bind(fund.slug).all();
    }
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
        isSystem: fund.is_system === 1,
        heroImageUrl: fund.hero_image_url || "",
        heroImageStorage: fund.hero_image_storage || "",
        message: fund.message || "",
        rankingEnabled: fund.ranking_enabled === 1,
        rankingVisibility: fund.ranking_visibility || "public",
        razorpayKeyId: fund.razorpay_key_id || ""
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

    // Pre-0015 guarding: the INSERT below always writes the six Fund
    // Foundation columns (migrations/0015). On a database that hasn't had
    // 0015 applied yet, those columns don't exist. Probe once (cheap —
    // POST is a low-traffic, admin-only path, unlike GET's hot public
    // listing) and either reject explicitly when the caller actually asked
    // for metadata the database can't store yet, or drop those columns from
    // the INSERT entirely so plain fund creation keeps working.
    const wantsFoundationMetadata = body.message != null || body.rankingEnabled != null ||
      body.rankingVisibility != null || body.razorpayKeyId != null || !!body.heroImage;
    const foundationColumnsExist = await fundFoundationColumnsExist(db);
    if (wantsFoundationMetadata && !foundationColumnsExist) {
      return json({
        success: false,
        message: "Fund Foundation metadata (hero image, message, ranking, Razorpay key) isn't available yet — this database is pending migration 0015. Create the fund without these fields, or apply the migration first."
      }, 503);
    }

    const message = body.message != null ? String(body.message) : "";
    if (message.length > MESSAGE_MAX_LEN) {
      return json({ success: false, message: `Fund message exceeds ${MESSAGE_MAX_LEN} characters` }, 400);
    }

    const rankingEnabled = body.rankingEnabled ? 1 : 0;
    if (body.rankingVisibility != null && !["public", "members"].includes(body.rankingVisibility)) {
      return json({ success: false, message: "rankingVisibility must be 'public' or 'members'" }, 400);
    }
    const rankingVisibility = body.rankingVisibility === "members" ? "members" : "public";

    let razorpayKeyId = null;
    if (body.razorpayKeyId != null) {
      const raw = String(body.razorpayKeyId).trim();
      if (raw) {
        if (!RAZORPAY_KEY_ID_RE.test(raw)) {
          return json({ success: false, message: "razorpayKeyId must look like a Razorpay public key id, e.g. rzp_live_xxxxx (never the key secret)" }, 400);
        }
        razorpayKeyId = raw;
      }
    }

    let heroImageUrl = null, heroImageStorage = null;
    if (body.heroImage) {
      const validationError = validateHeroImageInput(body.heroImage);
      if (validationError) return json({ success: false, message: validationError }, 400);
      const stored = await storeHeroImage(env, slug, body.heroImage);
      if (stored) { heroImageUrl = stored.hero_image_url; heroImageStorage = stored.hero_image_storage; }
    }

    if (foundationColumnsExist) {
      await db.prepare(
        `INSERT INTO funds (slug, name, description, goal_amount, status, visibility, is_system, created_by, updated_at,
                             hero_image_url, hero_image_storage, message, ranking_enabled, ranking_visibility, razorpay_key_id)
         VALUES (?, ?, ?, ?, 'active', ?, 0, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`
      ).bind(slug, name, body.description || "", goal, visibility, auth.email,
        heroImageUrl, heroImageStorage, message, rankingEnabled, rankingVisibility, razorpayKeyId).run();
    } else {
      // Pre-0015 database and no Fund Foundation metadata was requested
      // (guarded above) — insert only the columns that exist.
      await db.prepare(
        `INSERT INTO funds (slug, name, description, goal_amount, status, visibility, is_system, created_by, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, 0, ?, CURRENT_TIMESTAMP)`
      ).bind(slug, name, body.description || "", goal, visibility, auth.email).run();
    }

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

    // Fund Foundation metadata — new, so editable on every fund (including
    // system funds): there's no pre-existing restriction to preserve here.
    //
    // Pre-0015 guarding: unlike the fixed-shape INSERT in onRequestPost,
    // `changes` here is already built dynamically from whichever fields the
    // caller sent, so if none of the six migrations/0015 columns are
    // touched, the UPDATE below stays schema-drift-safe on its own — no
    // probe needed. Only check when the caller actually asked to change
    // one of those columns, and check it before the heroImage branch below
    // (which has real R2 side effects) so a pre-0015 database never wastes
    // an R2 write/delete on a change that's about to be rejected anyway.
    const wantsFoundationMetadata = body.message != null || body.rankingEnabled != null ||
      body.rankingVisibility != null || body.razorpayKeyId != null || body.removeHeroImage || !!body.heroImage;
    if (wantsFoundationMetadata && !(await fundFoundationColumnsExist(db))) {
      return json({
        success: false,
        message: "Fund Foundation metadata (hero image, message, ranking, Razorpay key) isn't available yet — this database is pending migration 0015."
      }, 503);
    }

    if (body.message != null) {
      const message = String(body.message);
      if (message.length > MESSAGE_MAX_LEN) {
        return json({ success: false, message: `Fund message exceeds ${MESSAGE_MAX_LEN} characters` }, 400);
      }
      changes.message = message;
    }

    if (body.rankingEnabled != null) {
      changes.ranking_enabled = body.rankingEnabled ? 1 : 0;
    }
    if (body.rankingVisibility != null) {
      if (!["public", "members"].includes(body.rankingVisibility)) {
        return json({ success: false, message: "rankingVisibility must be 'public' or 'members'" }, 400);
      }
      changes.ranking_visibility = body.rankingVisibility;
    }

    if (body.razorpayKeyId != null) {
      const raw = String(body.razorpayKeyId).trim();
      if (raw && !RAZORPAY_KEY_ID_RE.test(raw)) {
        return json({ success: false, message: "razorpayKeyId must look like a Razorpay public key id, e.g. rzp_live_xxxxx (never the key secret)" }, 400);
      }
      changes.razorpay_key_id = raw || null;
    }

    if (body.removeHeroImage) {
      await deleteHeroImageObject(env, fund);
      changes.hero_image_url = null;
      changes.hero_image_storage = null;
    } else if (body.heroImage) {
      const validationError = validateHeroImageInput(body.heroImage);
      if (validationError) return json({ success: false, message: validationError }, 400);
      await deleteHeroImageObject(env, fund); // replace the old object, if any
      const stored = await storeHeroImage(env, slug, body.heroImage);
      if (stored) {
        changes.hero_image_url = stored.hero_image_url;
        changes.hero_image_storage = stored.hero_image_storage;
      }
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
