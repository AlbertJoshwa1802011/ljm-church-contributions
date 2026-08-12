# Agent Handoffs

Log of agent sessions that performed investigation or milestone-scale work on this
repo, most recent first. See `CLAUDE.md` for the standing process rules this log
supports.

> **Note:** this file, `docs/development/AGENT_RULES.md`, `docs/README.md`, and
> `docs/product/`/`docs/architecture/` did not exist before the entry below. This
> repo's actual mandatory reading (per root `CLAUDE.md`) is `CONTRIBUTING.md` +
> `docs/milestone-v2/README.md`. This file is created now because the task that
> produced the first entry below explicitly required it as the standard handoff
> location; `docs/architecture/` was created for the same reason.

---

## 2026-08-12 — Public website / UX architecture audit (investigation only)

**STATUS**
Investigation complete. No application code, database, or payment functionality
was modified, per the task's explicit constraints.

**CHANGES**
None to application code, schema, or configuration. Two new documentation files
added (see FILES).

**FILES**
- Added `docs/architecture/website-ux-architecture-audit.md` — the full audit
  (current architecture, user journey, feature status matrix, hardcoded vs.
  dynamic content, information-architecture gap analysis, proposed future IA,
  admin→website flow, mobile UX, migration strategy, phased recommendations,
  risks).
- Added this file (`docs/development/AGENT_HANDOFFS.md`) — did not previously
  exist in this repo.

**TESTS**
Ran `npm test` (unmodified working tree): **328/328 passing, 0 failures, 0
skipped**. No test files were changed. Exact output captured in the audit doc's
"Testing" section.

**DOCUMENTATION**
Full findings live in `docs/architecture/website-ux-architecture-audit.md`. This
entry is a summary; that file is the source of truth. No architectural decisions
were made — three open questions are explicitly marked `DECISION REQUIRED` in
that document (Google Meet vs. YouTube link-type handling for prayer links;
whether prayer *schedules* reuse the already-planned `programs` table or need a
new one; URL migration strategy for the redesign — keep existing paths vs. new
ones needing redirects).

**DISCOVERIES**
- The requested reading list (`docs/README.md`, `docs/development/AGENT_RULES.md`,
  `docs/development/AGENT_HANDOFFS.md`, `docs/product/`, `docs/architecture/`)
  did not exist in this repo prior to this session — read `CLAUDE.md` +
  `CONTRIBUTING.md` + `docs/milestone-v2/README.md` instead, per this repo's
  actual documented process.
- **Almost the entire target ministry-platform vision is already planned**, not
  just imagined: `docs/milestone-v2/` contains all six required milestone
  documents (PRD → TRD → App Flow → UI/UX Spec → Backend Schema → Implementation
  Plan), complete, covering churches (two-church model: Church of Light + City
  Worship Center), testimonies, prayer requests, contact messages, blog,
  programs/schedule, bilingual EN/TA content, and livestream config keys. The
  milestone is stalled at **owner review of `07-ui-mockups-review.md`**
  (Home vs. "Our Giving" structural split) — implementation Phase 0 has not
  started.
- Genuine gaps that milestone-v2 does **not** yet cover: Google Meet integration
  specifically (only YouTube/generic URLs are discussed), a distinct
  *prayer-schedule* concept (recurring times like "5:00–6:00 AM") separate from
  prayer *requests*, and configurable fund ranking.
- `member.html` / `member-dashboard.js` is stale: it fetches directly from two
  hardcoded legacy Google Apps Script URLs instead of the current D1-backed
  `/api/contributions` endpoint the rest of the site uses. Flagged for whoever
  owns the parallel fund-architecture audit, since it's fund-data-display, not
  something this audit should fix.
- Admin bootstrap identities are hardcoded in two places that must be kept in
  sync manually: `functions/api/_lib.js` (`HARDCODED_SUPER_ADMINS`, the real
  server-side security boundary) and `admin-session.js` (`ADMIN_EMAILS`,
  client-side admin-bar display convenience only — not itself a security
  control).
- Zero church/branch, prayer, Google Meet, testimony, or multilingual UI
  infrastructure exists in the *live* site today — confirmed by repo-wide search,
  not assumption. The only bilingual-adjacent infrastructure live today is the
  Bible-verse dictionary schema (English KJV seeded, Tamil O.V. row present but
  marked incomplete), which is verse data, not a site-wide language switch.

**REMAINING**
Everything in `docs/architecture/website-ux-architecture-audit.md` §G/§K
(proposed future IA and phased recommendations) — not started, and per this
task's constraints, not to be started without separate authorization. Immediate
next step is a scoping decision, not code: get owner sign-off on the mockup
review doc, then resolve the three `DECISION REQUIRED` items.

**RISKS**
See the audit doc's §L in full. Headline risks: live/bookmarked URLs
(`/funds`, `/members`, `/member.html?name=...`) must be preserved or redirected
by any redesign; the giving/payment path (`webhook.js`, `contributions` table,
`razorpay-checkout.js`) must stay untouched per `CONTRIBUTING.md` §3; the
328-test suite is a real deploy gate (`needs: test` in
`.github/workflows/deploy.yml`) that any future implementation must extend, not
bypass.

**NEXT STEP**
Owner reviews `docs/milestone-v2/07-ui-mockups-review.md` and the three
`DECISION REQUIRED` items newly raised in this audit. Implementation does not
begin until that review lands, per `CLAUDE.md`'s milestone-workflow rule ("do not
begin implementation until all six documents exist and are approved") and this
task's explicit "do not implement" constraint.

---
