// Shared email helper for Prayer and Contact (PRD §7.5-7.6, TRD §3).
// Sends via the Resend HTTP API (fetch — no SMTP, works from the Workers
// runtime). Underscore-prefixed — Cloudflare Pages does not route it as an
// endpoint.
//
// Deliberately best-effort: the caller must persist the request/message to
// D1 BEFORE calling this, so a mail failure (or no RESEND_API_KEY configured
// at all, e.g. in this environment right now) never loses a submission. This
// never throws — it returns { sent: boolean, reason? } and the caller logs
// that outcome on the row (ack_sent / team_notified columns).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendMail(env, { to, subject, html, from, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // No email provider configured — this is expected until the owner sets
    // RESEND_API_KEY in the Cloudflare dashboard (see docs/milestone-v2).
    // The submission itself is never blocked on this.
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: from || env.MAIL_FROM_ADDRESS || "Light of Jesus Ministry <noreply@lightofjesusministry.org>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, reason: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export function teamNotifyAddress(env) {
  return env.TEAM_NOTIFY_EMAIL || null;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function ackEmailHtml({ name }) {
  const greeting = name ? `Dear ${escapeHtml(name)},` : "Dear friend,";
  return `<p>${greeting}</p>
<p>Thank you for reaching out to Light of Jesus Ministry — our team will reach you soon.</p>
<p>We're praying for you and grateful you took a moment to connect with us.</p>
<p>— Light of Jesus Ministry</p>`;
}

export function teamNotifyHtml({ kind, fields }) {
  const rows = Object.entries(fields || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<p>New ${escapeHtml(kind)} received on the website:</p>
<table>${rows}</table>`;
}
