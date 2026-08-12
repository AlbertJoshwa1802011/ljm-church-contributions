# Monitoring

## What exists today

There is no dedicated monitoring/alerting service configured for this
project (`DECISION REQUIRED` if one is ever wanted — Cloudflare offers
built-in analytics for Pages/Workers/D1 that isn't currently being used
beyond ad hoc dashboard checks). What exists instead are two on-demand
diagnostic tools, both admin-only:

- **`functions/api/selftest.js`** (admin console → Admin → Self-test) — a
  live end-to-end integration test against the real deployment: ~20 checks
  covering fund CRUD, permission enforcement, webhook signature rejection,
  role validation, and more. Every test entity is prefixed and hard-deleted
  regardless of outcome, so it's safe to run against production at any time.
  This is the closest thing to a health check this system has — run it after
  any deploy you're unsure about.
- **`functions/api/verify.js`** (`GET /api/verify`, `view_members` scope) —
  a read-only data-integrity/reconciliation audit: D1-internal checks
  (required tables present, duplicate suspects, orphaned references, amount/
  date sanity, config-vs-funds consistency) plus reconciliation against the
  legacy Google Sheets source (unless `?skipRemote=1`). Useful after a
  migration or if a payment-data discrepancy is suspected.

## The one thing worth actively watching

Per [`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md),
the Razorpay webhook registration itself lives in Razorpay's dashboard, not
in this codebase — it is a single point of failure this repo cannot detect
on its own (the historical incident where no online payment reached D1 for
nearly a month is exactly this failure mode; the sheet mirror looked healthy
the whole time because the wrong webhook was registered). The health-check
query in that runbook —
`SELECT MAX(date) FROM contributions WHERE proof_id IS NOT NULL` — is the
fastest way to confirm online giving is actually landing, and is worth
running periodically or after any Razorpay-dashboard configuration change.

## `DECISION REQUIRED`

Whether to invest in real monitoring (Cloudflare Analytics dashboards,
scheduled health-check pings, alerting on webhook silence) is an open
product/ops decision, not something this documentation task should decide
unilaterally. If pursued, the natural anchor point is the health-check query
above — a scheduled check that alerts if no verified online contribution has
landed in an unexpectedly long window would have caught the historical
incident within hours instead of weeks.
