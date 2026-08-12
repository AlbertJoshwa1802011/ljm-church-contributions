# Feature Index

One line per feature area: status, where its detailed docs live, and the key
source files. For the full status table with more nuance (including
`DECISION REQUIRED` items), see
[`../product/REQUIREMENTS.md`](../product/REQUIREMENTS.md) — this page is a
faster lookup, that page is the source of truth.

## Live features

| Feature | Docs | Key files |
|---|---|---|
| Fund contributions & giving | [`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md), [`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md) | `functions/api/funds.js`, `functions/api/contributions.js`, `functions/api/webhook.js`, `razorpay-checkout.js` |
| Fund transparency (purchases, expenses, wishlist) | — | `functions/api/purchases.js`, `functions/api/expenses.js`, `functions/api/wishlist.js`, `impact.html` |
| Members, families, subscriptions/dues | [`../../FAMILIES_AND_SUBSCRIPTIONS.md`](../../FAMILIES_AND_SUBSCRIPTIONS.md) | `functions/api/members.js`, `functions/api/families.js`, `functions/api/subscriptions.js` |
| Events + photo galleries | — | `functions/api/events.js`, `functions/api/events/photo.js`, `events.html` |
| Roles & permissions | [`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md) | `functions/api/roles.js`, `functions/api/_lib.js` |
| Audit logging | [`../architecture/AUDIT_ARCHITECTURE.md`](../architecture/AUDIT_ARCHITECTURE.md) | `functions/api/logs.js`, `_lib.js#audit()` |
| Bible verse dictionary | [`../../BIBLE_VERSES.md`](../../BIBLE_VERSES.md) | `functions/api/bible.js` |
| Theming / appearance | [`../../THEME_AND_DESIGN_SYSTEM.md`](../../THEME_AND_DESIGN_SYSTEM.md) | `theme.js`, `theme.css`, `functions/api/appearance.js` |
| Admin console | [`../product/ADMIN_CONSOLE.md`](../product/ADMIN_CONSOLE.md), [`../../ADMIN_CONSOLE_GUIDE.md`](../../ADMIN_CONSOLE_GUIDE.md) | `admin.html` |
| v2 beta flow | [`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism) | `functions/_middleware.js`, `functions/api/_beta.js`, `v2/` |
| Self-test / data-integrity verification | — | `functions/api/selftest.js`, `functions/api/verify.js` |

## Planned (specified in `docs/milestone-v2/`, not built)

| Feature | Spec location |
|---|---|
| Churches/branches | `../architecture/CHURCH_ARCHITECTURE.md`, `docs/milestone-v2/05-backend-schema.md` §2.1 |
| Promises / daily inspiration | `docs/milestone-v2/05-backend-schema.md` §2.2 |
| Testimonies & miracles | `docs/milestone-v2/05-backend-schema.md` §2.3 |
| Prayer requests | `docs/milestone-v2/05-backend-schema.md` §2.4 |
| Contact messages | `docs/milestone-v2/05-backend-schema.md` §2.5 |
| Blog | `docs/milestone-v2/05-backend-schema.md` §2.6 |
| Programs & schedule | `docs/milestone-v2/05-backend-schema.md` §2.7 |
| Multilingual (English + Tamil) | `docs/milestone-v2/01-PRD.md` §7.13 |
| Notifications (email) | `../architecture/NOTIFICATION_ARCHITECTURE.md` |

## Adding a new feature to this index

When a feature moves from planned to live, or a new one ships, add a row
here and update its status in
[`../product/REQUIREMENTS.md`](../product/REQUIREMENTS.md) in the same
change — per [`../development/AGENT_RULES.md`](../development/AGENT_RULES.md),
documentation is part of the implementation, not a follow-up task.
