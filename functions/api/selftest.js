// Cloudflare Pages Function: /api/selftest
// Production-safe end-to-end test suite. Super-admin only (delete_funds scope).
//
// Every test entity uses a unique ZZ-SELFTEST/TEST- marker and is removed in the
// cleanup phase, so real data is never touched. The run itself is audit-logged.
// Tests go through real same-origin HTTP subrequests, so routing, auth, and D1
// are exercised exactly like real traffic.

import { requireAuth, audit, json } from "./_lib.js";

const LEGACY_KEYS = [
  "goalAmount", "contributions", "memberEmails", "memberPhones",
  "memberStatus", "spentOnProducts", "productsBoughtCount", "availableBalance"
];

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "delete_funds");
  if (!auth.ok) return auth.response;

  const ts = Date.now();
  const testSlug = `zz-selftest-${ts}`;
  const testPurchaseId = `TEST-${ts}`;
  const testMemberName = `ZZ Selftest Member ${ts}`;
  let testWishlistId = null;
  let testMemberId = null;

  const url = new URL(request.url);
  let rawToken = request.headers.get("Authorization") || "";
  if (rawToken.toLowerCase().startsWith("bearer ")) rawToken = rawToken.slice(7);
  rawToken = (rawToken || url.searchParams.get("token") || "").trim();

  const origin = url.origin;
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${rawToken}` };
  const api = (path, init = {}) =>
    fetch(origin + path, { ...init, headers: { ...authHeaders, ...(init.headers || {}) } });

  const cases = [];
  const record = (name, passed, note) => cases.push({ name, passed: !!passed, note: note || "" });

  try {
    // ── 1+2. Legacy payload contract (Tech + Christmas) ──
    for (const fund of ["tech-contributions", "christmas-fund"]) {
      try {
        const res = await fetch(`${origin}/api/contributions?fund=${fund}&_t=${ts}`, { headers: { "Cache-Control": "no-cache" } });
        const data = await res.json();
        const missing = LEGACY_KEYS.filter(k => !(k in data));
        record(`legacy contract: ${fund}`, res.status === 200 && missing.length === 0,
          missing.length ? `missing keys: ${missing.join(",")}` : `goal=${data.goalAmount}, rows=${data.contributions.length}`);
      } catch (e) { record(`legacy contract: ${fund}`, false, e.message); }
    }

    // ── 3. Funds listing contains both system funds ──
    try {
      const res = await api(`/api/funds`);
      const data = await res.json();
      const slugs = (data.funds || []).map(f => f.slug);
      record("funds listing has system funds",
        slugs.includes("tech-contributions") && slugs.includes("christmas-fund"),
        `slugs: ${slugs.join(", ")}`);
    } catch (e) { record("funds listing has system funds", false, e.message); }

    // ── 4. Fund CRUD round-trip ──
    try {
      const create = await (await api(`/api/funds`, {
        method: "POST",
        body: JSON.stringify({ name: `ZZ Selftest Fund ${ts}`, slug: testSlug, goal_amount: 1234, description: "selftest", visibility: "public" })
      })).json();

      const detail = await (await api(`/api/funds?slug=${testSlug}`)).json();

      const update = await (await api(`/api/funds`, {
        method: "PUT",
        body: JSON.stringify({ slug: testSlug, goal_amount: 4321 })
      })).json();

      const detail2 = await (await api(`/api/funds?slug=${testSlug}&_t=2`, { headers: { "Cache-Control": "no-cache" } })).json();

      const del = await (await api(`/api/funds?slug=${testSlug}`, { method: "DELETE" })).json();
      const gone = await api(`/api/funds?slug=${testSlug}&_t=3`);

      record("fund create", create.success === true, create.message);
      record("fund detail (legacy shape)", LEGACY_KEYS.every(k => k in detail), `goal=${detail.goalAmount}`);
      record("fund update goal", update.success === true && detail2.goalAmount === 4321, `goal after update=${detail2.goalAmount}`);
      record("fund soft delete (super admin)", del.success === true && gone.status === 404, `post-delete status=${gone.status}`);
    } catch (e) { record("fund CRUD round-trip", false, e.message); }

    // ── 5. System fund protection ──
    try {
      const renameAttempt = await (await api(`/api/funds`, {
        method: "PUT",
        body: JSON.stringify({ slug: "tech-contributions", name: "Hacked Fund" })
      })).json();
      const deleteAttempt = await (await api(`/api/funds?slug=tech-contributions`, { method: "DELETE" })).json();
      record("system fund rename blocked", renameAttempt.success === false, renameAttempt.message);
      record("system fund delete blocked", deleteAttempt.success === false, deleteAttempt.message);
    } catch (e) { record("system fund protection", false, e.message); }

    // ── 6. Fund member assignment ──
    try {
      await db.prepare("INSERT INTO members (name, email) VALUES (?, ?)")
        .bind(testMemberName, `selftest-${ts}@example.invalid`).run();
      const m = await db.prepare("SELECT id FROM members WHERE name = ?").bind(testMemberName).first();
      testMemberId = m?.id;

      const createF = await (await api(`/api/funds`, {
        method: "POST",
        body: JSON.stringify({ name: `ZZ Selftest Fund ${ts}b`, slug: `${testSlug}-b`, visibility: "members" })
      })).json();

      const add = await (await api(`/api/funds`, {
        method: "POST",
        body: JSON.stringify({ action: "add_member", slug: `${testSlug}-b`, memberId: testMemberId })
      })).json();

      const detail = await (await api(`/api/funds?slug=${testSlug}-b`)).json();
      const assignedOk = (detail.assignedMembers || []).some(am => am.id === testMemberId);

      // anonymous viewer must be blocked on members-only fund
      const anonRes = await fetch(`${origin}/api/funds?slug=${testSlug}-b&_t=anon`);

      const remove = await (await api(`/api/funds`, {
        method: "POST",
        body: JSON.stringify({ action: "remove_member", slug: `${testSlug}-b`, memberId: testMemberId })
      })).json();

      record("fund member add", createF.success && add.success && assignedOk, `assigned=${assignedOk}`);
      record("members-only fund blocks anonymous", anonRes.status === 403, `status=${anonRes.status}`);
      record("fund member remove", remove.success === true, remove.message);
    } catch (e) { record("fund member assignment", false, e.message); }

    // ── 7. Purchases CRUD round-trip ──
    try {
      const qs = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      const add = await (await api(`/api/purchases?action=add_purchase&${qs({ id: testPurchaseId, productName: "ZZ Selftest Item", cost: 10, purchaseDate: "2000-01-01", fundSource: "zz-selftest-none", status: "Hidden", fundContribution: 0, externalContribution: 10 })}`)).json();
      const upd = await (await api(`/api/purchases?action=update_purchase&${qs({ id: testPurchaseId, productName: "ZZ Selftest Item v2", cost: 11, purchaseDate: "2000-01-01", fundSource: "zz-selftest-none", status: "Hidden", fundContribution: 0, externalContribution: 11 })}`)).json();
      const del = await (await api(`/api/purchases?action=delete_purchase&id=${testPurchaseId}`)).json();
      record("purchase add/update/delete", add.success && upd.success && del.success,
        [add.message, upd.message, del.message].join(" | "));
    } catch (e) { record("purchase add/update/delete", false, e.message); }

    // ── 8. Wishlist round-trip ──
    try {
      const add = await (await api(`/api/wishlist`, {
        method: "POST",
        body: JSON.stringify({ name: `ZZ Selftest Item ${ts}`, cost: 1, priority: "Low", notes: "selftest" })
      })).json();
      testWishlistId = add.id;
      const del = await (await api(`/api/wishlist?id=${testWishlistId}`, { method: "DELETE" })).json();
      record("wishlist add/delete", add.success && del.success, `id=${testWishlistId}`);
    } catch (e) { record("wishlist add/delete", false, e.message); }

    // ── 9. Unauthorized mutation is rejected ──
    try {
      const res = await fetch(`${origin}/api/funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Evil Fund" })
      });
      record("unauthenticated fund create blocked", res.status === 401, `status=${res.status}`);
    } catch (e) { record("unauthenticated fund create blocked", false, e.message); }

    // ── 10. Webhook rejects invalid signature ──
    try {
      const res = await fetch(`${origin}/api/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-razorpay-signature": "deadbeef" },
        body: JSON.stringify({ event: "payment.captured" })
      });
      record("webhook invalid signature rejected", res.status === 400, `status=${res.status}`);
    } catch (e) { record("webhook invalid signature rejected", false, e.message); }

    // ── 11. Audit trail wrote rows for this run ──
    try {
      const row = await db.prepare(
        "SELECT COUNT(*) AS n FROM activity_logs WHERE entity_id LIKE ? AND created_at > datetime('now','-5 minutes')"
      ).bind(`${testSlug}%`).first();
      record("audit rows written for admin ops", (row?.n || 0) >= 3, `rows=${row?.n}`);
    } catch (e) { record("audit rows written for admin ops", false, e.message); }

  } finally {
    // ── Cleanup: hard-delete every selftest artifact (test rows only) ──
    try { await db.prepare("DELETE FROM fund_members WHERE fund_id IN (SELECT id FROM funds WHERE slug LIKE 'zz-selftest-%')").run(); } catch (_) {}
    try { await db.prepare("DELETE FROM funds WHERE slug LIKE 'zz-selftest-%'").run(); } catch (_) {}
    try { await db.prepare("DELETE FROM purchases WHERE id LIKE 'TEST-%' AND name LIKE 'ZZ Selftest%'").run(); } catch (_) {}
    try { await db.prepare("DELETE FROM members WHERE name LIKE 'ZZ Selftest Member %'").run(); } catch (_) {}
    try { await db.prepare("DELETE FROM wishlist WHERE item_name LIKE 'ZZ Selftest Item %'").run(); } catch (_) {}
  }

  const passed = cases.filter(c => c.passed).length;
  const failed = cases.length - passed;

  await audit(context, {
    actorEmail: auth.email, actorType: "admin", verified: auth.verified,
    action: "selftest.run", entityType: "system", entityId: "selftest",
    details: { passed, failed, total: cases.length }
  });

  return json({
    success: failed === 0,
    passed, failed, total: cases.length,
    cases
  }, 200, { "Cache-Control": "no-store" });
}
