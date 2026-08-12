# Notification Architecture

## Status: does not exist

Confirmed by both backend and frontend investigation: there is no
transactional email, SMS, push, or in-app notification capability anywhere
in this codebase today. `docs/milestone-v2/01-PRD.md` §7.6 states this
explicitly as a known gap when describing the Contact feature: *"current
backend has no email capability — new capability needed."*

This matters beyond Contact — the constitution requires notification for:
prayer request submission (admin-console notification + email notification),
contact form acknowledgement + team notification, and is a prerequisite for
several other planned features (testimony moderation alerts, event
reminders).

## What's planned

`docs/milestone-v2/02-TRD.md` §3/§8 proposes:

- **Provider**: Resend, via a plain HTTP `fetch` call (no SDK dependency,
  consistent with this repo's no-build-step constraint) — noted in the TRD as
  an "open decision to confirm with owner." Treat this as **not yet finally
  decided**, not as settled.
- **Shared helper**: a new `functions/api/_mail.js` module, following the
  same underscore-prefixed shared-module convention as `_lib.js`/`_beta.js`.
- **Pattern**: persist-first, notify-second — e.g. `contact_messages` and
  `prayer_requests` rows are written to D1 unconditionally; email dispatch is
  a best-effort side effect afterward (mirroring the fire-and-forget pattern
  already used for `audit()` and the optional Google Sheets webhook forward
  in `webhook.js` — data durability never depends on the notification
  succeeding).

## `DECISION REQUIRED` before building

1. **Provider confirmation** — Resend vs. an alternative (SendGrid, Cloudflare
   Email Workers, etc.). The TRD's proposal is reasonable but explicitly
   unconfirmed by the owner as of that document.
2. **Secret management** — an API key needs a Cloudflare environment
   variable (matching the existing pattern for `RAZORPAY_WEBHOOK_SECRET`,
   `GOOGLE_CLIENT_ID`, etc.); never in source, per the constitution.
3. **Recipient configuration** — who receives prayer-request and
   contact-message notifications? Likely the existing `pastor_email`
   `config` key already used elsewhere (`settings.js`), but confirm rather
   than assume it should be reused for this new purpose.
4. **Failure visibility** — if Resend delivery fails, does anything surface
   that to an admin, or does it silently vanish (matching the
   fire-and-forget audit pattern)? Given prayer requests are pastorally
   sensitive, silent failure may not be acceptable here even though it's fine
   for analytics/audit — this is a product decision, not just a technical
   default.

## Do not build ad hoc

If a feature needs to send a notification before this is formally decided,
that's a signal to raise the `DECISION REQUIRED` items above with the user
first — not to add a one-off `fetch()` call to some other provider inside
that feature's endpoint. A second, inconsistent notification mechanism would
be its own form of the hardcoding-instead-of-configuration mistake this
constitution exists to prevent.
