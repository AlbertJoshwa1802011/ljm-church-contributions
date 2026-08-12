# Admin Console

Full navigation and usage detail lives in
[`../../ADMIN_CONSOLE_GUIDE.md`](../../ADMIN_CONSOLE_GUIDE.md) — this
document doesn't repeat it. It gives the gap between what's built and the
constitution's full target module list, and the goal that should guide
closing that gap.

## Built today (verified against `admin.html`'s `NAV_GROUPS`)

```
Overview  → Overview
Giving    → Funds, Contributions, Subscriptions, Purchases, Expenses
People    → Members, Families
Content   → Wishlist, Verses, About page
Admin     → Roles, Audit log, Settings, Beta Access, Self-test
```

Auth: Google Sign-In, validated server-side via `/api/roles`; every section
is rendered regardless of the signed-in user's actual scopes and relies on
the API layer to reject unauthorized writes (this is correct, not a gap —
see [`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md)).

## Gap against the constitution's target module list

| Target module | Status |
|---|---|
| Dashboard | ✅ Built (Overview) |
| Funds | ✅ Built |
| Contributions | ✅ Built |
| Expenses | ✅ Built |
| Families | ✅ Built |
| Roles / Permissions | ✅ Built (one combined section) |
| Audit Logs | ✅ Built |
| System Configuration | ✅ Built (Settings) — no feature-flag or livestream-URL management yet |
| Events | ⚠️ Backend + public page fully built and tested, **not yet in `NAV_GROUPS`** — a known, already-documented gap |
| Churches | ❌ Not built — depends on [`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md) |
| Users | ⚠️ No standalone module — identity is folded into Members + Roles |
| Payments | ⚠️ No standalone module — Purchases/Expenses/Contributions cover money-out and money-in separately; no unified payment-configuration view (there's only one payment config today, see [`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md)) |
| Prayers | ❌ Not built |
| Testimonies | ❌ Not built |
| Prayer Requests | ❌ Not built |
| Media | ❌ Not built |
| Notifications | ❌ Not built — blocked on [`../architecture/NOTIFICATION_ARCHITECTURE.md`](../architecture/NOTIFICATION_ARCHITECTURE.md) |
| Content (broader than today's Wishlist/Verses/About) | ⚠️ Narrow scope today; Blog/Promises/Programs would extend it |

## Guiding goal

The constitution's standard for the admin console: *"administrators should
NOT need to memorize how the system works — the UI should guide them
clearly."* When adding a new module (events to nav, or any planned module
above), follow the existing accordion-sidebar/mobile-sheet pattern already
established in `admin.html` (`NAV_GROUPS` array) rather than introducing a
new navigation paradigm — one system everywhere, per the constitution's
final principle.
