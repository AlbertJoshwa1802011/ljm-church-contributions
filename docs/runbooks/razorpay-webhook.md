# Runbook — Razorpay webhook → D1

## The incident this documents

Between the D1 backend going live (8 Jul 2026) and 2 Aug 2026, **not one online
payment reached the database.** Gifts appeared in the Google Sheet and were
invisible on the portal.

Root cause: the only webhook registered in Razorpay pointed at the Google Apps
Script URL. `/api/webhook` was never called. The endpoint was deployed, correct,
and idle the whole time.

What made it hard to spot:

- The Sheet kept updating, which *looked* like the payment pipeline was fine.
- The Razorpay delivery log showed **success**, because it was reporting on the
  Apps Script webhook.
- Nothing in the admin console surfaced "no webhook-written row since April".

Evidence trail, if you ever need to re-derive it: no row in `contributions` had a
`proof_id` newer than 18 Apr 2026, yet `webhook.js` *always* sets `proof_id`.
Every "Online (Verified)" row after that date arrived via a manual
`/api/migrate` pull from the Sheet.

## How the pieces fit

```
Razorpay ─┬─→ Apps Script webhook ──→ Google Sheet
          └─→ /api/webhook ─────────→ D1  (contributions + members)
```

Two **independent** webhooks. Neither can break the other. This is deliberate:
`webhook.js` *can* forward to Apps Script itself, but chaining them means one
bad minute on our endpoint loses the Sheet too.

`/api/webhook` writes D1 **first**, and only then (optionally) forwards. So:

> **If the Sheet has a payment and D1 doesn't, our webhook did not run.**
> There is no code path that updates the Sheet without first writing D1.

## Configuration

### Razorpay — Account & Settings → Webhooks

Make sure the dashboard is in **Live Mode** (webhooks are per-mode, and the
checkout uses a `rzp_live_` key).

| Field | Value |
|---|---|
| URL | `https://light-of-jesus-ministry-contributions.pages.dev/api/webhook` |
| Active events | `payment.captured` — **this one only** |
| Secret | required — generate one and keep it |
| Status | Enabled |

**The secret is not optional.** With "Secret: Not provided", Razorpay sends no
`x-razorpay-signature` header and `verifyRazorpaySignature()` rejects every
delivery with `400`.

Leave the existing Apps Script webhook exactly as it is.

### Cloudflare Pages — Settings → Environment variables

| Variable | Value |
|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | the same secret, character for character |
| `GOOGLE_SHEETS_WEBAPP_URL` | **leave unset** |

`GOOGLE_SHEETS_WEBAPP_URL` unset means `webhook.js` does not forward to Apps
Script. That is what you want while Razorpay delivers to Apps Script directly —
forwarding as well would write every gift into the Sheet **twice**.

Environment variable changes need a **redeploy** to take effect.

## Verifying

### Is the secret right? (writes nothing)

A correctly signed payload with a non-`payment.captured` event exercises
signature verification and returns before touching the database:

```bash
SECRET='<RAZORPAY_WEBHOOK_SECRET>'
BODY='{"event":"payment.authorized","payload":{}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/.* //')
curl -s -X POST https://light-of-jesus-ministry-contributions.pages.dev/api/webhook \
  -H "Content-Type: application/json" -H "x-razorpay-signature: $SIG" \
  -d "$BODY" -w '\nHTTP %{http_code}\n'
```

- `200 {"message":"Unsupported event ignored"}` → secret is correct.
- `400 {"error":"Invalid signature verification failed"}` → mismatch.

### End to end

Make a ₹1 payment, then:

```bash
curl -s "https://light-of-jesus-ministry-contributions.pages.dev/api/contributions?fund=tech-contributions" \
| python3 -c "import json,sys; c=json.load(sys.stdin)['contributions']; \
p=[x for x in c if x.get('ProofID')]; \
print('newest webhook-written row:', max(str(x['Date']) for x in p))"
```

The timestamp should be the payment you just made, in **IST**.

## Reading the delivery log — the trap

**A `200` in Razorpay's log does not mean the contribution was recorded.**
`/api/webhook` returns `200` for any event that is not `payment.captured`:

| Response | Meaning |
|---|---|
| `200 {"status":"success","paymentId":"pay_..."}` | recorded in D1 |
| `200 {"message":"Duplicate payment ignored"}` | already recorded — fine |
| `200 {"message":"Unsupported event ignored"}` | **wrong event subscribed** |
| `400 {"error":"Invalid signature..."}` | secret mismatch |
| `500 {"error":"Database transaction failed"}` | D1 problem — investigate |

Always read the **body**, not the status.

## Health check

The signal that would have caught this on day one:

```sql
SELECT MAX(date) FROM contributions WHERE proof_id IS NOT NULL;
```

If that is more than a few days old and gifts are still arriving in the Sheet,
the webhook is not being delivered.

## Reconciliation — Razorpay is the source of truth

Not the Sheet. During this incident the three sources disagreed:

```
              rows    value
Razorpay        31   Rs 9,204   <- truth
Sheet           34   Rs 9,605   <- over-reported by Rs 401 (3 phantom rows)
D1              28   Rs 9,002   <- under-reported by Rs 202 (missed webhooks)
```

The Sheet had **double-written** two payments (`2026-05-04 07:43`,
`2026-07-07 23:43`) that Razorpay shows only once. A Sheet→D1 sync would have
imported those as real gifts. D1 was only ever *missing* rows, never inventing
them.

Note also that `/api/migrate` is **not** safe to re-run: 71 of the current rows
have a `NULL proof_id`, and SQLite treats NULLs as distinct in a `UNIQUE`
column, so `INSERT OR IGNORE` silently duplicates them. Verified:

```
NULL proof_id, 3 identical INSERT OR IGNORE runs -> 3 rows
real proof_id, 3 identical INSERT OR IGNORE runs -> 1 row
```

The Apps Script *does* record payment IDs — the sheet's proof column holds
`ID: pay_... | Method: upi (...) | Contact: ...` — but its `doGet` JSON only
returns `Date, Amount, Category, Notes, Member`. **Exposing that column as
`ProofID` is the one Apps Script change worth making**: it gives any future
reconciliation a real idempotency key.

## Backfilling missed payments

`migrations/0014_backfill_missed_webhook_payments.sql` is the worked example.
Method:

1. Pull the captured payments for the window from Razorpay.
2. Diff against `contributions` on `proof_id`.
3. Replay each missing payment through `functions/api/webhook.js` in the test
   harness and serialise the row it produces — never hand-write the SQL.
4. Verify against a replica seeded with the real production rows, applied
   **twice**, asserting the expected row delta and zero duplicate `proof_id`s.
5. Dispatch via `.github/workflows/apply-d1-migration.yml`.

Every backfilled row carries a real `proof_id`, so re-running is a no-op and a
later webhook delivery for the same payment is correctly ignored as a duplicate.
