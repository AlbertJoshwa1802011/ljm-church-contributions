# Fund System — architecture audit + Fund Foundation phase

> **Note on this document's origin:** an earlier task brief referenced this file
> and `docs/development/AGENT_HANDOFFS.md` as required pre-reading, but neither
> existed in the repository at the time (verified by full-repo search, not a
> stale checkout). This document was created *during* the Fund Foundation phase
> to serve as the audit it was supposed to follow — it describes the Fund
> system as it stood before that phase, then what the phase added and why. If
> you're the next agent touching Funds, start here.

## 1. What exists today (before the Fund Foundation phase)

### 1.1 Storage

`funds` table (`schema.sql`, seeded by `migrations/0002_dynamic_funds_audit.sql`):

| Column | Purpose |
|---|---|
| `id`, `slug`, `name` | Identity. `slug` is the URL/API key (`tech-contributions`, `christmas-fund`, or admin-chosen for custom funds). |
| `description` | Short text, used today as the one-line subtitle on the public fund widget (`script.js`). |
| `goal_amount` | Editable goal; kept in sync with the legacy `config` keys `tech_goal_amount`/`christmas_goal_amount` for the two system funds. |
| `status` | `active` \| `archived` \| `deleted` (soft delete — contribution rows are never removed). |
| `visibility` | `public` \| `members` (members-only funds require an entry in `fund_members` or `manage_funds`). |
| `is_system` | `1` for the two legacy funds (Tech, Christmas): identity fields (`name`, `description`, `visibility`, `status`) cannot be changed via the API, only `goal_amount`. |
| `created_by`/`created_at`/`updated_by`/`updated_at` | Audit trail. |

