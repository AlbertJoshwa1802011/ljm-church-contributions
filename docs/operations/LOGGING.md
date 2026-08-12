# Logging

Two entirely separate systems exist in this codebase — don't conflate them,
and see [`../architecture/AUDIT_ARCHITECTURE.md`](../architecture/AUDIT_ARCHITECTURE.md)
for the full detail on the first one.

## Audit logging — `activity_logs` table

Who did what, for traceability and compliance. Written via
`functions/api/_lib.js#audit()`, viewed via `GET /api/logs`. Structured,
persistent, queryable, has real coverage gaps that are already documented
(webhook-originated contributions, sign-ins, and a few other endpoints are
not audited — see the architecture doc for the full list). Never log
passwords, payment secrets, API secrets, or auth tokens into this table —
none currently do, keep it that way.

## Application logging — `console.log`/`console.error`

Diagnostic/error logging for debugging runtime failures. Not structured, not
queryable beyond what Cloudflare's dashboard offers, not persisted beyond
Cloudflare's own log retention. Scattered through `functions/api/*.js`
handlers at points of failure (caught exceptions, unexpected states). No
request/correlation ID scheme exists today — `DECISION REQUIRED` if
cross-request tracing ever becomes necessary (e.g. to debug the
webhook-registration class of incident described in
[`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md), which
was diagnosed by manual data reconciliation rather than log correlation).

## Where to actually look

- **Audit trail**: admin console → Admin → Audit log, or `GET /api/logs`
  (`view_audit` scope) with `actor`/`action`/`actorType`/date-range filters.
- **Runtime errors**: Cloudflare Pages dashboard → the project's Functions
  log stream (real-time and historical, subject to Cloudflare's own
  retention — this repo has no separate log-shipping/aggregation setup).
- **Payment-specific diagnosis**: follow
  [`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md)'s
  verification commands and health-check SQL before assuming a log will
  explain a missing payment — the webhook handler's own idempotency logic
  and D1 state are usually the faster path to an answer than log-reading.

## Never log

Passwords, payment secrets, API secrets, authentication tokens, or
unnecessary personal/sensitive data, per the constitution this tree is built
from — consistent with current practice; keep it that way when adding new
log statements.
