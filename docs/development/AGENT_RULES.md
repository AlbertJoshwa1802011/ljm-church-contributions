# Agent Development Rules — Quality Gates

| | |
|---|---|
| **Purpose** | The mandatory quality-gate checklist for any coding agent session in this repo — what "done" has to mean before a task is reported complete or handed off. |
| **Relationship to other docs** | [`CLAUDE.md`](../../CLAUDE.md) covers repo pitfalls and the milestone-planning ritual. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) covers the baseline engineering process (tests mandatory, money path frozen, additive migrations, CI as a deploy gate). **This file does not restate either — it's the gate an agent checks itself against before calling anything finished.** Read all three before touching code. |
| **Handoffs** | Every session ends with an entry appended to [`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md) — see §11. |

---

## 1. Understand before you change

Do not edit code you haven't read. Before touching a file:

- Read the *current* implementation of the code path end to end — not just the
  diff hunk you intend to change. Trace its callers, its callees, its existing
  tests, and (if it touches persisted data) the relevant `schema.sql` tables.
- Read any existing tests for that path (`tests/api/*`, `tests/frontend/*`,
  `tests/regression/*`) — they encode intent that a docstring won't.
- Check `docs/testing/COVERAGE-TRACKER.md` for known gaps in the area, and
  `AGENT_HANDOFFS.md` + `git log --oneline -20` for in-flight or very recent
  work on the same files, per `CONTRIBUTING.md` §1.
- If you cannot explain, in a sentence or two, what the current code does and
  *why* it's structured that way, you are not ready to change it — keep
  reading first.

This is a gate, not a formality: skipping it is how a fix duplicates existing
logic, reverts an intentional workaround, or reintroduces a bug a past agent
already closed.

## 2. Feature test matrix — mandatory per feature/endpoint

`CONTRIBUTING.md` §2 requires tests for every new/changed endpoint. This
section makes the *shape* of that coverage explicit and non-optional. For
every operation you add or change, work through this matrix and be able to
say, for each row, which test (by file/name) covers it or why it doesn't
apply:

| Dimension | What it proves |
|---|---|
| **Happy path** | The feature does what it's supposed to, with valid input. |
| **Negative path** | Invalid input or invalid state is rejected cleanly (400s, not a 500 or a silent no-op). |
| **Authorization** | An unauthorized/anonymous caller is rejected (`makeContext({ authToken: null })` → `success:false`), and a caller with the wrong permission (but *some* role) is still rejected where the endpoint requires a specific scope. |
| **Regression** | Existing behavior on the touched file is unchanged — add a characterization test first if the path had none, so a future change can't silently break it. |
| **Boundary** | Edge values: empty/zero/negative amounts, max-length strings, pagination limits, empty result sets, first/last page. |
| **Persistence** | The data actually round-trips through the database correctly (correct table, correct columns, correct types) — not just that the endpoint returns 200. |
| **Error case** | Failure of an external dependency (network fetch, missing DB binding) or malformed stored data is handled, not just the clean-input path. |

A matrix row that's "not applicable" (e.g. a read-only endpoint has no
persistence-write case) is fine to skip — but say so, don't silently omit it.
Use the existing harness (`tests/helpers/mock-d1.mjs`, `freshDb()` +
`makeContext()`) — see [`TESTING.md`](../../TESTING.md).

## 3. UI verification requirement

There is no automated browser/E2E harness in this suite — `tests/frontend/*`
statically parses source, it never executes the DOM (see `CLAUDE.md`'s "Known
pitfall" section and `TESTING.md`'s "Manual UI verification"). For any
UI-affecting change (`script.js`, `*.html`, `style.css`/`theme.css`,
`admin.html`):

- **If a browser is available in your environment** (a browser subagent,
  Playwright, or manual walkthrough access): run
  `.agents/workflows/verify-portal.md`'s checklist — viewports, console
  errors, dark mode, the actual rendered feature — and record exactly what
  you checked in your handoff.
- **If no browser is available**: say so explicitly. Write
  `UI verification: NOT PERFORMED (no browser available in this environment)`
  in the handoff. **Never** describe UI work as "verified," "tested," or
  "complete" when it was only reasoned about from source, not rendered. A
  grep-based structural test (e.g. "the function is defined and called")
  proves the code doesn't have a typo'd reference — it does not prove the
  feature renders or behaves correctly on screen. Those are different claims;
  keep them distinct in your report.

## 4. Database migration verification

Per `CONTRIBUTING.md` §4, migrations are additive-only and applied manually
against production. Before considering a migration done:

- **Before choosing the next migration number, check what's already been
  claimed across every reachable branch/remote — not just local HEAD.**
  `migrations/0011_events.sql` and `migrations/0011_member_appearance.sql`
  already collide in this repo's history precisely because two branches each
  picked "the next number after local HEAD" independently. Run
  `git fetch --all`, then check migration filenames on every remote branch,
  e.g.:
  `git for-each-ref --format='%(refname)' refs/remotes | while read ref; do git ls-tree -r --name-only "$ref" -- migrations/ 2>/dev/null; done | sort -u`
  — and pick a number higher than the highest one found anywhere, not just on
  your own branch. If two branches still collide despite this (a branch you
  couldn't see), that's a merge-time renumbering job for whoever integrates
  both (see §14) — call it out explicitly rather than silently accepting the
  duplicate.
- Run it against `freshDb()`'s in-memory SQLite (or a scratch copy of
  `schema.sql`) and confirm it applies cleanly from a fresh baseline.
- Confirm it's additive: `CREATE TABLE IF NOT EXISTS` / nullable, defaulted
  `ALTER TABLE ... ADD COLUMN` only — no drop/rename/retype of anything
  existing.
- Add any new critical table/column to the `REQUIRED` map in
  `tests/regression/schema-contract.test.mjs`.
- State explicitly, in the handoff, whether the migration was actually
  **dispatched against production D1** or is still **pending human
  dispatch**. These are not the same status — "migration file written and
  tested locally" is not "production schema updated." Never conflate them.

## 5. Production verification is a distinct claim

`npm test` passing proves the change works against the in-memory SQLite mock
(`tests/helpers/mock-d1.mjs`). It does **not** prove it works against a real
Cloudflare Pages deployment and real D1. Keep three claims separate and never
collapse them into one "done":

1. **Implementation complete** — the code is written.
2. **Tests passing (offline harness)** — `npm test` is green locally.
3. **Production-verified** — actually exercised against the live deployment
   (the `functions/api/selftest.js` tab, or an explicit manual production
   check with evidence of what was checked and its result).

Do not write "verified in production," "deployed and working," or similar
unless you did #3. If you only did #1–#2, say exactly that.

## 6. Money/payment-path enhanced verification

`CONTRIBUTING.md` §3 freezes the giving/money path
(`functions/api/webhook.js`, the `contributions` table incl. `proof_id
UNIQUE`, `functions/api/contributions.js`'s read model, `razorpay-checkout.js`,
`functions/api/verify.js`, and `functions/api/purchases.js`). This is now
**technically enforced, not just written policy**:
`.github/workflows/frozen-payment-paths.yml` runs on every push/PR, diffs the
changed files against that exact list, and fails the check if any are
touched without the commit message containing
`ACKNOWLEDGED-MONEY-PATH-CHANGE`. This is a tripwire against an *accidental*
touch slipping through unnoticed — it is deliberately not an approval
workflow, and passing the CI check is not itself the verification this
section requires. Any touch to these — even one judged unavoidable, and even
one the CI check lets through — requires, beyond the standard test matrix
(§2):

- An explicit, deliberate sign-off statement in the handoff: what changed,
  why it couldn't be avoided, and what could break if it's wrong.
- Extra tests specifically targeting the money-critical invariants: paise→₹
  conversion, IST timestamps, idempotency (`proof_id UNIQUE`), fund
  attribution.
- A mutation-testing pass (§7) on every changed guard/invariant, not just the
  new happy-path test.
- An explicit list, in the handoff, of exactly which money-path files were
  touched and why — never a change to this area without that call-out.

## 7. Mutation-testing requirement

`CONTRIBUTING.md` §5 already requires this for security/money-relevant
changes; this rule makes the scope explicit: **any change to an
authorization check, permission gate, input-validation guard, or
idempotency/uniqueness guarantee** — not only the money path — needs a
mutation-testing pass before it's considered proven:

1. Temporarily break the behavior (comment out the guard, flip a condition,
   remove the validation).
2. Run the specific test file and confirm it now **fails**.
3. Revert the break.
4. Confirm `git diff` on the source file is empty and the suite is green
   again.

A test that passes today but was never shown to fail against a broken
implementation is not proven — it may be asserting nothing meaningful. State
in the handoff which guards were mutation-tested and that step 2 actually
failed as expected.

## 8. Discovery classification

Agents routinely find things while working that aren't the task they were
asked to do (a latent bug, a missing guard, a stale doc). Classify every such
discovery before reporting it, using this scale:

| Label | Meaning |
|---|---|
| **BLOCKER** | Prevents the current task from being completed or safely shipped. Must be resolved or explicitly escalated before finishing. |
| **NEW BUG** | A bug *this session's own change* introduced. Must be fixed before the task is done — never hand off a self-introduced bug as a "discovery" for someone else to close. |
| **REGRESSION** | Something that used to work and no longer does, introduced by a prior (not this session's) change. Note which commit/PR if identifiable. |
| **PRE-EXISTING BUG** | Wrong behavior that predates this session's work and isn't caused by it (e.g. the `auth.js` `.meta.changes` bug, or the admin "Archive fund" button bug, both recorded in `COVERAGE-TRACKER.md`). Fix alongside if cheap and in-scope; otherwise record it — see the rule below, this is the label that failed to reach the tracker once already. |
| **TEST GAP** | The functionality itself may be correct, but nothing proves it — a path, edge case, or invariant has no test. Distinct from a bug: don't classify "this works but is untested" as PRE-EXISTING BUG just to make it feel more urgent, and don't classify an actual wrong-behavior finding as TEST GAP to make it feel less urgent. |
| **ACCEPTED LIMITATION** | A deliberate, already-decided tradeoff — not a surprise, just a fact worth recording so nobody rediscovers it and re-litigates it (e.g. `events.js`'s untested R2 branch, already tracked in COVERAGE-TRACKER.md's "Explicitly accepted gaps"). |
| **FOLLOW-UP** | Real, actionable, in-scope-adjacent work you identified but deliberately did not do because it's outside this task's boundaries. Not urgent enough to be a BLOCKER, not wrong enough to be a bug. |
| **HIGH RISK** | Doesn't block this task, but is a real, currently-exploitable correctness/security/money-path problem. Flag prominently in the handoff; fix now if small, otherwise open a tracked item. |
| **TECH DEBT** | Works correctly today but is fragile, undocumented, or hard to extend. Record it; don't let it block the current task. |
| **INFORMATIONAL** | Worth noting for the next agent/human, not actionable on its own (e.g. "this doc didn't exist yet, so I created it"). |

**Record test-coverage-shaped discoveries in
`docs/testing/COVERAGE-TRACKER.md` in the same session that finds them — not
only in your `AGENT_HANDOFFS.md` entry.** This is a hard requirement, not a
suggestion: a real bug (the admin "Archive fund" button silently no-op'ing —
see `COVERAGE-TRACKER.md`'s "Discoveries found while closing gaps") was found
during the Fund Foundation phase and written up carefully in that session's
handoff entry, but never added to the tracker. It sat invisible for multiple
subsequent sessions, because nobody re-reads a 1000+ line handoff log before
starting work, but the tracker is exactly what §10/`CONTRIBUTING.md` §1 say
to skim first. Any discovery labeled **PRE-EXISTING BUG**, **NEW BUG**, or
**TEST GAP** above goes in `COVERAGE-TRACKER.md` (its existing "Bug found and
fixed while writing this test" entries and "Discoveries found while closing
gaps" section are the established pattern) *in addition to* your
`AGENT_HANDOFFS.md` entry, not instead of it. Everything else — classified —
goes in your `AGENT_HANDOFFS.md` entry (§11) only.

## 9. No false COMPLETE status

Never report a task, PR, or handoff as a bare `STATUS: COMPLETE`. A single
top-line `COMPLETE` with a verification caveat buried three paragraphs later
is exactly the failure this rule exists to stop — a reader who only reads the
STATUS line (which is most readers, most of the time) walks away believing
more was verified than actually was.

**The STATUS block itself must enumerate verification state per dimension —
not a single word, and not a caveat deferred to later prose.** Use this
shape, one line per dimension that applies to the task, each with its own
explicit value:

```
IMPLEMENTATION: COMPLETE / NOT COMPLETE / PARTIAL
OFFLINE TESTS: COMPLETE / NOT COMPLETE / N/A
UI VERIFICATION: PERFORMED / NOT PERFORMED (no browser available) / N/A (no UI change)
PRODUCTION VERIFICATION: PERFORMED / NOT PERFORMED
```

Rules for filling it in:

- Every line is mandatory when it applies to the change; use `N/A` (with a
  one-clause reason) only when the dimension genuinely doesn't apply —
  `UI VERIFICATION: N/A (backend-only change, no script.js/HTML touched)`,
  not `N/A` as a way to dodge an honest `NOT PERFORMED`.
- **Do not require browser verification when no browser exists in the
  environment.** `UI VERIFICATION: NOT PERFORMED (no browser available in
  this environment)` is a fully honest, acceptable status line — it is not
  the same failure as claiming verification that didn't happen. The rule
  is about truthful classification, not about manufacturing a browser.
- `PRODUCTION VERIFICATION` defaults to `NOT PERFORMED` for essentially every
  agent session — that's expected and fine. What's not fine is silently
  omitting the line, or writing `COMPLETE` where this table would have said
  `NOT PERFORMED`.
- If any line reads anything other than the fully-verified value, the
  overall session must not be summarized as "COMPLETE" without that
  qualification sitting directly next to it — never a bare `STATUS: COMPLETE`
  followed only by good news.

This block goes at the top of both the handoff entry (§11) and any PR/task
summary — not only at the bottom where it's least likely to be read. A status
that overstates what was actually checked is worse than no status at all —
it tells the next agent or the human reviewer it's safe to stop checking,
when it isn't.

## 10. Parallel-agent branch and document synchronization

Multiple agent sessions work in this repo concurrently, often without one
knowing what another just did (`CONTRIBUTING.md` §1). This failed for real:
four separate branches (`claude/lojm-website-architecture-audit-px3jzf`,
`claude/admin-overview-dynamic-funds-quatcl`,
`claude/fund-foundation-phase-bjoybm`,
`claude/agent-rules-quality-gates-mvvkd1`) were all created off the exact
same `main` commit, each unaware of the other three, because each agent's
sync step only looked at commit history reachable from its own branch — and
there was nothing to see yet, since the sibling branches hadn't merged
anywhere that history would show. **Reading `git log` alone cannot detect a
sibling branch that hasn't been merged into anything you can see — this is
a structural limitation of git, not a process mistake to "just check
harder" against.** On top of `CONTRIBUTING.md` §1:

### Pre-work synchronization step (mandatory, before editing anything)

Run all of the following before making a change, not just the ones that are
convenient:

- `git branch -a` and `git log --all --oneline -30` — surfaces any branch
  already fetched into your local clone, including remotes.
- `git fetch --all` (or `git fetch origin` if remotes aren't already wired
  up) **first**, so `git branch -a`/`git log --all` actually reflect what's
  on the remote right now, not a stale local view.
- If the environment/task description names other agent sessions, open PRs,
  or sibling branch names — check those explicitly, by name, rather than
  hoping they surface in general history. A task brief that says "three
  other agents are working on X, Y, Z" is telling you something `git log`
  cannot.
- Identify files/functions your task is likely to touch, and actively
  reason about what else in the repo is likely to overlap (e.g. a funds.js
  change is likely to collide with anything else touching `funds` schema,
  admin fund UI, or fund-related migrations) — don't wait for a merge
  conflict to discover the overlap.
- Check `docs/testing/COVERAGE-TRACKER.md` and `AGENT_HANDOFFS.md` for work
  already in flight on the area you're about to touch.

**None of this guarantees discovery of a branch nobody has advertised.** If
your task instructions don't name sibling agents/branches and nothing in the
above turns anything up, proceed — but say explicitly in your handoff that
you ran this synchronization step and what it did/didn't find, so an
integration agent later knows the check was actually performed, not skipped.

### Shared document conventions

- Shared living documents (`COVERAGE-TRACKER.md`, `AGENT_HANDOFFS.md`,
  `docs/milestone-v2/README.md`'s status tracker) are **append/edit-in-place,
  never overwrite**: add new rows/entries, check off existing ones, don't
  delete or rewrite another agent's entry to "clean up." A checked-off row or
  a past handoff entry is a historical record, not clutter.
- If your work and another in-flight branch touch the same schema/migration
  numbering or the same endpoint, resolve it the way `8d7434c` did (see `git
  log`): merge/rebase and reconcile explicitly, call it out in your commit
  message, rather than silently overwriting the other branch's work.

## 11. Mandatory final handoff

Every agent session that changes anything in this repo ends by appending an
entry to [`AGENT_HANDOFFS.md`](./AGENT_HANDOFFS.md) — not editing or replacing
a previous entry, appending a new one — containing, at minimum:

- Task/session summary, branch name, date.
- The **exact** test command(s) run (e.g. `npm test`) and the **exact**
  result (pass/fail counts, not "tests pass").
- What was explicitly **not** verified (UI, production — per §3/§5) rather
  than silently omitted.
- Any discoveries, classified per §8.
- Current status using the STATUS block from §9 — never a bare "COMPLETE" if
  any criterion above is unverified.

### Entry-heading convention (append-only, parallel-branch-safe)

The coordination mechanism itself has already suffered add/add conflicts:
four branches created off the same base commit each wrote their own version
of this file, unaware of each other (see §10, and the file's own "Note on
this file's canonical history" header — the merge that reconciled them is a
worked example of §14 below). Two rules keep that from recurring:

- **Every entry heading is uniquely identified by date *and* branch name:**
  `## <YYYY-MM-DD> — <branch-name> — <short task title>`. Two sessions
  started the same day on different branches then produce two headings that
  cannot collide, so appending both is always a clean merge — there is never
  a reason to pick one over the other. A heading with only a date is not
  enough; it's exactly what collided before.
- **Never claim an entry (or the file as a whole) is "canonical" from a
  branch that hasn't actually performed the merge.** A session that hasn't
  integrated sibling branches has no way to know it's the one that will win;
  writing "this is the canonical version" pre-emptively is precisely the
  false confidence that produced the four-way collision. "Canonical" status
  is something only an integration agent gets to declare, and only after
  actually doing the merge (§14) — every other entry just describes its own
  session's work and lets the next reader's `git log` sort out order.
- Write each entry so it stands alone: don't reference "the previous entry"
  positionally (position in the file depends on merge order, not authorship
  order — see the existing header's own disclosure of this). Reference other
  entries by their heading (date + branch + title) if you need to point at
  one.

## 12. Never merge or push another agent's branch without explicit instruction

Agents must not merge, force-push, rewrite history on, or push commits to a
branch another agent session created or owns, unless the user has explicitly
instructed that specific action for that specific branch in the current
task. Discovering another agent's in-progress branch is information to read
and work around (§10), not permission to act on it. This applies even when
merging would be "obviously" the right next step — surface it to the user
and let them decide, or wait for explicit instruction.

## 13. Test quality over test count

A rising `npm test` pass count is not, by itself, evidence of anything. Do
not report "354 → 400 tests" as if the delta proves safety — a test suite can
grow entirely through vacuous tests that exercise code without asserting
anything meaningful. This section makes explicit what §2 (test matrix) and §7
(mutation testing) already imply:

- **Assert actual values, not just absence of a crash.** `assert.ok(result)`
  or "the call didn't throw" proves far less than
  `assert.strictEqual(result.amountPaise, 50000)`. If a test would still pass
  after the handler's return value is replaced with a hardcoded stub, it
  isn't testing the handler.
- **Avoid vacuous-test anti-patterns:** asserting only `typeof x !==
  'undefined'`; a `try { ... } catch { }` that silently swallows a failure
  the test should have caught; assertions against a mock that's configured
  to always return the "correct" value regardless of what the code under
  test actually did; a test with no `assert.*` call at all past its setup.
- **New critical regression tests get a mutation-testing sanity check
  (§7's procedure) before being trusted** — this is not limited to
  money/security paths (§6/§7 already require it there); apply the same
  break-it/confirm-red/revert cycle to any new test you're relying on to
  prove a specific bug can't recur, so the test is proven to fail against
  the bug it claims to catch.
- **Keep structural and behavioral test claims distinct — never conflate
  them.** `tests/frontend/*` statically parses `script.js`/`index.html`/
  `admin.html` source (per `CLAUDE.md`'s "Known pitfall" section and §3
  above) — it proves a called function is defined, an element id referenced
  in JS exists in markup, or a render chain has the try/catch it's supposed
  to. It does **not** execute the DOM, run the JS, or prove the feature
  renders or behaves correctly on screen. `tests/api/*` and
  `tests/regression/*`, by contrast, actually execute handler logic against
  a real in-memory SQLite (`tests/helpers/mock-d1.mjs`) and are genuinely
  behavioral. When reporting coverage, say which kind a test is — "structural
  test confirms the reference isn't typo'd" is a materially weaker claim than
  "behavioral test confirms the endpoint returns the right data," and
  collapsing the two into "tested" overstates what was actually proven (see
  §3).

## 14. Integration/merge-agent completion checklist

An agent whose task is to integrate one or more finished branches (rather
than build a new feature) works through this checklist before reporting
done — this formalizes what `claude/ljm-v2-integration-audit-vsmxj3` actually
did when reconciling four independently-developed branches (see
`AGENT_HANDOFFS.md`'s 2026-08-13 entries for the worked example):

- [ ] **Verify branch ancestry** for every branch being merged — confirm the
  actual merge-base against the target branch (`git merge-base`), don't trust
  a branch's self-reported "based on main" claim.
- [ ] **Inspect all changed files** across every branch being merged (`git
  diff --stat` per branch, not just the final combined diff) — know what each
  branch touched individually before reasoning about how they combine.
- [ ] **Resolve semantic conflicts manually.** A clean `git merge` with no
  textual conflict markers does not mean the combined behavior is correct —
  two branches can each make locally-correct assumptions (e.g. differing
  schema-drift fallback tiers) that combine into a new bug neither branch's
  author could see in isolation. Reason through the combined behavior
  explicitly; don't treat "it merged cleanly" as "it's safe."
- [ ] **Run full `npm test` after all merges are combined** — not just after
  each individual branch merges in isolation.
- [ ] **Run the targeted test file(s) from every merged branch** individually
  against the final combined tree, to confirm each branch's own coverage
  still passes in the merged context, not only that the aggregate count is
  green.
- [ ] **Verify the frozen payment files** (§6) were not touched by any merged
  branch, or if one was, that it carries the enhanced verification §6
  requires and the `ACKNOWLEDGED-MONEY-PATH-CHANGE` marker the CI guard
  checks for.
- [ ] **Verify the migration list** for numbering collisions across all
  merged branches (§4) — resolve/renumber explicitly and call it out in the
  merge commit message; don't silently let a duplicate ship.
- [ ] **Verify no handoff history was lost** — every entry from every source
  branch's `AGENT_HANDOFFS.md` must survive in the merged file, in full,
  per §11's append-only convention.
- [ ] **Classify remaining risks** (§8's taxonomy) explicitly in the
  integration handoff entry — an integration is exactly the point where
  emergent risks from combining independently-correct branches become
  visible, and they must be named, not left implicit.
- [ ] **Do not declare production verification unless it was actually
  performed** (§5, §9) — a clean merge and a green `npm test` are
  implementation + offline-test verification, not production verification.
  State the STATUS block (§9) accordingly.

This checklist changes agent *process*, not application behavior — it does
not authorize an integration agent to alter the substance of what's being
merged beyond the conflict resolution the merge itself requires.
