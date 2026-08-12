# Data Model

Baseline schema: [`schema.sql`](../../schema.sql) (applied fresh, idempotent
via `CREATE TABLE IF NOT EXISTS`). Incremental changes:
[`migrations/`](../../migrations/), applied manually in production — see
[`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md). All rules here are additive-only
per `CONTRIBUTING.md` §4: never drop, rename, or retype an existing column or
table.

## Tables that exist today (verified against `schema.sql`)

| Table | Purpose | Key columns / notes |
|---|---|---|
| `members` | Individual believers | `name UNIQUE`, `email`, `phone`, `is_verified`, `family_id` (nullable FK, `migrations/0006`), `relation`, `date_of_birth`. **No `church_id`.** |
| `families` | Households, for per-family Subscriptions billing | `family_name`, `head_member_id`, address/contact fields, `status` |
| `contributions` | The giving ledger — **frozen, see below** | `member_name` (name-keyed, not FK), `amount`, `date`, `category`, `proof_id UNIQUE` (idempotency), `fund`, `created_by`/`updated_by`, `is_deleted`/`deleted_at` (soft delete) |
| `funds` | Dynamic fund registry | `slug UNIQUE`, `name`, `goal_amount`, `status` (`active`\|`archived`\|`deleted`), `visibility` (`public`\|`members`), `is_system` (1 = `tech-contributions`/`christmas-fund`, cannot be renamed/deleted via API) |
| `fund_members` | Members-only fund assignment | Composite PK `(fund_id, member_id)` |
| `purchases` | "What We Bought" public ledger | `id TEXT PRIMARY KEY` (app-generated, e.g. `P004`), `fund_contribution`, `external_contribution`, `created_by` |
| `expenses` | General church spending | `status` (`planned`\|`paid`\|`cancelled`), `is_private` (hide from public portal), `recurring` |
| `wishlist` | Planned purchases shown publicly | `priority`, `image_url` |
| `sandha_payments` | Monthly dues, per-individual (legacy/ungrouped) | `UNIQUE(member_id, month)` |
| `sandha_family_payments` | Monthly dues, per-family | `UNIQUE(family_id, month)` |
| `roles` | Permission-scope definitions | `role_name PRIMARY KEY`, `permissions` (JSON array TEXT) |
| `member_roles` | Email → role mapping | `email PRIMARY KEY`, FK → `roles.role_name` `ON DELETE CASCADE` |
| `member_preferences` | Per-member accent-color theme, synced across devices | `email PRIMARY KEY`, `accent_light`, `accent_dark` |
| `config` | Generic key/value settings | Goals, pastor contact info, verse-of-month/year, `about_content` JSON, `force_login` flag |
| `bible_versions` | Bible translation registry | `KJV` (English, 192 seeded verses) and `TOV` (Tamil O.V., **registered with zero verses seeded** — infrastructure-only) |
| `bible_verses` | Verse text | `UNIQUE(version_code, book, chapter, verse)` |
| `activity_logs` | Audit log — admin mutations + anonymous page-view analytics | See [`AUDIT_ARCHITECTURE.md`](./AUDIT_ARCHITECTURE.md) for write coverage |
| `events` | Church events/activities | `status` (`draft`\|`published`), `featured`, `extra` (JSON, future fields). **No `church_id` yet.** |
| `event_photos` | Event photo galleries | FK → `events.id ON DELETE CASCADE` (not relied on — app deletes explicitly, see `SYSTEM_ARCHITECTURE.md`), `storage` (`r2`\|`base64`\|`external`) |
| `beta_testers` | Allowlist for the v2 beta flow | `email PRIMARY KEY`, `added_by`, `note` |

No table in this list has row-level tenant scoping. Every table is global to
the single deployed instance.

## Tables planned but not yet built

These are fully specified with SQL in `docs/milestone-v2/05-backend-schema.md`
but **do not exist in `schema.sql` or any applied migration** (confirmed by
grep — zero hits). Do not assume they exist; do not build against them
without first creating the migration.

| Table | Purpose | Defined in |
|---|---|---|
| `churches` | Church/branch registry (slug, bilingual name, `is_mother_church`, service times) | `05-backend-schema.md` §2.1 |
| `promises` | Daily/monthly/yearly inspirational content, bilingual | `05-backend-schema.md` §2.2 |
| `testimonies` | Public testimony/miracle gallery, moderated | `05-backend-schema.md` §2.3 |
| `prayer_requests` | Prayer request submissions — `is_private` defaults to 1; **never public** | `05-backend-schema.md` §2.4 |
| `contact_messages` | Contact form submissions | `05-backend-schema.md` §2.5 |
| `blog_posts` | Admin-authored articles, bilingual | `05-backend-schema.md` §2.6 |
| `programs` | Recurring programs/service schedule, per church | `05-backend-schema.md` §2.7 |
| `events.church_id` etc. | Additive columns extending the existing `events` table | `05-backend-schema.md` §2.8 |

See [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md) for the recommended build
order and how this relates to `docs/milestone-v2/06-implementation-plan.md`'s
phases.

## The frozen surface

Per `CONTRIBUTING.md` §3 and `docs/milestone-v2/SAFETY-AND-TESTS.md`, the
following **do not change behavior** without an explicit, deliberate decision
plus a mutation-testing sanity check:

- `contributions` table schema, exactly as listed above, including the
  `proof_id UNIQUE` constraint.
- `functions/api/webhook.js`'s signature verification, idempotency check, and
  member-upsert logic.
- `functions/api/contributions.js`'s public read-model response contract.
- `razorpay-checkout.js`'s client-side checkout flow.

New fund/church/content features must be **additive** relative to this
surface — a new nullable column or a new table referencing it, never a
modification to it.

## Relationships worth knowing

- `contributions.member_name` and the `members`↔`contributions` join in
  `members.js` are **string/name-keyed, not foreign-keyed** — a known
  normalization gap (see `SYSTEM_ARCHITECTURE.md`'s "Known architectural
  debt"). Any future church/multi-tenant work that touches contributions
  should account for this rather than assume clean referential integrity.
- `funds.slug` is the join key used by `contributions.fund`, `purchases.fund`,
  and `expenses.fund` — also string-keyed, not an integer FK.
- No table currently has SQLite `FOREIGN KEY` enforcement relied upon; see
  `SYSTEM_ARCHITECTURE.md`.
