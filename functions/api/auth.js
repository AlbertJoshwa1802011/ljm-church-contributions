// Cloudflare Pages Function: /api/auth
// Receives a Google Identity Service JWT token, verifies it, and links/maps it to a member profile.

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
  }

  try {
    const { token } = await request.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing identity token" }), { status: 400 });
    }

    // 1. Verify token with Google TokenInfo API
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
    const googleRes = await fetch(googleVerifyUrl);
    if (!googleRes.ok) {
      return new Response(JSON.stringify({ error: "Google token verification failed" }), { status: 401 });
    }

    const payload = await googleRes.json();
    
    // Verify client ID matches if configured
    const clientID = env.GOOGLE_CLIENT_ID;
    if (clientID && payload.aud !== clientID) {
      return new Response(JSON.stringify({ error: "Audience mismatch / invalid client ID" }), { status: 401 });
    }

    const userEmail = payload.email;
    const userName = payload.name;
    const userPicture = payload.picture || "";

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "Email missing from Google profile" }), { status: 400 });
    }

    // 2. Query member by Google Email
    let member = await db.prepare("SELECT name, email, phone, is_verified FROM members WHERE email = ?")
      .bind(userEmail)
      .first();

    // 3. Fallback: If no email match, check if a member exists with the exact same name
    let mappingRecommendation = null;
    if (!member) {
      const matchByName = await db.prepare("SELECT name, email, phone, is_verified FROM members WHERE LOWER(name) = LOWER(?) AND (email IS NULL OR email = '')")
        .bind(userName)
        .first();

      if (matchByName) {
        // We found a name match with no email bound yet! Suggest linking
        mappingRecommendation = matchByName.name;
      }
    }

    // 4. Return mapping status
    return new Response(
      JSON.stringify({
        status: "success",
        user: {
          email: userEmail,
          name: userName,
          picture: userPicture
        },
        member: member || null,
        mappingRecommendation // Suggest mapping to this member name if they accept
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || err.toString() }), { status: 500 });
  }
}

// Helper: Handle linkage request (associate Google Email to member record)
export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
  }

  try {
    const { token, memberName } = await request.json();
    if (!token || !memberName) {
      return new Response(JSON.stringify({ error: "Missing token or memberName parameters" }), { status: 400 });
    }

    // Verify token with Google
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
    const googleRes = await fetch(googleVerifyUrl);
    if (!googleRes.ok) {
      return new Response(JSON.stringify({ error: "Google token verification failed" }), { status: 401 });
    }

    const payload = await googleRes.json();
    const userEmail = payload.email;

    // Update the member's email in database
    const result = await db.prepare("UPDATE members SET email = ? WHERE name = ? AND (email IS NULL OR email = '')")
      .bind(userEmail, memberName)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Failed to link account. Member may already have an email linked." }), { status: 400 });
    }

    const member = await db.prepare("SELECT name, email, phone, is_verified FROM members WHERE name = ?")
      .bind(memberName)
      .first();

    return new Response(JSON.stringify({ status: "success", member }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || err.toString() }), { status: 500 });
  }
}
