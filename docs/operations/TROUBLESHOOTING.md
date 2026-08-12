# Troubleshooting

## Payment / webhook issues — read the runbook first

[`../runbooks/razorpay-webhook.md`](../runbooks/razorpay-webhook.md) is
required reading before diagnosing any "payment didn't show up" report. It
covers: the two independent webhooks that exist (Razorpay→Apps Script→Sheet,
and Razorpay→`/api/webhook`→D1 — they are not the same thing, and a healthy
Sheet does not imply D1 is healthy), how to read Razorpay's delivery log
without falling into the trap that caused the historical incident, the
health-check SQL, and the backfill procedure. Full payment-flow reference:
[`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md).

**Do not re-run `/api/migrate`** to "fix" missing data — it is explicitly
not safe to re-run (`NULL proof_id` rows plus SQLite `UNIQUE` semantics can
cause duplication). Use the backfill pattern in the runbook instead.

## "The admin console won't unlock for a real admin"

Check, in order: (1) is their email actually linked to a role in
`member_roles`, or one of the three `HARDCODED_SUPER_ADMINS` in
`functions/api/_lib.js`? (2) does `GOOGLE_CLIENT_ID` match what the Google
Cloud console has configured for this origin? (3) is
`ALLOW_LEGACY_EMAIL_TOKEN` relevant here — see
[`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md#known-weakness)
for what that flag actually does and doesn't gate.

## "A dashboard is showing all zeros / looks broken"

Two known historical causes, both already fixed but worth knowing the
pattern of: (1) an unapplied migration — `functions/api/contributions.js`
has a schema-drift guard that falls back to a pre-migration query shape on a
"no such column" error specifically because of a past incident where a
missing migration made the whole public dashboard render zeros; confirm the
expected migrations have actually been applied to the target D1 instance
(`DATABASE_SETUP.md`, [`../architecture/MIGRATION_PLAN.md`](../architecture/MIGRATION_PLAN.md)).
(2) `script.js`'s Analytics tab has a specific historical failure mode — see
`CLAUDE.md`'s "Known pitfall" section — where one undefined function call in
a synchronous callback silently aborted every chart queued after it. If a
new chart/render call was added recently, check it's wrapped in its own
`try`/`catch` per that pattern.

## "Tests are red"

Per `CONTRIBUTING.md` §1: if `npm test` is already red before you've changed
anything, stop and fix that first — don't build on a broken foundation, and
don't weaken or delete the failing test to get to green (`CONTRIBUTING.md`
§2, [`../development/AGENT_RULES.md`](../development/AGENT_RULES.md)). If a
failure is genuinely pre-existing and unrelated to your change, document it
clearly rather than silently working around it.

## "I found a database row/table I don't recognize"

Check [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md) —
`beta_testers`, `member_preferences`, and the `sandha_*` tables in
particular are easy to mistake for cruft if you haven't read the family/
subscriptions or beta-flow documentation. If it's still not accounted for
there, don't delete it — investigate first, per
[`../development/AGENT_RULES.md`](../development/AGENT_RULES.md)'s
no-guessing rule; it may be another agent session's in-progress work.

## Where else to look

[`../../TESTING.md`](../../TESTING.md) for test-harness issues,
[`../../DATABASE_SETUP.md`](../../DATABASE_SETUP.md) for D1
binding/creation issues, and the root-level `POST_MIGRATION_SAFETY_REPORT.md`
for the full list of known issues open as of the Sheets→D1 migration (some
since fixed, some — like member identity being name-keyed — still open and
now tracked in [`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#known-architectural-debt-carried-forward-not-fixed-by-this-doc)).
