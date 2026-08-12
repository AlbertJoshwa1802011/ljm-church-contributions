# Product Vision

## LJM is a ministry platform, not a fund website

Light of Jesus Ministry (LJM) is the mother/base ministry, with multiple
churches/branches under it (currently Church of Light — the mother church —
and City Worship Center; the architecture must support an arbitrary number
of future branches, see [`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md)).
Funds are one part of a broader platform — not the platform's identity.

This is not a new idea invented by this document — it's already the stated
goal of the current milestone. **`docs/milestone-v2/01-PRD.md` is the
authoritative, detailed product requirements document** for this vision;
read it in full before building anything product-facing. This document does
not repeat it — it summarizes the vision at a level durable across
milestones, and points to the PRD for detail.

> "Light of Jesus Ministry, available to the whole world — inspiring people
> daily, inviting them into worship and prayer, and earning their trust."
> — `01-PRD.md`

The public website should communicate who LJM is, what it does, and why it
exists: preaching the Gospel, reaching people with the good news of Jesus
Christ, helping the poor, its churches and pastors, prayer, events, ongoing
activities, YouTube live services, testimonies, prayer requests, fundraising
campaigns, transparent contributions and expenses, ways to participate, and
how to make contact. The homepage's core job is answering: **"What is
happening in the ministry right now?"**

Inspiration for information architecture and maturity: sites like Jesus
Calls and Jesus Redeems — for UX/product structure only. LJM does not copy
their branding, content, or identity; it keeps its own (the opened-Bible /
red-heart visual concept already in use, configurable branding for logo,
imagery, tagline, and description).

## Where the vision actually is today

Read [`REQUIREMENTS.md`](./REQUIREMENTS.md) for the honest, per-feature
status table — this section is a short summary, not a substitute for it.

The live product today is a fund-contribution portal: a public dashboard
(Tech Fund / Christmas Fund progress, member directory, "what we bought"
transparency, subscriptions/dues tracking) plus an admin console covering
funds, contributions, members, families, expenses, purchases, wishlist,
Bible verses, roles, and audit logs. A beta-gated redesign (`v2/`, live today
behind a per-user allowlist — see
[`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism))
restyles five of these existing surfaces.

None of the following — despite being fully specified in
`docs/milestone-v2/01-PRD.md` through `05-backend-schema.md` — are built
yet: churches/branches as a data concept, prayer requests, testimonies,
programs/schedule, blog, youth ministry, embedded live worship/podcast, a
promises/inspiration engine, contact-with-notification, or multilingual
(English + Tamil) content. Treat the milestone-v2 documents as the plan, not
as a description of the running system.

## Non-goals (current milestone)

Per `01-PRD.md`: full multi-currency/international payment gateways beyond
Razorpay/INR, native mobile apps, full i18n beyond English + Tamil (e.g.
Hindi), event registration, and anything not explicitly requested. Per the
constitution this foundation is built from: don't design for hypothetical
future requirements beyond what's already scoped.

## Product principles that outlive any one milestone

These apply beyond the current milestone's specific feature list — future
milestones should still hold to them:

- **Configuration over hardcoding.** Funds, churches, prayers, events,
  payment accounts, and homepage campaigns must be data-driven, never
  individually hard-coded into the frontend. The Tech Fund / Christmas Fund
  pattern was the mistake; see
  [`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md)
  for exactly how deep that mistake runs and why it hasn't been unwound yet.
- **Transparency is core, not a feature.** A visitor should be able to see
  where money goes — collected amount, target, progress, and (where
  configured) expenses/purchases — without needing an account. Donor
  identity and fund rankings are never assumed public; visibility is always
  admin-configured.
- **Church selection is optional, not a gate.** A visitor browsing the
  public homepage should never be forced to pick a branch first to
  understand what's happening; branch/location is surfaced per-item where
  relevant instead.
- **The giving/money path is protected above all else.** Every other
  principle here yields to `CONTRIBUTING.md`'s frozen-path rule when they'd
  conflict.
