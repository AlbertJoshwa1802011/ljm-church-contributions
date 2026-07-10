// Cloudflare Pages Function: /api/verify
// Read-only post-migration data-integrity audit. Admin-only (view_members scope).
//
// Runs two groups of checks and NEVER writes to any data table (only an audit row):
//   1. D1 internal integrity — schema presence (was migration 0002 applied on
//      remote?), duplicate suspects, orphaned references, amount/date sanity,
//      config consistency.
//   2. Reconciliation against the live Google Sheets Apps Script (the migration
//      source of truth): row counts, per-fund amount totals, and row-level
//      matching by Razorpay proof_id or (member, amount, date) — pass
//      ?skipRemote=1 to run only the D1-internal checks.
//
// Every check returns { name, status: 'pass'|'warn'|'fail', detail }.
// Overall success = zero 'fail' checks. 'warn' items need human review but do
// not necessarily indicate data loss.

import { requireAuth, audit, json } from "./_lib.js";

const REQUIRED_TABLES = [
  "members", "contributions", "purchases", "config", "wishlist",
  "roles", "member_roles", "funds", "fund_members", "activity_logs"
];

const GAS_FALLBACK_URL = "https://script.google.com/macros/s/AKfycbwEnjzm9FHSSONNXWLecmmz_Gipfe0070bSRYxOE1YjljMJOeC9lLuaGAzJN7cF_I3I/exec";

// Same proof-id extraction the migration used, so reconciliation matches
// exactly what migrate.js imported.
function extractProofId(c) {
  let proofId = c.ProofID || c.Notes?.match(/ID:\s*([a-zA-Z0-9_]+)/)?.[1] || null;
  if (!proofId && c.Notes?.includes("pay_")) {
    proofId = c.Notes.substring(c.Notes.indexOf("pay_")).split(" ")[0].trim();
  }
  return proofId;
}

// Fuzzy row identity for rows without a proof_id: member + amount + calendar day.
function rowKey(member, amount, date) {
  return `${String(member || "").trim().toLowerCase()}|${Number(amount) || 0}|${String(date || "").substring(0, 10)}`;
}

