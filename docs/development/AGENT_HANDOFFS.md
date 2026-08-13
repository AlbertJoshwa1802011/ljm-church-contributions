# Agent Handoffs

Running log of agent sessions that make non-trivial changes (or audits) to this
repo, in the order they happened. Each entry uses the same format so the next
agent (human or AI) can pick up exactly where the last one left off without
re-deriving context from scratch: **STATUS, BRANCH/COMMIT, CHANGES, BRANCH
AUDIT, DEPENDENCIES, CONFLICTS, PAYMENT SAFETY, TESTS, DOCUMENTATION,
DISCOVERIES, RISKS, RECOMMENDED MERGE ORDER, NEXT STEP.**

Append a new entry for each significant change or audit; never edit or delete
a prior entry's record of what happened (append corrections as new entries
instead).

> **Note on this file's own history:** three independent agent branches
> (`claude/fund-foundation-phase-bjoybm`, `claude/admin-overview-dynamic-funds-quatcl`,
> `claude/lojm-website-architecture-audit-px3jzf`) each created this exact file
> fresh, off `main`, with different opening conventions and content, because it
> did not exist on `main` when any of them started. None of the three is merged
> yet. Whichever merges to `main` first "wins" the canonical version; the other
> two will hit an add/add Git conflict on this file and need their entries
> manually appended into the surviving version rather than dropped. See the
> entry below for the full detail. This entry (on
> `claude/ljm-v2-integration-audit-vsmxj3`) is itself a fourth independent
> creation of this file for the same reason — it was audit-only work with no
> in-flight feature commit to attach the note to.

---

## 2026-08-13 — LJM V2 Integration Audit (branch/commit inventory, conflict check, no code changes)

**STATUS:** COMPLETE (audit only — no product code, schema, or payment-path changes)

**BRANCH:** `claude/ljm-v2-integration-audit-vsmxj3`
**COMMIT (base):** `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f` (= `origin/main` at audit time; this audit branch made no code changes, only this doc)

**CHANGES:** None to application code, schema, tests, or migrations. This entry
and the creation of `docs/development/AGENT_HANDOFFS.md` on this branch (which
did not exist on `main`) are the only changes.

**OBJECTIVE:** Determine how three known-completed agent branches can safely
integrate into `main`, without performing the merge, per the architect's
request. Verified everything from Git directly — did not trust any branch's
self-reported completion status.

---

### BRANCH AUDIT

All three branches are single-commit, based directly on and unmodified-since
current `main` (`2ff9598`, 2026-08-02). None has diverged from `main` in the
"behind" direction — each is exactly `main` + 1 commit.

