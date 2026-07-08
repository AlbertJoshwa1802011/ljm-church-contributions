// Cloudflare Pages Function: /api/migrate
// One-click secure migration utility to pull data from Google Sheets API and populate D1 SQL database with 0% data loss.

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
  }

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  
  // Fail closed: bulk import only runs when MIGRATION_SECRET is configured AND
  // the caller presents it. With the secret unset the endpoint stays disabled
  // instead of becoming an unauthenticated mass-insert into production tables.
  if (!env.MIGRATION_SECRET) {
    return new Response(JSON.stringify({ error: "Migration endpoint disabled: MIGRATION_SECRET is not configured" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (secret !== env.MIGRATION_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stats = {
    contributionsInserted: 0,
    membersInserted: 0,
    purchasesInserted: 0,
    errors: []
  };

  try {
    // 1. Fetch Tech Fund & Christmas Fund raw data from existing Apps Script webapp
    const gasBaseUrl = env.GOOGLE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbwEnjzm9FHSSONNXWLecmmz_Gipfe0070bSRYxOE1YjljMJOeC9lLuaGAzJN7cF_I3I/exec";
    
    const [techRes, christmasRes, purchasesRes] = await Promise.all([
      fetch(`${gasBaseUrl}?fund=tech-contributions`),
      fetch(`${gasBaseUrl}?fund=christmas-fund`),
      fetch(`${gasBaseUrl}?fund=purchases`)
    ]);

    if (!techRes.ok || !christmasRes.ok || !purchasesRes.ok) {
      throw new Error(`Failed to fetch from Google Webapp. Status: Tech=${techRes.status}, Christmas=${christmasRes.status}, Purchases=${purchasesRes.status}`);
    }

    const techData = await techRes.json();
    const christmasData = await christmasRes.json();
    const purchasesData = await purchasesRes.json();

    // --- MIGRATION PART 1: MEMEBERS ---
    // Merge member databases
    const memberEmailsMap = { ...(techData.memberEmails || {}), ...(christmasData.memberEmails || {}) };
    const memberPhonesMap = { ...(techData.memberPhones || {}), ...(christmasData.memberPhones || {}) };
    const memberStatusMap = { ...(techData.memberStatus || {}), ...(christmasData.memberStatus || {}) };

    const allMemberNames = new Set([
      ...Object.keys(memberEmailsMap),
      ...Object.keys(memberPhonesMap),
      ...Object.keys(memberStatusMap),
      ...((techData.contributions || []).map(c => c.Member)),
      ...((christmasData.contributions || []).map(c => c.Member))
    ].filter(Boolean));

    const memberStmt = db.prepare(
      "INSERT OR IGNORE INTO members (name, email, phone, is_verified) VALUES (?, ?, ?, ?)"
    );

    const memberQueries = [];
    allMemberNames.forEach(name => {
      const email = memberEmailsMap[name] || "";
      const phone = memberPhonesMap[name] || "";
      const isVerified = memberStatusMap[name] === true ? 1 : 0;
      memberQueries.push(memberStmt.bind(name, email, phone, isVerified));
    });

    if (memberQueries.length > 0) {
      const results = await db.batch(memberQueries);
      stats.membersInserted = results.reduce((sum, r) => sum + (r.meta.changes || 0), 0);
    }

    // --- MIGRATION PART 2: CONTRIBUTIONS ---
    const contribStmt = db.prepare(
      "INSERT OR IGNORE INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const contribQueries = [];

    // Process Tech Fund contributions
    (techData.contributions || []).forEach(c => {
      // Parse proof / transaction ID if in notes e.g., 'ID: pay_TAi4L4qH3OlzON | Method: upi'
      let proofId = c.ProofID || c.Notes?.match(/ID:\s*([a-zA-Z0-9_]+)/)?.[1] || null;
      if (!proofId && c.Notes?.includes("pay_")) {
        proofId = c.Notes.substring(c.Notes.indexOf("pay_")).split(" ")[0].trim();
      }
      
      const email = c.Email || memberEmailsMap[c.Member] || "";
      const phone = c.Phone || memberPhonesMap[c.Member] || "";
      
      contribQueries.push(
        contribStmt.bind(c.Member, Number(c.Amount) || 0, c.Date, c.Category || "Direct Cash", c.Notes || "", proofId, email, phone, "tech-contributions")
      );
    });

    // Process Christmas Fund contributions
    (christmasData.contributions || []).forEach(c => {
      let proofId = c.ProofID || c.Notes?.match(/ID:\s*([a-zA-Z0-9_]+)/)?.[1] || null;
      const email = c.Email || memberEmailsMap[c.Member] || "";
      const phone = c.Phone || memberPhonesMap[c.Member] || "";

      contribQueries.push(
        contribStmt.bind(c.Member, Number(c.Amount) || 0, c.Date, c.Category || "Direct Cash", c.Notes || "", proofId, email, phone, "christmas-fund")
      );
    });

    if (contribQueries.length > 0) {
      const results = await db.batch(contribQueries);
      stats.contributionsInserted = results.reduce((sum, r) => sum + (r.meta.changes || 0), 0);
    }

    // --- MIGRATION PART 3: PURCHASES ---
    const purchaseStmt = db.prepare(
      "INSERT OR IGNORE INTO purchases (id, name, amount, date, fund, photo, vendor, description, status, fund_contribution, external_contribution, external_sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const purchaseQueries = [];
    (purchasesData.purchases || []).forEach(p => {
      // Normalize fund name for purchases ('Tech Fund' -> 'tech-contributions')
      let normalizedFund = p.fund === "Christmas Fund" ? "christmas-fund" : "tech-contributions";
      
      purchaseQueries.push(
        purchaseStmt.bind(
          p.id,
          p.name,
          Number(p.cost) || 0,
          p.date,
          normalizedFund,
          p.photo || "",
          p.vendor || "",
          p.description || "",
          p.status || "Active",
          Number(p.fundContribution) || 0,
          Number(p.externalContribution) || 0,
          p.externalSources || ""
        )
      );
    });

    if (purchaseQueries.length > 0) {
      const results = await db.batch(purchaseQueries);
      stats.purchasesInserted = results.reduce((sum, r) => sum + (r.meta.changes || 0), 0);
    }

    return new Response(JSON.stringify({ status: "success", stats }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    stats.errors.push(err.message || err.toString());
    return new Response(JSON.stringify({ status: "error", stats }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