// Match every sheet row against D1 rows (proof_id first, then fuzzy key).
function reconcileRows(sheetRows, d1Rows) {
  const d1ByProof = new Map();
  const d1KeyCount = new Map();
  for (const r of d1Rows) {
    if (r.proof_id) d1ByProof.set(r.proof_id, r);
    const k = rowKey(r.member_name, r.amount, r.date);
    d1KeyCount.set(k, (d1KeyCount.get(k) || 0) + 1);
  }

  const decrement = (k) => {
    const n = d1KeyCount.get(k) || 0;
    if (n > 0) d1KeyCount.set(k, n - 1);
    return n > 0;
  };

  const missingInD1 = [];
  let matched = 0;
  for (const c of sheetRows) {
    const proofId = extractProofId(c);
    if (proofId && d1ByProof.has(proofId)) {
      const r = d1ByProof.get(proofId);
      decrement(rowKey(r.member_name, r.amount, r.date));
      matched++;
      continue;
    }
    if (decrement(rowKey(c.Member, c.Amount, c.Date))) {
      matched++;
    } else {
      missingInD1.push({ member: c.Member, amount: c.Amount, date: c.Date });
    }
  }

  let extraInD1 = 0;
  for (const n of d1KeyCount.values()) extraInD1 += n;

  return { matched, missingInD1, extraInD1 };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "view_members");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const skipRemote = url.searchParams.get("skipRemote") === "1";

  const checks = [];
  const add = (name, status, detail, data) =>
    checks.push({ name, status, detail: detail || "", ...(data !== undefined ? { data } : {}) });

  // ── A. Schema presence (detects migration 0002 not applied on remote) ──
  let existingTables = new Set();
  try {
    const rows = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    existingTables = new Set((rows.results || []).map(r => r.name));
    const missing = REQUIRED_TABLES.filter(t => !existingTables.has(t));
    add("schema: required tables", missing.length ? "fail" : "pass",
      missing.length
        ? `missing tables: ${missing.join(", ")} — apply migrations/0002_dynamic_funds_audit.sql on remote D1`
        : `all ${REQUIRED_TABLES.length} tables present`);
  } catch (e) { add("schema: required tables", "fail", e.message); }

  try {
    const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='members'").first();
    const ddl = row?.sql || "";
    const missingCols = ["first_join_date", "recurring_reminders"].filter(c => !ddl.includes(c));
    add("schema: members profile columns (0002 ALTERs)", missingCols.length ? "warn" : "pass",
      missingCols.length
        ? `missing columns: ${missingCols.join(", ")} — the two ALTER TABLE statements of 0002 have not run on this database`
        : "first_join_date and recurring_reminders present");
  } catch (e) { add("schema: members profile columns (0002 ALTERs)", "warn", e.message); }

  try {
    const sys = await db.prepare("SELECT slug FROM funds WHERE is_system = 1").all();
    const slugs = (sys.results || []).map(r => r.slug);
    const ok = slugs.includes("tech-contributions") && slugs.includes("christmas-fund");
    add("schema: system funds seeded", ok ? "pass" : "fail", `system funds: ${slugs.join(", ") || "(none)"}`);
  } catch (e) { add("schema: system funds seeded", "fail", e.message); }

  // ── B. Row counts (informational snapshot) ──
  let d1FundCounts = {};
  try {
    const rows = await db.prepare(
      "SELECT fund, COUNT(*) AS n, ROUND(SUM(amount), 2) AS total FROM contributions GROUP BY fund"
    ).all();
    for (const r of (rows.results || [])) d1FundCounts[r.fund] = { count: r.n, total: r.total };
    const members = await db.prepare("SELECT COUNT(*) AS n FROM members").first();
    const purchases = await db.prepare("SELECT COUNT(*) AS n FROM purchases").first();
    add("counts: snapshot", "pass",
      `contributions: ${Object.entries(d1FundCounts).map(([f, v]) => `${f}=${v.count} (₹${v.total})`).join(", ")}; members=${members?.n}; purchases=${purchases?.n}`,
      { funds: d1FundCounts, members: members?.n, purchases: purchases?.n });
  } catch (e) { add("counts: snapshot", "fail", e.message); }

  // ── C. Duplicate suspects among rows without a proof_id ──
  // proof_id UNIQUE only dedupes online payments; cash/migrated rows can repeat.
  try {
    const rows = await db.prepare(
      `SELECT fund, member_name, amount, substr(date, 1, 10) AS day, COUNT(*) AS n
       FROM contributions
       WHERE proof_id IS NULL OR proof_id = ''
       GROUP BY fund, member_name, amount, substr(date, 1, 10)
       HAVING n > 1
       ORDER BY n DESC
       LIMIT 15`
    ).all();
    const dupes = rows.results || [];
    add("integrity: duplicate suspects (no proof_id)", dupes.length ? "warn" : "pass",
      dupes.length
        ? `${dupes.length} group(s) of identical (fund, member, amount, day) rows without proof_id — review and dedupe manually`
        : "no duplicate suspects",
      dupes.length ? dupes : undefined);
  } catch (e) { add("integrity: duplicate suspects (no proof_id)", "warn", e.message); }

  // ── D. Referential integrity (no FKs in schema, so verify by query) ──
  try {
    const rows = await db.prepare(
      "SELECT DISTINCT member_name FROM contributions WHERE member_name NOT IN (SELECT name FROM members) LIMIT 15"
    ).all();
    const names = (rows.results || []).map(r => r.member_name);
    add("integrity: contributions reference known members", names.length ? "warn" : "pass",
      names.length ? `contributors missing from members table: ${names.join(", ")}` : "every contributor exists in members");
  } catch (e) { add("integrity: contributions reference known members", "warn", e.message); }

  try {
    const rows = await db.prepare(
      "SELECT DISTINCT fund FROM contributions WHERE fund NOT IN (SELECT slug FROM funds) LIMIT 15"
    ).all();
    const slugs = (rows.results || []).map(r => r.fund);
    add("integrity: contribution funds registered", slugs.length ? "warn" : "pass",
      slugs.length ? `contribution rows point at unregistered fund slugs: ${slugs.join(", ")}` : "all contribution fund slugs exist in funds");
  } catch (e) { add("integrity: contribution funds registered", "warn", e.message); }

  try {
    const row = await db.prepare(
      `SELECT COUNT(*) AS n FROM fund_members
       WHERE fund_id NOT IN (SELECT id FROM funds) OR member_id NOT IN (SELECT id FROM members)`
    ).first();
    add("integrity: fund_members references", (row?.n || 0) > 0 ? "warn" : "pass",
      (row?.n || 0) > 0 ? `${row.n} fund_members row(s) reference a missing fund or member` : "no orphaned assignments");
  } catch (e) { add("integrity: fund_members references", "warn", e.message); }

  // ── E. Value sanity ──
  try {
    const rows = await db.prepare(
      "SELECT id, member_name, amount, fund FROM contributions WHERE amount <= 0 OR amount > 500000 LIMIT 15"
    ).all();
    const bad = rows.results || [];
    add("sanity: contribution amounts in range (₹1–₹5,00,000)", bad.length ? "warn" : "pass",
      bad.length ? `${bad.length} row(s) out of range` : "all amounts within expected range",
      bad.length ? bad : undefined);
  } catch (e) { add("sanity: contribution amounts in range (₹1–₹5,00,000)", "warn", e.message); }

  try {
    const rows = await db.prepare(
      `SELECT id, member_name, date FROM contributions
       WHERE date IS NULL OR date = '' OR substr(date, 5, 1) != '-' OR date > datetime('now', '+1 day')
       LIMIT 15`
    ).all();
    const bad = rows.results || [];
    add("sanity: contribution dates parse and are not in the future", bad.length ? "warn" : "pass",
      bad.length ? `${bad.length} row(s) with malformed or future dates` : "all dates look like ISO yyyy-MM-dd and are not future-dated",
      bad.length ? bad : undefined);
  } catch (e) { add("sanity: contribution dates parse and are not in the future", "warn", e.message); }

  try {
    const rows = await db.prepare(
      `SELECT LOWER(email) AS email, COUNT(*) AS n, GROUP_CONCAT(name, '; ') AS names
       FROM members WHERE email IS NOT NULL AND email != ''
       GROUP BY LOWER(email) HAVING n > 1 LIMIT 15`
    ).all();
    const dupes = rows.results || [];
    add("sanity: member emails unique", dupes.length ? "warn" : "pass",
      dupes.length
        ? `${dupes.length} email(s) shared by multiple members — account linking (PUT /api/auth) keys on this`
        : "no duplicate member emails",
      dupes.length ? dupes : undefined);
  } catch (e) { add("sanity: member emails unique", "warn", e.message); }

  // ── F. Config vs funds registry consistency ──
  try {
    const pairs = [
      ["tech_goal_amount", "tech-contributions"],
      ["christmas_goal_amount", "christmas-fund"]
    ];
    const mismatches = [];
    for (const [key, slug] of pairs) {
      const cfg = await db.prepare("SELECT value FROM config WHERE key = ?").bind(key).first();
      const fund = await db.prepare("SELECT goal_amount FROM funds WHERE slug = ?").bind(slug).first();
      if (cfg && fund && Number(cfg.value) !== Number(fund.goal_amount)) {
        mismatches.push(`${slug}: config=${cfg.value} vs funds=${fund.goal_amount}`);
      }
    }
    add("consistency: goal amounts (config vs funds)", mismatches.length ? "warn" : "pass",
      mismatches.length ? mismatches.join("; ") : "config goal values match the funds registry");
  } catch (e) { add("consistency: goal amounts (config vs funds)", "warn", e.message); }

  // ── G. Reconciliation against the live Google Sheets source ──
  if (!skipRemote) {
    const gasBaseUrl = env.GOOGLE_SHEETS_WEBAPP_URL || GAS_FALLBACK_URL;
    try {
      const [techRes, christmasRes, purchasesRes] = await Promise.all([
        fetch(`${gasBaseUrl}?fund=tech-contributions`),
        fetch(`${gasBaseUrl}?fund=christmas-fund`),
        fetch(`${gasBaseUrl}?fund=purchases`)
      ]);
      if (!techRes.ok || !christmasRes.ok || !purchasesRes.ok) {
        throw new Error(`Sheets fetch failed: tech=${techRes.status}, christmas=${christmasRes.status}, purchases=${purchasesRes.status}`);
      }
      const sheets = {
        "tech-contributions": await techRes.json(),
        "christmas-fund": await christmasRes.json()
      };
      const purchasesData = await purchasesRes.json();

      for (const [fund, data] of Object.entries(sheets)) {
        const sheetRows = data.contributions || [];
        const d1 = await db.prepare(
          "SELECT member_name, amount, date, proof_id FROM contributions WHERE fund = ?"
        ).bind(fund).all();
        const d1Rows = d1.results || [];

        const { matched, missingInD1, extraInD1 } = reconcileRows(sheetRows, d1Rows);

        add(`reconcile: ${fund} — every sheet row exists in D1`, missingInD1.length ? "fail" : "pass",
          `sheet=${sheetRows.length}, d1=${d1Rows.length}, matched=${matched}, missingInD1=${missingInD1.length}`,
          missingInD1.length ? missingInD1.slice(0, 20) : undefined);

        add(`reconcile: ${fund} — D1 rows not found in sheet`, extraInD1 > 0 ? "warn" : "pass",
          extraInD1 > 0
            ? `${extraInD1} D1 row(s) have no sheet counterpart (possible failed sheet-sync of a webhook payment, or a legit D1-only entry)`
            : "no unmatched D1 rows");

        const sheetTotal = sheetRows.reduce((s, c) => s + (Number(c.Amount) || 0), 0);
        const d1Total = d1Rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const delta = Math.round((d1Total - sheetTotal) * 100) / 100;
        add(`reconcile: ${fund} — amount totals match`, Math.abs(delta) < 0.01 ? "pass" : "fail",
          `sheet total=₹${Math.round(sheetTotal * 100) / 100}, D1 total=₹${Math.round(d1Total * 100) / 100}, delta=₹${delta}`);
      }

      const sheetPurchases = (purchasesData.purchases || []).length;
      const d1Purchases = (await db.prepare("SELECT COUNT(*) AS n FROM purchases").first())?.n || 0;
      add("reconcile: purchases count", d1Purchases >= sheetPurchases ? "pass" : "fail",
        `sheet=${sheetPurchases}, d1=${d1Purchases}`);

      const sheetMembers = new Set([
        ...Object.keys(sheets["tech-contributions"].memberEmails || {}),
        ...Object.keys(sheets["christmas-fund"].memberEmails || {}),
        ...(sheets["tech-contributions"].contributions || []).map(c => c.Member),
        ...(sheets["christmas-fund"].contributions || []).map(c => c.Member)
      ].filter(Boolean));
      const d1Members = await db.prepare("SELECT name FROM members").all();
      const d1MemberSet = new Set((d1Members.results || []).map(r => r.name));
      const missingMembers = [...sheetMembers].filter(n => !d1MemberSet.has(n));
      add("reconcile: members — every sheet member exists in D1", missingMembers.length ? "fail" : "pass",
        missingMembers.length
          ? `${missingMembers.length} member(s) in sheets but not in D1: ${missingMembers.slice(0, 10).join(", ")}`
          : `all ${sheetMembers.size} sheet members present in D1 (${d1MemberSet.size} total)`);

    } catch (e) {
      add("reconcile: Google Sheets source reachable", "warn",
        `could not reconcile against Sheets (${e.message}) — re-run later or pass ?skipRemote=1 for D1-only checks`);
    }
  } else {
    add("reconcile: skipped", "pass", "remote reconciliation skipped via ?skipRemote=1");
  }

  // ── Summary ──
  const summary = {
    pass: checks.filter(c => c.status === "pass").length,
    warn: checks.filter(c => c.status === "warn").length,
    fail: checks.filter(c => c.status === "fail").length,
    total: checks.length
  };

  await audit(context, {
    actorEmail: auth.email, actorType: "admin", verified: auth.verified,
    action: "verify.run", entityType: "system", entityId: "verify",
    details: summary
  });

  return json({
    success: summary.fail === 0,
    generatedAt: new Date().toISOString(),
    summary,
    checks
  }, 200, { "Cache-Control": "no-store" });
}
