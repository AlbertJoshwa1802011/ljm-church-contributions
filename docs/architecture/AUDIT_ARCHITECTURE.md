# Audit Architecture

## Schema

`activity_logs` (see [`DATA_MODEL.md`](./DATA_MODEL.md)): `actor_email`,
`actor_type` (`admin`\|`member`\|`anonymous`), `action`, `entity_type`,
`entity_id`, `details` (free-form JSON), `ip` (from `CF-Connecting-IP`),
`user_agent` (truncated to 300 chars), `verified` (whether the actor's
identity was cryptographically proven via Google token at the time of the
action, vs. the legacy email fallback — see
[`PERMISSION_ARCHITECTURE.md`](./PERMISSION_ARCHITECTURE.md#known-weakness)),
`created_at`. Indexed on `created_at DESC`, `actor_email`, `action`.

## Write path

Exclusively through `functions/api/_lib.js#audit()`. It is deliberately
**fire-and-forget** — a failed write is `console.error`'d but never
propagates or blocks the real operation ("audit failure must not break the
real operation," per the code comment). There is no database trigger or
framework-level auto-instrumentation; every call site explicitly invokes
`audit()` after its own mutation succeeds. Viewed via `GET /api/logs`
(`view_audit` scope).

## Coverage — broad, but explicitly partial

**Endpoints that DO write `activity_logs`**: `beta-testers.js`, `roles.js`
(all 4 actions), `funds.js` (all mutations), `contributions.js` (manual
add/update/delete only), `expenses.js`, `purchases.js`, `wishlist.js`,
`members.js`, `families.js` (all 6 mutation paths), `subscriptions.js`,
`events.js`, `bible.js` (import), `settings.js`, `verify.js` (logs a summary
of its own integrity-check run), `selftest.js` (logs pass/fail counts).
`logs.js`'s own `POST` also writes rows — but those are anonymous page-view
analytics (`view.page`/`view.fund`), not admin-action audit entries; don't
conflate the two when reading the table.

**Endpoints that do NOT write `activity_logs`**:

| Endpoint | What's missing |
|---|---|
| `auth.js` | No record of sign-ins, or of which member record gets linked to which Google account (the `PUT` email-linking action) |
| `webhook.js` | **Razorpay-originated contributions are never audited** — only manually-entered contributions are. The single largest category of state change in the whole system (live payment data) has zero audit trail today. |
| `beta-activate.js` | Cookie issuance not logged |
| `appearance.js` | Theme preference changes not logged (low-stakes, but noted for completeness) |
| `migrate.js` | The one-time bulk-import tool — no audit row despite being the highest-blast-radius endpoint in the codebase |

## Gap against the constitution

The constitution requires audit coverage for, at minimum: login/logout,
failed login, contribution changes, payment configuration changes, and
several other categories. Measured against what's actually implemented:

- **Contribution changes**: partially covered — manual entries are audited
  with before/after diffs; **webhook-originated contributions (the majority
  of real giving) are not.** This is the highest-priority gap to close.
- **Login/logout, failed login**: not covered at all. `auth.js` has no audit
  calls.
- **Payment configuration changes**: not applicable yet (no per-fund payment
  config exists — see [`PAYMENT_ARCHITECTURE.md`](./PAYMENT_ARCHITECTURE.md)),
  but should be added when that capability is built, not retrofitted after.
- **Role/permission changes**: covered (`roles.js`).
- **Fund/expense/event/content changes**: covered.

## What this document is and isn't

This is a documentation-foundation task — it records the gap so the next
agent who works on `webhook.js` or `auth.js` knows it's there and already
scoped, rather than a silent instruction to go fix it now. Closing the
webhook-audit gap in particular touches the frozen giving path
(`CONTRIBUTING.md` §3) — even though it's an *addition* (a new `audit()` call
after the existing insert, not a change to the insert itself) it should still
go through the same deliberate, tested, reviewed process as any other change
to that file, with its own test asserting the audit row is written (see
`selftest.js`'s existing pattern of asserting audit rows were written during
a self-test run, as a reference).

## Application logs vs. audit logs — kept separate, correctly

`activity_logs` is the audit trail (who did what, for compliance/traceability
— per the constitution's distinction in §24 vs §25). There is no separate
structured application/error-logging system in this codebase today; runtime
errors surface via `console.error`/`console.log` calls scattered through the
handlers, visible in the Cloudflare Pages Functions dashboard log stream (see
[`../operations/LOGGING.md`](../operations/LOGGING.md)). Do not add
diagnostic/error logging into `activity_logs` — keep the separation the
constitution requires.
