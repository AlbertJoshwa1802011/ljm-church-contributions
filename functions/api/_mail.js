// Shared email helper for Pages Functions — sends transactional mail (contact-form
// acknowledgements, prayer-request notifications) via the Resend HTTP API.
// Underscore-prefixed file — Cloudflare Pages does not route it as an endpoint.
//
// Opt-in by design, same pattern as webhook.js's GOOGLE_SHEETS_WEBAPP_URL forward:
// unset env.RESEND_API_KEY → sendMail() is a documented no-op, never throws, never
// contacts the network. Callers MUST persist the record to D1 before calling this —
// a mail-provider outage or missing config must never lose a prayer/contact submission.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// sendMail({ env, to, subject, text, html?, from? }) → { sent, reason? }
// Never throws. `sent` is false (not an error) when RESEND_API_KEY isn't configured.
export async function sendMail({ env, to, subject, text, html, from }) {
  if (!to || !subject || !text) {
    return { sent: false, reason: "missing to/subject/text" };
  }
  const apiKey = env && env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: from || env.MAIL_FROM_ADDRESS || "Light of Jesus Ministry <noreply@lightofjesusministry.org>",
        to: [to],
        subject,
        text,
        ...(html ? { html } : {})
      })
    });

    if (!res.ok) {
      return { sent: false, reason: `Resend responded ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: (err && err.message) || "network error" };
  }
}

// Notify the internal team address (env.TEAM_NOTIFY_EMAIL) about a new
// prayer/contact submission. Same never-throws contract as sendMail().
export async function notifyTeam({ env, subject, text }) {
  const teamEmail = env && env.TEAM_NOTIFY_EMAIL;
  if (!teamEmail) return { sent: false, reason: "TEAM_NOTIFY_EMAIL not configured" };
  return sendMail({ env, to: teamEmail, subject, text });
}
