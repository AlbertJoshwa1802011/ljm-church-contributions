# Agent Handoffs

Running log of agent sessions that make non-trivial changes to this repo, in
the order they happened. Each entry uses the same format so the next agent
(human or AI) can pick up exactly where the last one left off without
re-deriving context from scratch: **STATUS, CHANGES, FILES, TESTS,
DOCUMENTATION, DISCOVERIES, REMAINING, RISKS, NEXT STEP.**

Append a new entry for each significant change; never edit or delete a prior
entry's record of what happened (append corrections as new entries instead).

---

## 2026-08-12 — Fund Foundation phase

### STATUS
**COMPLETE** for the scope defined in this phase's task brief (additive Fund
metadata: hero image, message, ranking groundwork, Razorpay public-key-id
groundwork, admin CRUD, validation, tests, documentation). Multi-Razorpay
payment routing, public ranking UI, and public fund-page redesign were
explicitly out of scope and remain unimplemented — see REMAINING.

### CHANGES
Extended the existing dynamic Fund registry (`funds` table +
`functions/api/funds.js` + the Funds section of `admin.html`) — no second Fund
system was created. Added six additive columns to `funds` (nullable/defaulted,
via a new numbered migration + the corresponding `schema.sql` update):

- `hero_image_url`, `hero_image_storage` — hero image + which storage backend
  holds it (`'r2' | 'base64' | 'external'`), reusing the existing
  `events.js` R2-with-base64-fallback pattern and the existing
  `EVENT_PHOTOS` binding / `/api/events/photo` endpoint under a `funds/` key
  prefix. No new binding or endpoint was introduced.
- `message` — a longer "why this fund exists" narrative, kept **separate**
  from the pre-existing `description` (which stays the short widget
  subtitle) because `description` edits are restricted to non-system funds
  by existing logic; reusing it would have meant loosening that restriction,
  which is a behavior change outside this phase's scope. `message` is new,
  so it's editable on every fund including Tech/Christmas.
- `ranking_enabled`, `ranking_visibility` — ranking **configuration
  groundwork only**. `ranking_visibility` reuses the existing `'public' |
  'members'` convention from `funds.visibility`. No public ranking UI exists.
- `razorpay_key_id` — future per-fund Razorpay **public** key id groundwork.
  `NULL` = today's single hardcoded key (unchanged behavior). Never the key
  secret; validated server-side to look like `rzp_...`, which incidentally
  also rejects a pasted secret. **Not read by any payment code** — no
  routing logic exists yet.

`functions/api/funds.js`: all six fields are readable from `GET` listing and
detail, and writable via `POST`/`PUT`, including on system funds (only the
pre-existing identity fields — name/description/visibility/status — stay
restricted there). Added validation: hero image type/length checks, a
5000-char cap on `message`, an enum check on `rankingVisibility`, and the
Razorpay key-id shape check.

`admin.html`: the Funds form is now grouped into five labeled sections (Fund
identity / Description & message / Visual — hero image / Ranking
(configuration only) / Payment configuration (groundwork — not active yet))
so an admin never needs to know a column name. A file-upload control
(FileReader → data URL, mirroring the existing Wishlist image-upload pattern)
feeds the hero image field; a "Remove hero image" action clears it. No secret
material is entered or displayed anywhere in this form.

**Explicitly not touched:** `functions/api/webhook.js`, `razorpay-checkout.js`,
`functions/api/contributions.js`, live payment routing, existing public
giving URLs, `funds.html`/`script.js` (public fund page rendering).

### FILES
```
migrations/0015_fund_foundation_metadata.sql   new — additive ALTER TABLEs
schema.sql                                      modified — funds table gets the 6 new columns
functions/api/funds.js                          modified — read/write/validate the new metadata
admin.html                                       modified — Funds form UI + wiring
tests/api/funds.test.mjs                        modified — 11 new tests
tests/frontend/fund-admin-wiring.test.mjs       new — 7 structural tests for the admin.html wiring
tests/regression/schema-contract.test.mjs       modified — new funds columns added to the REQUIRED guard
docs/testing/COVERAGE-TRACKER.md                modified — new rows checked off, Funds wiring gap closed
docs/architecture/FUND-SYSTEM-AUDIT.md          new — the audit doc this phase's brief expected to already exist
docs/development/AGENT_HANDOFFS.md              new — this file
```

### TESTS
Exact commands run, in order:

