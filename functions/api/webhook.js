// Cloudflare Pages Function: /api/webhook
// Receives payments from Razorpay, writes them to D1 database, and syncs them to Google Sheets in the background.

// Contribution timestamps are stored in IST to match every other row in the
// table (see the paymentDate comment below). Workers run in UTC with no tz
// database, so the offset is applied explicitly. India has no DST, so a fixed
// offset is correct year-round.
const IST_OFFSET_SECONDS = 5.5 * 3600;

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
    
    // Format payment date to 'YYYY-MM-DD HH:MM:SS' in IST (UTC+05:30).
    //
    // This used to store UTC. Every other row in `contributions` is IST — the
    // Google Sheet writes IST, the Razorpay dashboard displays IST, and the
    // congregation is in India — so a UTC row rendered 5h30m before the gift
    // actually happened (a 17:31 payment showing as 12:01 on the portal).
    // The mismatch went unnoticed because the webhook had never successfully
    // delivered to this endpoint; the first real delivery would have started
    // mixing two timezones in one ledger.
    const paymentDate = new Date((payment.created_at + IST_OFFSET_SECONDS) * 1000)
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
      // Concurrent duplicate delivery: both requests pass the SELECT check, the
      // second INSERT then hits the proof_id UNIQUE constraint. Acknowledge with
      // 200 so Razorpay stops retrying a payment that is already recorded.
      if (/UNIQUE|constraint/i.test(dbErr.message || "")) {
        return new Response(JSON.stringify({ status: "success", message: "Duplicate payment ignored" }), { status: 200 });
      }
      console.error("D1 database insertion failed:", dbErr);
      return new Response(JSON.stringify({ error: "Database transaction failed", details: dbErr.message }), { status: 500 });
    }

    // 2. Optionally mirror the payment to Google Sheets, in the background.
    //
    // Opt-in: forwarding happens ONLY when GOOGLE_SHEETS_WEBAPP_URL is set.
    // This previously fell back to a hardcoded Apps Script deployment when the
    // variable was unset or empty, which meant (a) the forward could not be
    // turned off by configuration at all, and (b) the fallback pointed at a
    // *different, stale* deployment than the one actually serving the sheet —
    // so payment payloads would have been POSTed to the wrong script.
    //
    // Leave this unset when Razorpay delivers to the Apps Script webhook
    // directly (the current setup): the sheet is already being written on that
    // path, and forwarding here too would write every gift to it twice.
    const sheetsWebhookUrl = env.GOOGLE_SHEETS_WEBAPP_URL || "";
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
