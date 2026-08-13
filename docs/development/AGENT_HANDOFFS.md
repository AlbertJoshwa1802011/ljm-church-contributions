# Agent Handoffs

| | |
|---|---|
| **Purpose** | Append-only log of agent-session handoffs: what changed, exact test results, what was and wasn't verified, and any discoveries. The mandatory final-handoff record required by [`AGENT_RULES.md`](./AGENT_RULES.md) §11. |
| **Rule** | **Append, never rewrite.** Add a new entry per session at the bottom of the log. Do not edit or delete a previous entry — it's a historical record. If a later session finds a previous entry was wrong, add a new entry correcting it; don't silently rewrite history. |
| **Before starting new work** | Skim recent entries here, `git log --oneline -20`, and `docs/testing/COVERAGE-TRACKER.md` for work already in flight (`AGENT_RULES.md` §10 / `CONTRIBUTING.md` §1). |

---

## Entry template

Copy this block for each new entry:

```markdown
## <YYYY-MM-DD> — <short task title>

- **Branch:** `<branch-name>`
- **Scope:** <one or two sentences: what this session changed and why>
- **Files changed:** <list, or "see `git diff --stat`">
- **Test command run:** `<exact command>`
- **Test result — before:** `<exact pass/fail counts>`
- **Test result — after:** `<exact pass/fail counts>`
- **UI verification:** <what was checked and how, OR explicitly
  "NOT PERFORMED (no browser available)" — never omit this line>
- **Production verification:** <what was checked against the live deployment,
  OR explicitly "NOT PERFORMED — offline tests only">
- **Discoveries:** <classified per `AGENT_RULES.md` §8: BLOCKER / HIGH RISK /
  REGRESSION / PRE-EXISTING BUG / TECH DEBT / INFORMATIONAL — or "None">
- **Status:** <explicit status per `AGENT_RULES.md` §9 — never a bare
  "COMPLETE" if anything above is unverified>
```

---

## 2026-08-13 — Strengthen agent development rules and quality gates

- **Branch:** `claude/agent-rules-quality-gates-mvvkd1`
- **Scope:** Documentation/process-only change. Added a mandatory engineering
  quality-gate section for coding agents: understand-before-change, a
  7-dimension feature test matrix (happy/negative/authorization/regression/
  boundary/persistence/error), UI-verification honesty rules, migration
  verification, the implementation-vs-tests-vs-production distinction,
  enhanced money-path verification, mutation-testing scope, discovery
  classification, a ban on false `COMPLETE` status, mandatory final handoffs,
  and parallel-agent branch/document synchronization rules (including never
  merging/pushing another agent's branch without explicit instruction). This
  is that mandatory quality-gate section, and this entry is its own required
  handoff record.
- **Files changed:**
  - `docs/development/AGENT_RULES.md` (new) — the quality-gate rules.
  - `docs/development/AGENT_HANDOFFS.md` (new, this file) — the handoff log
    and template.
  - `CLAUDE.md` — added `AGENT_RULES.md`/`AGENT_HANDOFFS.md` to required
    reading.
  - `CONTRIBUTING.md` — cross-referenced the new quality-gate file from §1
    (discover in-flight work) and added a closing section pointing to it as
    the authoritative agent-quality checklist and handoff requirement.
  - `docs/testing/COVERAGE-TRACKER.md` — added a pointer to the discovery
    classification scale (`AGENT_RULES.md` §8) next to the existing
    "Explicitly accepted gaps" section, without altering any existing rows.
  - No application code, `schema.sql`, `migrations/*`, or payment-path
    (`webhook.js`, `contributions`, `razorpay-checkout.js`) files were
    touched.
- **Test command run:** `npm test` (`node --test 'tests/**/*.test.mjs'`)
- **Test result — before:** 328 tests, 328 pass, 0 fail, 0 cancelled, 0
  skipped (baseline, confirmed clean before any doc edits).
- **Test result — after:** 328 tests, 328 pass, 0 fail, 0 cancelled, 0
  skipped — identical to baseline, as expected for a documentation-only
  change that touched no file under `functions/`, `tests/`, `schema.sql`, or
  `migrations/`.
- **UI verification:** NOT APPLICABLE — no UI-affecting file (`script.js`,
  `*.html`, `style.css`/`theme.css`) was touched by this change.
- **Production verification:** NOT PERFORMED. This task is documentation
  only; no code was deployed or changed, so there is nothing to verify
  against the live site, and no production-verification claim is made for
  this change (per `AGENT_RULES.md` §5 — passing the offline test suite is
  not, and is not being represented as, production verification).
- **Discoveries:**
  - **INFORMATIONAL** — `docs/development/AGENT_RULES.md` and
    `docs/development/AGENT_HANDOFFS.md` did not exist prior to this session,
    despite being referenced by the task that created them; they were
    created new rather than edited in place. No existing content was
    duplicated — the money-path freeze, additive-migration rule, mutation
    testing for security/money changes, and the PR checklist all continue to
    live solely in `CONTRIBUTING.md` / `SAFETY-AND-TESTS.md` /
    `.github/pull_request_template.md`, and `AGENT_RULES.md` cross-references
    them instead of restating them.
  - No BLOCKER, HIGH RISK, REGRESSION, or PRE-EXISTING BUG items were found
    while reading `CLAUDE.md`, `CONTRIBUTING.md`, `TESTING.md`,
    `docs/milestone-v2/SAFETY-AND-TESTS.md`, `docs/testing/COVERAGE-TRACKER.md`,
    `.agents/workflows/verify-portal.md`, or `.github/pull_request_template.md`.
- **Status:** IMPLEMENTATION COMPLETE — offline tests passing (unchanged
  328/328, before and after) — no code, schema, migration, or payment-path
  changes were made, so no UI or production verification applies to this
  change. Not creating a PR or merging, per task instructions.
