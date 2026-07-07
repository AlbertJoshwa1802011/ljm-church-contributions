// Cloudflare Pages Function: /api/webhook
// Receives payments from Razorpay, writes them to D1 database, and syncs them to Google Sheets in the background.

// Helper: Verify HMAC-SHA256 signature using Web Crypto API
async function verifyRazorpaySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);
  
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify", "sign"]
  );
  
  const signatureBytes = new Uint8Array(
    signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );
  
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    bodyData
  );
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    // Verify signature
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature verification failed" }), { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    
    // Check if the event is payment.captured
    if (payload.event !== "payment.captured") {
      return new Response(JSON.stringify({ message: "Unsupported event ignored" }), { status: 200 });
    }

    const payment = payload.payload.payment.entity;
    const paymentId = payment.id;
    const amount = Number(payment.amount) / 100; // Convert paise to INR
    const email = payment.notes?.memberEmail || payment.email || "";
    const phone = payment.notes?.memberPhone || payment.contact || "";
    const memberName = payment.notes?.memberName || "Anonymous";
    
    let fundName = payment.notes?.fundName || "tech-contributions";
    fundName = fundName.toLowerCase().replace(/\s+/g, '');
    if (fundName === "tech" || fundName === "techfund" || fundName === "tech-contributions") {
      fundName = "tech-contributions";
    } else if (fundName === "christmas" || fundName === "christmasfund" || fundName === "christmas-fund") {
      fundName = "christmas-fund";
    } else {
      fundName = "tech-contributions";
    }

    const monthFor = payment.notes?.month || "";
    const category = "Online (Verified)";
    const methodStr = payment.method === "upi" ? `upi (${payment.vpa || ""})` : payment.method;
    const notes = `${monthFor ? monthFor + ": " : ""}Online Payment Received | Method: ${methodStr}`;
    
    // Format payment date to YYYY-MM-DD HH:MM:SS (local UTC/timezone)
    const paymentDate = new Date(payment.created_at * 1000)
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);

    // 1. Idempotency Check & Insert into D1 SQL
    try {
      // Check if duplicate exists
      const existing = await db.prepare("SELECT id FROM contributions WHERE proof_id = ?")
        .bind(paymentId)
        .first();

      if (existing) {
        return new Response(JSON.stringify({ status: "success", message: "Duplicate payment ignored" }), { status: 200 });
      }

      // Insert contribution
      await db.prepare(
        "INSERT INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(memberName, amount, paymentDate, category, notes, paymentId, email, phone, fundName)
      .run();

      // Ensure member exists in members list
      const existingMember = await db.prepare("SELECT id FROM members WHERE name = ?")
        .bind(memberName)
        .first();

      if (!existingMember) {
        await db.prepare("INSERT INTO members (name, email, phone) VALUES (?, ?, ?)")
          .bind(memberName, email, phone)
          .run();
      } else {
        // Update contact details if missing
        await db.prepare("UPDATE members SET email = COALESCE(email, ?), phone = COALESCE(phone, ?) WHERE name = ?")
          .bind(email, phone, memberName)
          .run();
      }

    } catch (dbErr) {
      console.error("D1 database insertion failed:", dbErr);
      return new Response(JSON.stringify({ error: "Database transaction failed", details: dbErr.message }), { status: 500 });
    }

    // 2. Sync to Google Sheets asynchronously in the background
    const sheetsWebhookUrl = env.GOOGLE_SHEETS_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbzSyqYH-JR_JiJzkAxgxPEH1dPq8XPcQ3eUxtBx7HA76eTfReMlZq8GCPnOidotKkuW/exec";
    if (sheetsWebhookUrl) {
      context.waitUntil(
        fetch(sheetsWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-razorpay-signature": signature
          },
          body: rawBody
        })
        .then(res => res.text())
        .then(txt => console.log("Google Sheets sync completed:", txt))
        .catch(err => console.error("Google Sheets sync failed:", err))
      );
    }

    return new Response(JSON.stringify({ status: "success", paymentId }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || err.toString() }), { status: 500 });
  }
}