1. **Before any change:** `npm test` → `# tests 328 / # pass 328 / # fail 0`
   (matches the task brief's stated baseline exactly).
2. **After implementation:** `npm test` → `# tests 346 / # pass 346 / # fail 0`
   (328 baseline + 11 new `tests/api/funds.test.mjs` cases + 7 new
   `tests/frontend/fund-admin-wiring.test.mjs` cases = 346; no existing test
   was weakened or deleted).
3. **Mutation-testing sanity check** (CONTRIBUTING.md §5), on the Razorpay
   key-id validation guard specifically, since it's the one security-relevant
   check added (keeps a pasted secret out of fund metadata): temporarily
   changed `RAZORPAY_KEY_ID_RE` to `/.*/ ` (always match) → re-ran
   `node --test tests/api/funds.test.mjs` → 2 tests failed as expected →
   reverted the change → re-ran full `npm test` → back to 346/346. Confirms
   the guard is load-bearing, not decorative.
4. Manually verified every new element id referenced in the `admin.html` JS
   (`f_message`, `f_heroImageFile`, `f_heroImagePreview`,
   `f_heroImagePreviewContainer`, `f_removeHeroImageBtn`, `f_rankingEnabled`,
   `f_rankingVisibility`, `f_razorpayKeyId`) has exactly one matching
   `id="..."` in the markup, per CLAUDE.md's "Known pitfall" section.

New/changed Fund tests specifically verify: hero image base64-fallback +
external-URL storage paths and their validation; message length cap;
ranking-visibility enum validation; Razorpay key-id format validation
(and that it rejects non-`rzp_`-shaped input); that all Fund Foundation
metadata is editable on **system** funds (Tech Fund) while identity fields
stay blocked exactly as before; `removeHeroImage` clearing; clearing a
Razorpay key via empty string. Pre-existing Tech Fund / Christmas Fund
behavior (rename-blocked, goal-only edits, cannot be deleted, legacy
`config` key sync) is unchanged and still covered by the original test file.

### DOCUMENTATION
- Created `docs/architecture/FUND-SYSTEM-AUDIT.md` — documents the Fund
  system as it stood before this phase, what this phase added and why (with
  the specific design reasoning for each new column), what remains
  intentionally unimplemented, and how the new metadata relates to the
  future `Fund → Razorpay configuration → Contribution/payment` architecture.
- Updated `docs/testing/COVERAGE-TRACKER.md`: checked off three new rows
  under P1 — CRUD completeness, and closed the "Funds" line item in the
  admin.html wiring accepted-gaps section.
- This file (`docs/development/AGENT_HANDOFFS.md`) did not exist before this
  session; created it now per the mandatory-handoff requirement, alongside
  the architecture doc above.

### DISCOVERIES
- **The task brief's required pre-reading didn't exist.** Step 2–4 of the
  brief's "FIRST" section asked to read "the documentation index and
  mandatory agent rules that exist in this repository", plus
  `docs/development/AGENT_HANDOFFS.md` and
  `docs/architecture/FUND-SYSTEM-AUDIT.md` specifically. Neither
  `docs/development/` nor `docs/architecture/` existed anywhere in the repo
  (confirmed via `find`, and via a fresh `git fetch` of `origin/main` — not a
  stale checkout). Proceeded per the brief's own fallback instructions (read
  the real docs that do exist — `CLAUDE.md`, `CONTRIBUTING.md`,
  `docs/milestone-v2/*`, `docs/testing/COVERAGE-TRACKER.md` — and inspect the
  actual schema/migrations/`funds.js`/admin UI directly), then created both
  missing files as part of this phase's mandatory documentation output. This
  is disclosed here rather than silently treated as normal — the intent was
  to surface a process gap, not paper over it.
- **Pre-existing, unrelated bug found (not fixed — out of scope):** the
  "Archive fund" button in `admin.html` (`$("f_archiveBtn").onclick`) sends
  `PUT /api/funds` with `{ slug, action: "archive" }`, but
  `functions/api/funds.js`'s `onRequestPut` never reads `body.action` — only
  `body.status` toggles between `'active'`/`'archived'`. As written, clicking
  "Archive fund" on a non-system fund sends a body with no recognized
  editable field, so the handler returns `{ success:false, message: "No
  editable fields provided" }` instead of archiving. This predates this
  session's changes (verified by re-reading the pre-change `funds.js` and
  `admin.html`), is unrelated to the Fund Foundation metadata work, and was
  left untouched per the parallel-agent-safety instruction to keep changes
  scoped to this task. Flagging it here so it isn't rediscovered as a
  surprise; a future small fix would be to send `status: "archived"` instead
  of `action: "archive"` from the button handler (or add an `action ===
  "archive"` branch server-side).

### REMAINING
Everything explicitly out of scope for this phase, unimplemented on purpose:
- Multi-Razorpay-account payment routing (`razorpay_key_id` is stored but
  not read by `razorpay-checkout.js` or `functions/api/webhook.js`).
- Public ranking UI/leaderboard (only the enabled/visibility config exists).
- Public fund page (`funds.html`/`script.js`) redesign to actually render the
  new hero image/message.
- Broader admin console redesign.
- The pre-existing "Archive fund" button bug noted above (not part of this
  phase's scope; not touched).

### RISKS
- None identified against the live money path — `webhook.js`,
  `razorpay-checkout.js`, `contributions.js`, and the Razorpay verification
  path were not modified, and the mutation-testing check above confirms the
  one new security-relevant guard (Razorpay key-secret-shaped rejection)
  actually works.
- The new `razorpay_key_id` column is inert today by design, but a **future**
  agent wiring up real per-fund routing must remember it holds a PUBLIC key
  id only — the key secret must never be added to this table; it belongs
  server-side only, the same way the current single account's secret already
  is.
- Migration `0015_fund_foundation_metadata.sql` has not been run against the
  live production D1 database as part of this session (per the repo's
  process, migrations are dispatched manually/deliberately, not applied by
  an agent automatically). It must be applied before any admin can use the
  new fields against real data.

### NEXT STEP
1. Apply `migrations/0015_fund_foundation_metadata.sql` to production D1
   (dry-run first, per `CONTRIBUTING.md` §4) so the new admin UI fields
   actually persist against live data.
2. When ready to build public-facing Fund pages, read
   `docs/architecture/FUND-SYSTEM-AUDIT.md` §3 for the exact field names/
   shapes now available from `GET /api/funds` and `GET /api/funds?slug=X`.
3. When ready to implement multi-Razorpay routing, read
   `docs/architecture/FUND-SYSTEM-AUDIT.md` §4–5 for what's deliberately not
   done yet and why the groundwork was shaped the way it was.
4. Optionally fix the pre-existing "Archive fund" button bug noted under
   DISCOVERIES (unrelated to this phase, left untouched).
