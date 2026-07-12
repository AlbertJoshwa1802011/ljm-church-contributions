# Families & Sandha

## Why families exist as their own concept

Before this feature, `members` was a flat list of individuals with no way to represent a household. Sandha (monthly membership dues) was tracked strictly per-member, with one global amount applied to every person individually.

The church's actual practice is: Sandha is a small monthly due paid **once per family**, normally by the head of the household — not once per person living in that household. Families and Sandha were built together because that's the requirement driving the data model.

## Data model

```
families
  id, family_name, head_member_id, address, primary_phone, primary_email,
  notes, status ('active'|'archived'), created_by, created_at, updated_by, updated_at

members  (existing table, three new columns)
  ... existing columns ...
  family_id       -- NULL until grouped into a family
  relation        -- 'Head' | 'Spouse' | 'Child' | 'Parent' | 'Other'
  date_of_birth   -- optional, 'YYYY-MM-DD'

sandha_family_payments
  id, family_id, month ('YYYY-MM'), amount, paid_on, method,
  paid_by_member_id, notes, recorded_by, created_at
  UNIQUE(family_id, month)
```

**The existing `sandha_payments` table (per-member) is untouched.** This was a deliberate, non-negotiable design constraint: this is a live production database with real payment history, and there is no way to retroactively and correctly infer "which family a payment belonged to" for months before families existed as a concept. Rather than guess, the migration is purely additive:

- A member with `family_id IS NULL` is billed and tracked **exactly as before**, via `sandha_payments`.
- A member with a `family_id` set is billed and tracked **at the family level**, via `sandha_family_payments` — their own row in `sandha_payments`, if any exists from before they were grouped, is left alone as history and simply stops being added to going forward.
- `functions/api/sandha.js`'s month view (`GET /api/sandha?month=YYYY-MM`) returns `paid`/`pending` scoped to **ungrouped individuals only**, plus a separate `families: { paid, pending }` list — a family's members are never double-counted as individuals once grouped.

This means a church can migrate gradually: create families in the admin console at their own pace, and nothing breaks for members not yet grouped.

## Managing families (admin console → People → Families)

- **Create a family**: name, address, contact info, and an initial set of members (name + relation + optional email/phone/date of birth). The first member marked "Head" becomes `head_member_id`; if none is marked, the first member added becomes head by default.
- **Adding an existing member by name**: if the name you type already matches an unassigned member, they're linked to the family instead of creating a duplicate row. If the name matches someone **already in a different family**, the request is rejected — you have to remove them from their current family first. This prevents silently stealing a member from one household into another via a typo.
- **Make head**: reassigns which member Sandha is billed to.
- **Remove member**: unassigns them back to the "not yet in a family" pool — their member record and contribution history are never deleted. If the removed member was the head, the next remaining member in the family is automatically promoted to head so the family always has one (as long as it has any members left).
- **Delete family**: the family row is removed, but every member in it is unassigned (not deleted) — same non-destructive principle throughout.

## Sandha (admin console → Giving → Sandha)

The monthly amount (`config.sandha_amount`) is a single configured value — for a family, it's billed once per month per family (not multiplied by member count); for an ungrouped individual, it's billed once per month per person, same as before.

The Sandha tab shows two tables for the selected month:
- **Families** — paid/pending status, with a one-click "Mark paid" that defaults the payer to the family head (`paid_by_member_id`), overridable via the API if someone else in the family actually paid.
- **Individuals not yet in a family** — the original per-member table, unchanged.

The public `sandha.html` page mirrors this: family cards and individual cards both appear in the paid/pending grids, and a signed-in believer's personal status card (`sandhaPersonal`) automatically reflects their family's payment once they're grouped, by calling `GET /api/sandha?member=<name>` — which internally checks whether that member has a `family_id` and looks in the right table.

## API summary (`functions/api/sandha.js`, `functions/api/families.js`)

| Endpoint | Purpose | Permission |
|---|---|---|
| `GET /api/families` | List families (with nested members) + still-unassigned members | `view_members` |
| `POST /api/families` | Create a family, or `action: add_member \| set_head \| remove_member` | `manage_members` |
| `PUT /api/families` | Update family details, or a member's relation/DOB within it | `manage_members` |
| `DELETE /api/families?id=` | Delete a family (members unassigned, not deleted) | `manage_members` |
| `GET /api/sandha?month=YYYY-MM` | Month view: individuals + families, paid/pending, totals | public |
| `GET /api/sandha?member=Name` | One member's (or their family's) paid months for a year | public |
| `POST /api/sandha` | `action: mark_paid \| unmark`, with `familyId` or `memberId` | `manage_sandha` |

`manage_members` is a new permission scope (alongside the pre-existing `manage_sandha`) — granted to `super_admin` by default; assign it to a custom role via the admin Roles tab if you want someone to manage families without full fund/settings access.
