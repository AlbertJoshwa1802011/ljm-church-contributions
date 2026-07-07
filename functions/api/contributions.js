// Cloudflare Pages Function: /api/contributions
// Fetches the entire state of a fund (goal, list of contributions, purchases, and member database)

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
    const contributionsQuery = await db.prepare(
      "SELECT member_name AS Member, amount AS Amount, date AS Date, category AS Category, notes AS Notes, email AS Email, phone AS Phone, proof_id AS ProofID FROM contributions WHERE fund = ? ORDER BY date DESC"
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

    // 6. Calculate available balance
    const totalCollected = contributions.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
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

// Support CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