#### 1. `claude/fund-foundation-phase-bjoybm`
- **SHA:** `8f3d2894b557c7ce9e6ecdbb562cb9921eed7c3a`
- **Based on current main:** Yes — merge-base = `2ff9598` (= main HEAD). 0 commits behind.
- **Commits unique to branch:** 1 — "Fund Foundation phase: additive metadata (hero image, message, ranking + Razorpay groundwork)"
- **Files changed (10):** `admin.html`, `docs/architecture/FUND-SYSTEM-AUDIT.md` (new),
  `docs/development/AGENT_HANDOFFS.md` (new, this branch's own version),
  `docs/testing/COVERAGE-TRACKER.md`, `functions/api/funds.js`,
  `migrations/0015_fund_foundation_metadata.sql` (new), `schema.sql`,
  `tests/api/funds.test.mjs`, `tests/frontend/fund-admin-wiring.test.mjs` (new),
  `tests/regression/schema-contract.test.mjs`.
- **Nature of change:** Adds 6 new nullable/defaulted columns to `funds`
  (`hero_image_url`, `hero_image_storage`, `message`, `ranking_enabled`,
  `ranking_visibility`, `razorpay_key_id`) via a new additive migration
  (`0015`, next free number after `0014`). Extends `funds.js` GET/POST/PUT to
  read/write the new metadata, including a hero-image store/delete path that
  reuses the existing `EVENT_PHOTOS` R2 bucket + `/api/events/photo` server
  (no new binding). `razorpay_key_id` is explicitly groundwork only — the
  migration and code comments state it is validated (must match
  `rzp_[A-Za-z0-9_]+`) and stored, but **not read by any payment code yet**;
  `razorpay-checkout.js` and `functions/api/webhook.js` are untouched.
- **Own test suite (run standalone on this branch):** 346/346 passing (328
  baseline + 18 new, in `funds.test.mjs` and new `fund-admin-wiring.test.mjs`).

#### 2. `claude/admin-overview-dynamic-funds-quatcl`
- **SHA:** `b183d89c3e52ee9aee4162551b702a76172cc36a`
- **Based on current main:** Yes — merge-base = `2ff9598` (= main HEAD). 0 commits behind.
- **Commits unique to branch:** 1 — "Make Admin Overview fund reporting dynamic across all registered funds"
- **Files changed (6):** `admin.html`, `docs/development/AGENT_HANDOFFS.md` (new,
  this branch's own version), `docs/testing/COVERAGE-TRACKER.md`,
  `functions/api/funds.js`, `tests/api/funds.test.mjs`,
  `tests/frontend/admin-overview-dynamic-funds.test.mjs` (new).
- **Nature of change:** No schema/migration change. Fixes `funds.js`'s fund
  listing and per-fund detail queries in `onRequestGet` to exclude
  soft-deleted contributions (`is_deleted = 0`) from `totalCollected`, mirroring
  the exclusion `functions/api/contributions.js` already applies to the
  legacy funds' public read model — before this fix, a fund's reported total
  could include contributions a member had soft-deleted. Wraps the query in a
  try/catch that falls back to the pre-migration-0012 query shape if
  `is_deleted` doesn't exist yet (schema-drift safety for a DB that hasn't
  had migration `0012` applied). Also updates Admin Overview UI wiring in
  `admin.html` to render all registered funds dynamically, not just the two
  legacy ones.
- **Own test suite (run standalone on this branch):** 336/336 passing (328
  baseline + 8 new, in `funds.test.mjs` and new
  `admin-overview-dynamic-funds.test.mjs`).

#### 3. `claude/lojm-website-architecture-audit-px3jzf`
- **SHA:** `845df0676814afb757168f42913e8987e9d65b81`
- **Based on current main:** Yes — merge-base = `2ff9598` (= main HEAD). 0 commits behind.
- **Commits unique to branch:** 1 — "Add public website/UX architecture audit (investigation only)"
- **Files changed (2):** `docs/architecture/website-ux-architecture-audit.md`
  (new), `docs/development/AGENT_HANDOFFS.md` (new, this branch's own version).
- **Nature of change:** Documentation only — an investigation/audit report, no
  code, schema, or test changes. Self-describes as "investigation only" in
  its commit message.
- **Own test suite (run standalone on this branch):** 328/328 passing
  (identical to baseline — no test changes, as expected for a docs-only
  branch).

---

### DEPENDENCIES

None of the three branches depends on another — each is an independent
single commit off the same `main` base. No branch requires another to be
merged first for its own code to function. Ordering below is about avoiding
avoidable conflict/rework, not a functional dependency.

---

### CONFLICTS

Checked with `git merge-tree --write-tree --merge-base=origin/main <A> <B>`
(a real 3-way merge simulation, no working-tree changes) for every pair:

| Pair | Result |
|---|---|
| `fund-foundation-phase-bjoybm` × `admin-overview-dynamic-funds-quatcl` | **3 conflicts:** `functions/api/funds.js` (content — both edit the same `onRequestGet` SELECT statement region), `tests/api/funds.test.mjs` (content — both append new test cases), `docs/development/AGENT_HANDOFFS.md` (add/add — both created this file fresh with different content). `admin.html` and `docs/testing/COVERAGE-TRACKER.md` auto-merge cleanly (touch different regions). |
| `fund-foundation-phase-bjoybm` × `lojm-website-architecture-audit-px3jzf` | **1 conflict:** `docs/development/AGENT_HANDOFFS.md` (add/add). No overlap elsewhere (`docs/architecture/*.md` filenames differ, so both land side by side without conflict). |
| `admin-overview-dynamic-funds-quatcl` × `lojm-website-architecture-audit-px3jzf` | **1 conflict:** `docs/development/AGENT_HANDOFFS.md` (add/add). No other overlap. |

**`functions/api/funds.js` conflict detail:** both `fund-foundation-phase-bjoybm`
and `admin-overview-dynamic-funds-quatcl` modify the exact same `SELECT`
statement inside `onRequestGet`'s fund-listing branch — the former inserts new
selected columns (`hero_image_url`, `message`, etc.), the latter rewrites the
query into a try/catch pair to add the `is_deleted = 0` filter with a
schema-drift fallback. Git cannot auto-resolve this; a human/agent must
manually combine both edits (add the new columns to *both* branches of the
admin-overview try/catch). The changes are not semantically contradictory —
they touch adjacent concerns (new metadata columns vs. an existing-column
filter fix) — so the merge is mechanical, not a design conflict, but it is
not something `git merge` can do unattended.

**`tests/api/funds.test.mjs` conflict detail:** both branches append new
`test()`/`describe()` blocks near the end of the same file; textual conflict
only, no logical contradiction — resolve by keeping both blocks.

**`docs/development/AGENT_HANDOFFS.md` conflict detail:** all three branches
(plus this audit branch) independently created this file because it did not
exist on `main`. Every pairwise merge is an add/add conflict. Resolution is
mechanical (concatenate entries) but must be done by hand for every pair that
merges, since Git treats "same new file, different content" as a hard
conflict, not something it can 3-way merge.

**No conflicts found** in `migrations/` (only `fund-foundation-phase-bjoybm`
adds one, numbered `0015`, next free number — no collision within these three
branches) or in `schema.sql` (only `fund-foundation-phase-bjoybm` touches it).

---

### PAYMENT SAFETY

Confirmed via `git diff --stat` against each branch for
`functions/api/webhook.js`, `razorpay-checkout.js`, and
`functions/api/contributions.js`: **zero changes** to any of the three files,
in any of the three branches. The live giving/money path is untouched by all
three. `fund-foundation-phase-bjoybm`'s `razorpay_key_id` column is stored but
not read by any payment code (confirmed by grep + diff; the migration's own
comment states this explicitly) — it is inert groundwork, not a behavior
change.

---

### CHERRY-PICK vs MERGE

Each branch is a single commit, so cherry-pick and merge produce equivalent
results here — cherry-picking does not avoid the `funds.js` /
`funds.test.mjs` / `AGENT_HANDOFFS.md` conflicts between
`fund-foundation-phase-bjoybm` and `admin-overview-dynamic-funds-quatcl`; the
same lines collide either way. **Normal merge is recommended** (not
cherry-pick) because it preserves each branch's commit identity and message
in `main`'s history, which matters for a repo already relying on `git log`
as a source of truth (per `CONTRIBUTING.md` §1's "discover in-flight work"
step) — cherry-picking would create a second, differently-SHA'd commit with
the same content, muddying that history.

---

### TESTS

- **Exact command:** `npm test` (= `node --test 'tests/**/*.test.mjs'`, per `package.json`)
- **Baseline (`main` @ `2ff9598`):** 328 tests, 328 pass, 0 fail.
- **`claude/fund-foundation-phase-bjoybm` (standalone):** 346 tests, 346 pass, 0 fail.
- **`claude/admin-overview-dynamic-funds-quatcl` (standalone):** 336 tests, 336 pass, 0 fail.
- **`claude/lojm-website-architecture-audit-px3jzf` (standalone):** 328 tests, 328 pass, 0 fail (no test changes).
- **Tests changed by this audit:** None. No test files were modified, weakened,
  or deleted as part of this audit.
- Not run: a combined/merged suite (the merge itself is explicitly out of
  scope for this audit — see CRITICAL SAFETY RULE / "Do NOT perform the
  merge" in the task brief). Once `funds.js`/`funds.test.mjs` conflicts are
  resolved by whoever performs the merge, `npm test` must be re-run on the
  merged tree before it's considered safe.

---

### DOCUMENTATION

**Inspected:** `CLAUDE.md`, `CONTRIBUTING.md`, `docs/milestone-v2/README.md`,
`docs/milestone-v2/SAFETY-AND-TESTS.md`, `docs/testing/COVERAGE-TRACKER.md`,
`docs/runbooks/razorpay-webhook.md` (listed, not read in full — out of scope
for this audit), and the full `docs/` tree via `find`.

**Requested but not present on `main`:** `docs/development/AGENT_RULES.md`,
`docs/development/AGENT_HANDOFFS.md` (prior to this entry), `docs/architecture/`
(the directory itself doesn't exist on `main` — it's created independently by
two of the three audited branches, with non-colliding filenames). These are
not contradictions of existing docs, just gaps: nothing on `main` currently
documents multi-agent branch/merge status in one place.

**Updated by this audit:** Only `docs/development/AGENT_HANDOFFS.md` (created
fresh on this branch, this entry).

**No existing documentation was found to contradict the actual repository
state** — `CLAUDE.md` and `CONTRIBUTING.md`'s descriptions of the test harness,
frozen payment path, and additive-migration rule all matched what was
verified in Git and in `npm test` output.

---

### DISCOVERIES

1. **`docs/development/AGENT_HANDOFFS.md` does not exist on `main`.** Three
   independent branches (plus this one) each created it fresh with different
   header conventions. This guarantees add/add conflicts on every merge until
   one canonical version lands and the others are manually reconciled against
   it (see CONFLICTS above). **DECISION REQUIRED:** the architect should pick
   which branch's version becomes canonical (or write a fresh canonical one)
   and instruct future agents to append to that, not recreate it.
2. **No repo-wide implementation-status tracker exists.** Neither
   `AGENT_HANDOFFS.md` (a chronological log, not a status table),
   `docs/testing/COVERAGE-TRACKER.md` (test-coverage backlog only, not
   branch/merge status), nor `docs/milestone-v2/README.md` (six-document
   planning status, not branch inventory) track, in one place: branch name,
   commit SHA, merge status, dependent branches, or known integration risks
   across the ~24 concurrent agent branches this repo currently has open. See
   the proposed structure below.
3. **21 other remote branches exist beyond the three named in this audit's
   scope** (full list: `admin-console-login-button-5p2189`,
   `admin-console-ui-design-xmsr7h`, `agent-rules-quality-gates-mvvkd1`,
   `church-admin-console-redesign-oiopko`, `church-events-feature-g2d89y`,
   `contribution-church-script-errors-hifsek`,
   `contributors-analytics-scroll-1z666j`, `dark-mode-background-ke8rya`,
   `fund-system-audit-wmn09f`, `light-do-jesus-data-bug-l3j0pa`,
   `light-jesus-ministry-prd-impczq`, `ljm-foundation-architecture-tjyzwr`,
   `manual-payment-support-check-cu524i`, `payment-audit-loj-ministry-d8hx4p`,
   `post-migration-safety-check-kf6gb4`, `resume-review-ats-924yu9`,
   `sheet-migration-contribution-sync-sdk5wx`,
   `subscription-admin-interface-z3bt3k`, `theme-color-redesign-yd16s8`, plus
   `feat/admin-dashboard` and `trae/agent-jjxOLk`). These were **not** audited
   in depth (out of this task's stated scope), but a quick migration-filename
   scan found `claude/subscription-admin-interface-z3bt3k` has its own
   `migrations/0012_families_search_index.sql` — a **different** migration
   already using number `0012` (main's `0012` is
   `0012_contribution_attribution.sql`). That branch is likely stale (based
   on an older `main` before `0012_contribution_attribution.sql` landed) and
   will need migration renumbering if it's ever integrated. Flagging as a
   **known risk** for whoever picks up that branch next — not resolved here.
4. `fund-foundation-phase-bjoybm`'s `razorpay_key_id` groundwork is a
   payment-*adjacent* schema addition (a column that will eventually feed
   payment routing) but is not itself a payment-path behavior change today —
   confirmed inert by grep across `razorpay-checkout.js` and `webhook.js`.
   Flagging explicitly since "Razorpay" in a diff warrants extra scrutiny per
   `CONTRIBUTING.md` §3, even though this specific change doesn't trip the
   frozen-path rule.

---

### RISKS

- Merging `fund-foundation-phase-bjoybm` and
  `admin-overview-dynamic-funds-quatcl` in either order requires a manual,
  non-trivial (but mechanical) conflict resolution in `functions/api/funds.js`
  — the second branch merged will need its `onRequestGet` SELECT statement
  hand-reconciled to keep both the new metadata columns and the `is_deleted`
  filter fix. Getting this wrong (dropping one side) would either silently
  drop the new Fund Foundation columns from API responses or reintroduce the
  soft-deleted-contributions-inflate-totals bug the second branch fixes.
- `npm test` has not been run against the *merged* tree (out of scope here);
  the standalone 346/336 pass counts don't guarantee the reconciled
  `funds.js`/`funds.test.mjs` will pass until that merge is actually done and
  tested.
- `docs/development/AGENT_HANDOFFS.md` will keep colliding on every future
  branch merge until the architect designates one canonical version — this
  is a process risk (agents redoing this same discovery) more than a code
  risk.
- The 21 unaudited branches are unknown quantities — several appear stale
  (based on `main` versions several migrations behind current `main`), which
  is itself a risk if anyone merges them without rebasing first.

---

### RECOMMENDED MERGE ORDER

1. **`claude/admin-overview-dynamic-funds-quatcl`** first — smaller diff, no
   schema/migration change, fixes a real data-correctness gap
   (soft-deleted contributions inflating fund totals), and its `funds.js`
   rewrite (try/catch + `is_deleted` filter) is the more invasive structural
   change to `onRequestGet`, so it's easier to layer new columns onto it
   afterward than the reverse.
2. **`claude/fund-foundation-phase-bjoybm`** second — rebase/merge onto the
   result of (1), manually reconciling the `funds.js` SELECT (keep the
   `is_deleted` filter + schema-drift fallback from (1), add the new metadata
   columns from this branch to both branches of that try/catch) and the two
   test-file additions (concatenate).
3. **`claude/lojm-website-architecture-audit-px3jzf`** anytime, independently
   — docs-only, only touches `docs/architecture/website-ux-architecture-audit.md`
   (unique filename) and `docs/development/AGENT_HANDOFFS.md` (mechanical
   add/add resolution).

For every step: re-run `npm test` on the merged tree and confirm the pass
count is at least 328 + the sum of new tests from the branches merged so far,
with 0 failures, before proceeding to the next branch.

---

### NEXT STEP

Architect (or the next agent explicitly tasked with the merge — not this
audit) should: (a) decide the canonical `docs/development/AGENT_HANDOFFS.md`
version and instruct future agents accordingly (**DECISION REQUIRED**); (b)
decide whether to create `docs/development/IMPLEMENTATION_STATUS.md` per the
proposed structure below (**DECISION REQUIRED** — not created by this audit);
(c) perform the merge in the recommended order above, resolving the
`functions/api/funds.js` / `tests/api/funds.test.mjs` /
`docs/development/AGENT_HANDOFFS.md` conflicts by hand as described, running
`npm test` after each step.

---

### Proposed structure: `docs/development/IMPLEMENTATION_STATUS.md`

No adequate single implementation-status document exists today (see
DISCOVERIES #2). Proposed structure — **not created by this audit**, pending
architect sign-off, since introducing a new cross-cutting tracking doc is a
process decision, not something an audit-only task should unilaterally
commit to:

```markdown
# Implementation Status

Single source of truth for "what branch has what, and is it safe to merge."
Complements (does not replace) `docs/development/AGENT_HANDOFFS.md` (a
chronological narrative log) and `docs/testing/COVERAGE-TRACKER.md` (test-gap
backlog). Update this file's table whenever a branch is created, completed,
or merged — don't let it go stale like a handoff doc nobody re-reads.

| Branch | Commit SHA | Based on main @ | Status | Files touched | Migration # | Overlaps with | Payment-path touch | Tests (standalone) | Merge status | Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| `claude/fund-foundation-phase-bjoybm` | `8f3d289` | `2ff9598` | Completed, audited | funds.js, admin.html, schema.sql, migrations/0015 | 0015 | admin-overview-dynamic-funds-quatcl (funds.js) | No (razorpay_key_id inert) | 346/346 | Not merged | Manual funds.js reconciliation needed |
| ... | | | | | | | | | | |

**Status values:** `Planned` / `In progress` / `Completed, unaudited` /
`Completed, audited` / `Merged` / `Abandoned`.

**Merge status values:** `Not merged` / `Merge conflict — needs manual
resolution (see AGENT_HANDOFFS.md entry <date>)` / `Merged to main @ <SHA>`.

Keep row-per-branch; append new branches as they're created (per
`CONTRIBUTING.md` §1's "discover in-flight work" step — this table should be
the second thing a new agent checks after `git log`, not something they have
to reconstruct from scratch, as this audit had to).
```

---

## 2026-08-13 (round 2) — LJM V2 Integration Audit update: 4th branch added (`claude/agent-rules-quality-gates-mvvkd1`)

**STATUS:** COMPLETE (audit only — no application code, schema, migration, or test changes)

**BRANCH:** `claude/ljm-v2-integration-audit-vsmxj3`
**COMMIT (base):** `a7cb38353d7b4db36f0930be97f77a774492dabf` (this branch's own prior audit
commit; base `main` is unchanged at `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f`
since round 1 — confirmed via `git log --oneline 2ff9598..origin/main` = empty)

**OBJECTIVE:** Same audit as the entry above, re-run to add a 4th known branch
(`claude/agent-rules-quality-gates-mvvkd1`) to the scope and re-verify the
prior three are unchanged. No merge performed.

**CURRENT MAIN SHA:** `2ff95980d98de25006c2d04c1a2084ebb1c4ea4f` (unchanged since round 1)

---

### BRANCH AUDIT

Branches 1–3 below are unchanged from the round-1 entry (same SHAs, same
merge-base, same file lists) — re-verified, not re-described in full; see the
round-1 entry above for their complete detail. Branch 4 is new to this round.

1. **`claude/fund-foundation-phase-bjoybm`** — SHA `8f3d289`. Unchanged. See round-1 entry.
2. **`claude/admin-overview-dynamic-funds-quatcl`** — SHA `b183d89`. Unchanged. See round-1 entry.
3. **`claude/agent-rules-quality-gates-mvvkd1`** *(new this round)*
   - **SHA:** `a3f30ea3022439fa0f213e77e47b64a68d234b77`
   - **Based on current main:** Yes — merge-base = `2ff9598` (= main HEAD). 0 commits behind.
   - **Commits unique to branch:** 1 — "Add mandatory agent quality-gate rules and handoff log"
   - **Purpose:** Introduces `docs/development/AGENT_RULES.md` (new) — a
     mandatory quality-gate checklist (understand-before-you-change,
     feature test matrix, UI/production-verification honesty, mutation
     testing beyond just the money path, a discovery-classification scale —
     BLOCKER/HIGH RISK/REGRESSION/PRE-EXISTING BUG/TECH DEBT/INFORMATIONAL —
     and a mandatory handoff-on-completion rule). Wires it into the existing
     process docs: `CLAUDE.md`'s "Required reading" section now points to it
     as a third mandatory read alongside `CONTRIBUTING.md`; `CONTRIBUTING.md`
     §1's "discover in-flight work" checklist gains two new steps (read
     `AGENT_RULES.md`, read `AGENT_HANDOFFS.md`) and a new §10 that points to
     `AGENT_RULES.md` as authoritative for what "done" means. Also adds a
     short "Discoveries found while closing gaps" note to
     `docs/testing/COVERAGE-TRACKER.md` referencing the new classification
     scale, and creates this branch's own version of
     `docs/development/AGENT_HANDOFFS.md` (96 lines — did not exist on `main`,
     same root cause as the other three branches).
   - **Files changed (5):** `CLAUDE.md`, `CONTRIBUTING.md`,
     `docs/development/AGENT_HANDOFFS.md` (new), `docs/development/AGENT_RULES.md`
     (new), `docs/testing/COVERAGE-TRACKER.md`.
   - **Conflicts with the other three branches:** **Only**
     `docs/development/AGENT_HANDOFFS.md` (add/add), against all three,
     verified individually with `git merge-tree --write-tree
     --merge-base=origin/main`. `docs/testing/COVERAGE-TRACKER.md` (also
     touched by `fund-foundation-phase-bjoybm` and
     `admin-overview-dynamic-funds-quatcl`) auto-merges cleanly against both —
     confirmed by the same `merge-tree` runs; the three branches' edits land
     in different sections of the file. `CLAUDE.md`/`CONTRIBUTING.md` are not
     touched by any of the other three branches, so no conflict there.
   - **Dependencies on another branch:** None — independent commit off `main`,
     same as the other three.
   - **Payment-path check:** `functions/api/webhook.js`,
     `razorpay-checkout.js`, `functions/api/contributions.js` — zero changes.
   - **Special-attention files (`schema.sql`, `admin.html`,
     `functions/api/funds.js`, `tests/api/funds.test.mjs`,
     `docs/architecture/FUND-SYSTEM-AUDIT.md`):** all untouched by this
     branch (empty `git diff --stat` confirmed for each).
   - **Own test suite (run standalone on this branch):** 328/328 passing —
     identical to baseline (docs/process-only branch, no test changes).
   - **Cherry-pick vs merge:** Merge recommended, same reasoning as round 1 —
     single commit either way, but merge preserves commit identity in
     history that `CONTRIBUTING.md` §1 (as amended by this very branch) tells
     future agents to read via `git log`.
   - **Merge recommendation:** Safe to merge into an integration branch on
     its own. The only manual step is resolving the `AGENT_HANDOFFS.md`
     add/add conflict (mechanical: concatenate) if merged after any of the
     other three; if merged **first**, there is no conflict at all since
     `AGENT_HANDOFFS.md` doesn't yet exist on `main`.
4. **`claude/lojm-website-architecture-audit-px3jzf`** — SHA `845df06`.
   Unchanged from round 1. Re-confirmed untouched on all special-attention
   files including `CLAUDE.md`/`CONTRIBUTING.md`. See round-1 entry for full
   detail.

---

### RECOMMENDED MERGE ORDER (updated for 4 branches)

1. **`claude/agent-rules-quality-gates-mvvkd1`** — merge first. It's the only
   branch of the four that touches root process docs (`CLAUDE.md`,
   `CONTRIBUTING.md`), it has zero conflicts with the other three anywhere
   except `AGENT_HANDOFFS.md`, and merging it first means its
   `AGENT_HANDOFFS.md` version becomes canonical with **no conflict at all**
   (straight add onto `main`, which doesn't have the file yet) — every
   subsequent branch's entry then gets appended into that canonical version
   instead of triggering N-way add/add resolution later. It also establishes
   `AGENT_RULES.md`'s handoff format before the other branches' entries are
   folded in, which keeps the log format consistent going forward.
2. **`claude/admin-overview-dynamic-funds-quatcl`** — smaller `funds.js`
   diff, no schema change, fixes a real data-correctness gap (soft-deleted
   contributions inflating fund totals). Same reasoning as round 1.
3. **`claude/fund-foundation-phase-bjoybm`** — merge onto the result of (2),
   manually reconciling the `functions/api/funds.js` SELECT (keep (2)'s
   `is_deleted` filter + schema-drift fallback, add this branch's new
   metadata columns to both branches of that try/catch) and concatenating
   the two `tests/api/funds.test.mjs` additions. Append its
   `AGENT_HANDOFFS.md` entry into the canonical version from step 1.
4. **`claude/lojm-website-architecture-audit-px3jzf`** — docs-only, safe
   anytime, independent of the other three. Append its `AGENT_HANDOFFS.md`
   entry into the canonical version from step 1.

At each step, re-run `npm test` on the merged tree and confirm the pass
count is at least 328 + the sum of new tests from branches merged so far,
with 0 failures, before proceeding.

---

### EXPECTED CONFLICTS (full matrix, all 6 pairs, verified via `git merge-tree`)

| Pair | Conflicts |
|---|---|
| fund-foundation × admin-overview | `functions/api/funds.js`, `tests/api/funds.test.mjs`, `docs/development/AGENT_HANDOFFS.md` |
| fund-foundation × agent-rules | `docs/development/AGENT_HANDOFFS.md` only |
| fund-foundation × lojm-audit | `docs/development/AGENT_HANDOFFS.md` only |
| admin-overview × agent-rules | `docs/development/AGENT_HANDOFFS.md` only |
| admin-overview × lojm-audit | `docs/development/AGENT_HANDOFFS.md` only |
| agent-rules × lojm-audit | `docs/development/AGENT_HANDOFFS.md` only |

`docs/development/AGENT_HANDOFFS.md` conflicts on **every** pair — all four
branches (now five, counting this audit branch) independently created it
because it doesn't exist on `main`. This is the single dominant integration
friction point across the whole branch set; everything else is either
clean or (for the two `funds.js`-touching branches) a mechanical,
well-understood two-file conflict.

---

### PAYMENT SAFETY

Re-confirmed for all four branches (including the new one):
`functions/api/webhook.js`, `razorpay-checkout.js`,
`functions/api/contributions.js` — zero changes across all four. No branch
touches payment verification, contribution creation/routing, or Razorpay
configuration/secrets.

---

### TESTS

- **Exact command:** `npm test` (= `node --test 'tests/**/*.test.mjs'`)
- **Current branch (`claude/ljm-v2-integration-audit-vsmxj3` @ `a7cb383`):** 328/328 passing.
- **`claude/agent-rules-quality-gates-mvvkd1` (standalone):** 328/328 passing (no test changes).
- Branches 1, 2, 4's standalone counts are unchanged from round 1 (346/336/328
  respectively) — not re-run this round since their SHAs didn't change.
- No tests or application code modified by this audit.

---

### DOCUMENTATION

Re-read `CLAUDE.md`, `CONTRIBUTING.md` on `main` (both still lack
`AGENT_RULES.md`/`AGENT_HANDOFFS.md` references — those only exist on the
`agent-rules-quality-gates-mvvkd1` branch, not yet on `main`). Confirmed
`docs/development/AGENT_RULES.md` and `docs/development/AGENT_HANDOFFS.md` do
**not** exist on `main` today — both are branch-only. No contradiction found
between documentation and actual repo state.

---

### NEXT ACTION FOR ARCHITECT

Same as round 1, updated: (a) decide whether
`claude/agent-rules-quality-gates-mvvkd1` merges first per the recommended
order above (**recommended**, not yet decided — DECISION REQUIRED); (b)
decide whether to create `docs/development/IMPLEMENTATION_STATUS.md` per the
structure proposed in the round-1 entry (**DECISION REQUIRED**, still not
created); (c) perform the 4-branch merge in the order above, resolving the
`AGENT_HANDOFFS.md` add/add conflict at each step (trivial concatenation) and
the `functions/api/funds.js` / `tests/api/funds.test.mjs` conflict at step 3
(mechanical, detailed in round 1's entry), running `npm test` after every
step.

---

**HANDOFF END**
