# Requirements — status by feature area

This is the honest, verified-against-source status of every feature area the
constitution and `docs/milestone-v2/01-PRD.md` describe. Three states:

- **Live** — shipped, working in production today.
- **Planned** — fully specified in `docs/milestone-v2/` (PRD/TRD/App
  Flow/UI-UX/Backend Schema) but not built. Don't assume it exists; don't
  rebuild the spec, read the existing one.
- **`DECISION REQUIRED`** — not specified anywhere yet; needs an owner
  decision before design or implementation.

| Feature area | Status | Detail |
|---|---|---|
| Fund contributions (giving) | **Live** | Two system funds hard-coded end-to-end; dynamic funds also supported but through a separate code path. See [`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md). |
| Razorpay payment processing | **Live, frozen** | See [`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md). Single global account; multi-account is planned-but-undecided. |
| Fund transparency (purchases/expenses) | **Live** | `impact.html` ("What We Bought"), `expenses.js` with `is_private` flag. Ranking/leaderboard visibility, donor-name visibility: not independently configurable yet — visibility today is fund-level (`public`/`members`), not per-field. |
| Members / families / subscriptions | **Live** | Members, families (household grouping), per-family and per-individual monthly dues. See `FAMILIES_AND_SUBSCRIPTIONS.md`. |
| Admin console | **Live**, gaps noted | 5 nav groups covering Overview/Giving/People/Content/Admin. See [`ADMIN_CONSOLE.md`](./ADMIN_CONSOLE.md) for the built-vs-aspirational module gap table. |
| Role-based access control | **Live** | Permission-string-based, server-enforced. See [`../architecture/PERMISSION_ARCHITECTURE.md`](../architecture/PERMISSION_ARCHITECTURE.md). |
| Audit logging | **Live, partial** | Broad coverage of admin mutations; webhook-originated contributions and sign-ins are not audited. See [`../architecture/AUDIT_ARCHITECTURE.md`](../architecture/AUDIT_ARCHITECTURE.md). |
| Events | **Live, not in admin nav** | `events.js`/`events.html`/R2 photo galleries exist and are well-tested, but the events section isn't yet wired into `admin.html`'s `NAV_GROUPS` — a known, already-documented gap (`06-implementation-plan.md` Phase 4). |
| Bible verse dictionary | **Live, partial content** | KJV: 192 curated verses seeded. TOV (Tamil): registered, **zero verses seeded** — infrastructure only, no licensed Tamil text imported yet. See `BIBLE_VERSES.md`. |
| Theming (light/dark, accent color) | **Live** | See `THEME_AND_DESIGN_SYSTEM.md`. |
| Beta/v2 rollout mechanism | **Live** | Per-user allowlist + signed cookie, restyles 5 pages. See [`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism). |
| Churches/branches (data model + UI) | **Planned** | Fully specified, `01-PRD.md` §6 / `05-backend-schema.md` §2.1. Not built. Open questions in [`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md). |
| Prayer schedules (recurring times: daily morning/night, weekly, monthly) | **`DECISION REQUIRED`** | The constitution describes configurable prayer *schedules* (recurring times per church). `01-PRD.md`/`05-backend-schema.md` specify prayer *requests* (`prayer_requests` table) but not a recurring-schedule content type — these are different features. No schedule table is planned anywhere yet. See "Prayer: two different features" below. |
| Prayer requests (submission + notification) | **Planned** | `01-PRD.md` §7.5, `05-backend-schema.md` §2.4 (`prayer_requests`, `is_private` default 1 — never public). Needs [`../architecture/NOTIFICATION_ARCHITECTURE.md`](../architecture/NOTIFICATION_ARCHITECTURE.md) (not built) to fully deliver "admin-console notification + email notification." |
| Testimonies | **Planned** | `01-PRD.md` §7.3, `05-backend-schema.md` §2.3 (moderated: pending/published/rejected, bilingual, media). |
| Media reuse / YouTube auto-embed | **Planned, undecided details** | Only outbound YouTube channel links exist today, no embedded player. `02-TRD.md` proposes embedded YouTube Live + playlist archive, URLs stored in `config`. Reusable-media-library-across-content (the constitution's requirement) has no concrete design yet — `DECISION REQUIRED` on whether this is a new `media` table or continues as ad hoc URL/base64 fields per content type (the current pattern for event photos). |
| Homepage dynamic activity feed | **Planned, under-specified** | `01-PRD.md` §7.1 describes a homepage "snapshot of what's happening" (next event/service, latest testimony, live status) — this is close to but not identical to a general chronological activity feed. If a broader feed (beyond a curated snapshot block) is wanted, that's new scope needing its own decision — don't assume the PRD already covers it. |
| Multilingual (English + Tamil) | **Planned** | `01-PRD.md` §7.13, bilingual `*_en`/`*_ta` DB columns + client-side i18n dictionary proposed in `02-TRD.md`. No `DECISION REQUIRED` items beyond what's already in the TRD — this is the most fully-specified of the unbuilt features. |
| Events with beneficiaries / good deeds | **Planned (extension)** | `05-backend-schema.md` §2.8 — additive columns on the existing `events` table (`beneficiaries_count`, `good_deed_summary_en/ta`, `church_id`). |
| Programs & schedule (service times, recurring programs) | **Planned** | `05-backend-schema.md` §2.7 (`programs` table). This may be the right home for "prayer schedules" too — see next section. |
| Blog | **Planned** | `05-backend-schema.md` §2.6. |
| Youth ministry | **Planned, deliberately unscoped** | `01-PRD.md` §7.10 explicitly says it "may reuse events/blog/programs" rather than needing its own table — don't build a dedicated `youth` table without confirming that's still the intent. |
| Contact form | **Planned** | `01-PRD.md` §7.6, `05-backend-schema.md` §2.5. Explicitly needs [`../architecture/NOTIFICATION_ARCHITECTURE.md`](../architecture/NOTIFICATION_ARCHITECTURE.md) resolved first for the acknowledgement-email requirement. |
| Payment account configuration per fund | **`DECISION REQUIRED`** | See [`../architecture/PAYMENT_ARCHITECTURE.md`](../architecture/PAYMENT_ARCHITECTURE.md#future-multi-account-support). |
| Pastor / assistant-pastor modeling per branch | **`DECISION REQUIRED`** | No table planned anywhere yet. See [`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md#open-questions-decision-required). |

## Prayer: two different features, don't conflate them

The constitution and the PRD describe two things that share a name but are
not the same feature:

1. **Prayer *requests*** — a visitor submits a request, the team is
   notified, status is tracked. This is planned and specified
   (`prayer_requests` table).
2. **Prayer *schedules*** — recurring times a church prays together (daily
   morning prayer 5–6 AM, night family prayer 9:30–10 PM, weekly prayers,
   Sunday services, monthly youth meeting, monthly full-night prayer,
   festival/special prayers), configurable per church, with title,
   description, date/time, recurrence, location, Google Meet/YouTube link,
   visibility, media, and multilingual content — per the constitution's §9.

Feature (2) has no table or endpoint planned anywhere in `docs/milestone-v2/`
today. The closest existing concept is the planned `programs` table
(`05-backend-schema.md` §2.7 — recurring programs/service schedule, per
church, with day-of-week/start-end-time/recurrence fields), which could
plausibly absorb prayer schedules rather than needing a separate table.
**`DECISION REQUIRED`**: confirm with the user whether prayer schedules are
a `programs` row type (e.g. `programs.category = 'prayer'`) or need a
dedicated `prayers` table with prayer-specific fields (Meet link,
live-link). Don't invent this silently — it changes the shape of
`05-backend-schema.md`'s already-reviewed plan.