`fund_members` (many-to-many, for members-only visibility) and `activity_logs`
(admin audit trail, written via `functions/api/_lib.js`'s `audit()`) round out
the registry.

### 1.2 API — `functions/api/funds.js`

- `GET /api/funds` — public listing (active + public funds) or admin listing
  (`manage_funds`, everything except soft-deleted).
- `GET /api/funds?slug=X` — legacy-shape detail payload (`goalAmount`,
  `contributions`, `memberEmails`, etc.) that `script.js` renders directly;
  also carries a `fund: {...}` metadata object and `assignedMembers`.
- `POST /api/funds` — create a fund, or `add_member`/`remove_member` actions.
- `PUT /api/funds` — update; system funds are restricted to `goal_amount`.
- `DELETE /api/funds?slug=X` — soft delete (`delete_funds` permission, distinct
  from `manage_funds`); system funds cannot be deleted.

### 1.3 Payments (unchanged by this phase, and out of scope for it)

Today there is **exactly one Razorpay account**. Its public key id is
hardcoded as `RAZORPAY_TEST_KEY_ID` in `razorpay-checkout.js`; the secret
lives server-side and is used only by `functions/api/webhook.js`, which is
not routed by fund at all — it verifies and stores whatever payment comes in
against `contributions.fund` (matched by the `?fund=` query param the
checkout page was opened with). There is no per-fund payment configuration of
any kind before this phase.

### 1.4 Media (existing pattern, reused rather than reinvented)

`functions/api/events.js` stores event photos in an R2 bucket
(`env.EVENT_PHOTOS` binding) when available, falling back to a base64 data URL
stored directly in D1 when it isn't. A `storage` column (`'r2' | 'base64' |
'external'`) records which. Photos are served back through the existing
`/api/events/photo?key=...` endpoint regardless of key prefix.

## 2. The future architecture this phase prepares for

The long-term direction (per the task that started this phase) is:

```
Fund → Razorpay configuration → Contribution/payment
```

i.e., eventually different funds may route to different Razorpay accounts —
for example a Building Fund routing to a dedicated account, while Tech and
Christmas funds continue sharing the church's original account. **That
routing does not exist yet and is explicitly out of scope for this phase.**
This phase only adds the metadata a fund needs to carry so that future work
has somewhere to read from, without having to touch the schema again.

Also anticipated: a more "professional" public fund experience with a hero
image, a fuller narrative message, and some form of giver ranking — none of
which have a public UI yet.

## 3. What the Fund Foundation phase added

**Migration:** `migrations/0015_fund_foundation_metadata.sql` — six additive,
nullable/defaulted columns on `funds`. No table was dropped or renamed; no
existing column changed type or meaning; the two system funds and every
custom fund keep their existing `id`s, `slug`s, and history untouched.

| New column | Purpose | Design note |
|---|---|---|
| `hero_image_url` | Hero image URL/reference. | Populated via the same R2-with-base64-fallback pattern as `events.js`, reusing the **existing** `EVENT_PHOTOS` R2 binding under a `funds/` key prefix and the **existing** `/api/events/photo` server — no new binding or endpoint. |
| `hero_image_storage` | `'r2' \| 'base64' \| 'external'` | Same convention as `event_photos.storage`. |
| `message` | Longer "why this fund exists" narrative. | **Deliberately not merged into `description`.** `description` edits are restricted to non-system funds by pre-existing PUT logic; reusing it for the new "message" concept would have meant loosening that restriction — a behavior change outside this phase's scope. `message` is new metadata with no prior restriction, so it's editable on every fund, including Tech/Christmas. |
| `ranking_enabled` | `0`/`1` — ranking groundwork only. | No public ranking UI exists or was built in this phase. |
| `ranking_visibility` | `'public' \| 'members'` | Deliberately mirrors the existing `funds.visibility` convention so admins reuse a concept they already know. |
| `razorpay_key_id` | Future per-fund Razorpay **public** key id. | `NULL` means "use today's single hardcoded key" — i.e., unchanged behavior. **This is the publishable key id, never the key secret.** Validated server-side against `/^rzp_[A-Za-z0-9_]+$/`, which incidentally also rejects a pasted key secret (secrets don't carry the `rzp_` prefix). Not read by any payment code yet. |

**API (`functions/api/funds.js`):** all five fields above are readable from
both the listing and detail endpoints (camelCased: `heroImageUrl`,
`heroImageStorage`, `message`, `rankingEnabled`, `rankingVisibility`,
`razorpayKeyId`), and writable via `POST` (create) and `PUT` (update).
Unlike the pre-existing identity fields, they are writable **on system funds
too** — see the `message` design note above for why that's safe. Validation
added: hero image type/length checks, a 5000-char cap on `message`, an enum
check on `rankingVisibility`, and the Razorpay key-id shape check.

**Admin UI (`admin.html`):** the Funds form is now grouped into five labeled
sections — *Fund identity*, *Description & message*, *Visual — hero image*,
*Ranking (configuration only)*, and *Payment configuration (groundwork —
not active yet)* — so an admin never needs to know a column name to find the
right field. The payment-configuration section explicitly tells the admin
this doesn't affect live payments yet. No secret material is ever entered or
displayed anywhere in this form.

## 4. What remains intentionally unimplemented

- **Multi-Razorpay-account payment routing.** `razorpay_key_id` is stored but
  not read by `razorpay-checkout.js` or `functions/api/webhook.js`. All funds,
  including any created after this phase, still transact through the single
  existing Razorpay account exactly as before.
- **Public ranking UI.** `ranking_enabled`/`ranking_visibility` are
  configuration groundwork only; there is no leaderboard/ranking screen
  anywhere in the app yet.
- **Public fund page redesign.** `funds.html`/`script.js` were not touched.
  The new metadata is available from the API for a future public page to
  render, but nothing renders it publicly today.
- **Admin console redesign.** Only the existing Funds section of `admin.html`
  was extended; no broader redesign was in scope.

## 5. Verifying "can a future agent create a new fund without fund-specific code?"

For **data/configuration**, yes: `POST /api/funds` accepts hero image,
message, ranking groundwork, and a Razorpay key-id placeholder for any fund,
system or custom, with no per-fund branching in the handler. For **payments**,
not yet by design — that requires the routing work explicitly deferred to a
future phase (reading `razorpay_key_id` in `razorpay-checkout.js`, and a
matching server-side key-secret lookup in `webhook.js`/the Razorpay
verification path). Nothing added in this phase blocks that future work; it
was structured specifically so the next phase only has to *read* the columns
that already exist.

## 6. Related documents

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — the standing engineering
  process (tests mandatory, additive-only migrations, frozen money path).
- [`docs/testing/COVERAGE-TRACKER.md`](../testing/COVERAGE-TRACKER.md) — the
  live test-coverage backlog; the Fund Foundation phase's new tests are
  logged there.
- [`docs/development/AGENT_HANDOFFS.md`](../development/AGENT_HANDOFFS.md) —
  the running handoff log between agent sessions; see the Fund Foundation
  phase entry for exact commands run and results.
