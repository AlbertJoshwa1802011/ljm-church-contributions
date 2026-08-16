// Shared email helper for the milestone-v2 "cared-for response" (Prayer + Contact):
// a noreply acknowledgement to the sender and a notification to the ministry team.
// Sends via Resend (https://resend.com) over plain fetch — no SDK dependency.
// Underscore-prefixed file — Cloudflare Pages does not route it as an endpoint.
//
// By design this NEVER throws: a mail failure must never lose or roll back the
// prayer/contact submission that already persisted to D1 (SAFETY-AND-TESTS.md).
// Callers should persist first, then call sendMail(), and record ack_sent/
// team_notified from the returned { ok } — a false ok just means "try later",
// not "the request failed".

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Sends one email. Returns { ok, skipped?, error? } — never throws.
export async function sendMail(env, { to, subject, html, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM || "Light of Jesus Ministry <noreply@lightofjesus.org>";

  if (!apiKey) {
    // No mail provider configured (e.g. local dev, or not yet set up in
    // production) — treat as a soft no-op so the caller's flow proceeds.
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Fire both the sender acknowledgement and the team notification for a
// prayer/contact-style submission. Both legs are best-effort and independent
// of each other; the caller decides what to persist from the two outcomes.
export async function notifyBoth(env, { senderEmail, ackSubject, ackHtml, teamSubject, teamHtml }) {
  const teamAddress = env.TEAM_NOTIFY_EMAIL || env.MAIL_FROM;

  const [ack, team] = await Promise.all([
    senderEmail ? sendMail(env, { to: senderEmail, subject: ackSubject, html: ackHtml }) : Promise.resolve({ ok: false, skipped: true }),
    teamAddress ? sendMail(env, { to: teamAddress, subject: teamSubject, html: teamHtml, replyTo: senderEmail || undefined }) : Promise.resolve({ ok: false, skipped: true })
  ]);

  return { ack, team };
}

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
