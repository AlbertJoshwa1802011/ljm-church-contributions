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
    if (fund === "tech" || fund === "techfund" || fund === "tech-contributions") {
      fund = "tech-contributions";
    } else if (fund === "christmas" || fund === "christmasfund" || fund === "christmas-fund") {
      fund = "christmas-fund";
    } else {
      fund = "tech-contributions"; // Fallback default
    }

    // 2. Fetch Goal Amount from D1 config table
    const goalKey = fund === "tech-contributions" ? "tech_goal_amount" : "christmas_goal_amount";
    const goalResult = await db.prepare("SELECT value FROM config WHERE key = ?")
      .bind(goalKey)
      .first();
    const goalAmount = goalResult ? Number(goalResult.value) || 0 : 0;

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
    const purchasesQuery = await db.prepare(
      "SELECT SUM(amount) as total, COUNT(id) as count FROM purchases WHERE fund = ?"
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
        "Cache-Control": "public, max-age=15" // Cache client-side for 15 seconds
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || err.toString() }),
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
