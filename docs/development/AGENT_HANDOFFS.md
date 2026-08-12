# Agent Handoffs

Running log of agent sessions on this repo, most recent first. This file did
not exist before the entry below — created because the fund-system-audit
task required appending to it; no prior handoff format existed to follow, so
the structure below (STATUS/CHANGES/FILES/TESTS/…) is taken directly from the
task's own "mandatory handoff format" instructions.

---

## 2026-08-12 — Fund system architecture audit (investigation only)

**STATUS:** Complete. Investigation and documentation only, as scoped — no
application code, schema, or payment behavior changed.

**CHANGES:** None to application code, schema, or migrations. Two new
documentation files added:
- `docs/architecture/FUND-SYSTEM-AUDIT.md` — the full audit (sections A–J:
  current architecture, hardcoded-fund inventory, reusable components, data
  model, Razorpay architecture, dynamic-fund gap, proposed target
  architecture [marked DECISION REQUIRED], migration strategy, risks,
  recommended phased implementation plan).
- `docs/development/AGENT_HANDOFFS.md` — this file (created new).

**FILES:**
- Read (no changes): `CLAUDE.md`, `CONTRIBUTING.md`,
  `docs/milestone-v2/README.md`, `docs/runbooks/razorpay-webhook.md`,
  `docs/testing/COVERAGE-TRACKER.md`, `schema.sql`, all `migrations/*.sql`
  (headers), `functions/api/funds.js`, `functions/api/contributions.js`,
  `functions/api/webhook.js`, `functions/api/verify.js`,
  `functions/api/settings.js`, `functions/api/_lib.js`,
  `functions/api/roles.js`, `functions/api/purchases.js` (grep),
  `razorpay-checkout.js`, `script.js` (fund-routing/dashboard sections),
  `admin.html` (Funds tab + Overview KPI sections), `funds.html`,
  `wrangler.jsonc`, `tests/frontend/razorpay-fund-label.test.mjs`,
  `tests/api/funds.test.mjs` (line count / existence check).
- Created: `docs/architecture/FUND-SYSTEM-AUDIT.md`,
  `docs/development/AGENT_HANDOFFS.md`.

**TESTS:** `npm test` executed twice (before and after investigation, no
code changed between runs) — **328/328 passing** both times, matching the
expected baseline stated in the task. No test was added, removed, weakened,
or modified.

**DOCUMENTATION:** No existing documentation was found to be factually
incorrect enough to require a correction in this task (the audit notes one
minor staleness — a comment in `schema.sql` line 31 undersells that
`contributions.fund` already supports arbitrary slugs — but did not change
it, since fixing comments was not required and the task asked to prefer no
application changes). The task's own reading-list (`docs/README.md`,
`docs/development/AGENT_RULES.md`, `docs/product/`, `docs/architecture/`
[pre-existing content]) does not exist in this repo; documented as a
discrepancy in §0 of the audit rather than silently ignored.

**DISCOVERIES:**
- The repo already has a **partially-built dynamic fund registry**
  (`funds` table + `functions/api/funds.js`, added in commit `231f267`,
  "feat: dynamic funds registry, audit logs, and hardened admin APIs") with
  full CRUD, member assignment, visibility, soft delete, and an `is_system`
  flag protecting the two legacy funds. Admin UI for it already exists in
  `admin.html`'s Funds tab. This is NOT a from-scratch task — most of "admin
  creates a fund from the console" already works today for everything except
  online payments.
- The **exact, single blocker** preventing a dynamically-created fund from
  receiving real Razorpay payments: `functions/api/webhook.js` (lines 70–78)
  hardcodes fund-name normalization to exactly two output values
  (`tech-contributions` / `christmas-fund`); any other incoming fund slug is
  silently reassigned to `tech-contributions`. `razorpay-checkout.js` has the
  matching client-side hardcoding in `fundDisplayName()`. This second one is
  explicitly tested and documented as *intentional* current behavior in
  `tests/frontend/razorpay-fund-label.test.mjs` ("unknown fund falls back to
  Tech Fund, matching webhook.js") — so it's a known, deliberate legacy
  fallback, not an accidental bug.
- Manual (admin-entered) contributions already support arbitrary fund slugs
  (`functions/api/contributions.js`'s `normalizeFund()` falls through to the
  raw slug) — the manual-entry path is closer to "fund-agnostic" than the
  online-payment path.
- `script.js` has two parallel dashboard-rendering pipelines:
  `initDashboard()` (already generalized in commit `231f267` to serve
  dynamic funds via `/api/funds?slug=`) and `initChristmasFundDashboard()`
  (a fully hardcoded, hand-duplicated copy, never reused for dynamic funds).
- Razorpay integration has **no server-side order-creation step** — the
  Checkout `options` object (amount, fund, description) is built entirely
  client-side; the webhook is the only server-side point of truth. No key
  SECRET exists in the repo (only the public key ID, hardcoded, and a
  server-side webhook secret in a Cloudflare Pages env var). No table/column
  anywhere stores a Razorpay account identifier — today's single-account
  assumption is implicit in exactly 3 places (client key constant, server
  webhook secret, and the fund-normalization allowlist).
- `admin.html`'s Overview KPI tab hardcodes fetches of only the two legacy
  funds' contributions (`loadOverview()`) — dynamic-fund contributions are
  invisible to the top-level admin dashboard totals today, a real (if minor)
  reporting gap independent of the payment-routing gap.
- The repo root carries a large set of legacy Google Apps Script files
  (`payment-webhook.gs`, `unified-fund-appscript.gs`,
  `tech-fund-appscript.js`, etc.) and matching `TECH_FUND_*.md` /
  `*_SETUP*.md` docs from the pre-D1 era. Not dead code — the Google Sheets
  webhook side is still live per `docs/runbooks/razorpay-webhook.md` — but
  100% two-fund-hardcoded and worth a future cleanup pass once the Sheets
  mirror is retired or made fund-agnostic too (out of scope here).

**REMAINING:** Nothing implemented — this was investigation/documentation
only, as explicitly required by the task. See
`docs/architecture/FUND-SYSTEM-AUDIT.md` §J for the recommended phase
breakdown (8 phases, each independently assignable/testable). §G of that
document is marked **DECISION REQUIRED**: the owner/team must choose between
the two proposed multi-Razorpay-account routing designs (per-fund webhook
URL vs. try-multiple-known-secrets) before Phase 6 can be planned in detail;
Phases 1–5 and 7 don't depend on that decision and could start first.

**RISKS:** See `docs/architecture/FUND-SYSTEM-AUDIT.md` §I for the full
list (payment regression, webhook compatibility, existing bookmarked URLs,
production migration discipline, auth/authz scope separation, secret
storage). Highest-attention item for whoever picks this up next: any change
to `functions/api/webhook.js` or `razorpay-checkout.js` touches
CONTRIBUTING.md's explicitly frozen "giving/money path" and requires the
mutation-testing sanity check (CONTRIBUTING.md §5) in addition to new tests,
not just new tests alone.

**NEXT STEP:** Recommend starting with **Phase 1** (additive `funds` schema
columns: `hero_image_url`, `hero_image_storage`, `message`,
`ranking_config`, `razorpay_key_id`) and/or **Phase 7** (fix admin Overview
KPI aggregation to include dynamic funds) — both are independent of the
Razorpay multi-account decision and of each other, lowest risk, and unblock
visible progress while the owner reviews the DECISION REQUIRED items in §G
before Phases 4–6 are scoped in detail.
