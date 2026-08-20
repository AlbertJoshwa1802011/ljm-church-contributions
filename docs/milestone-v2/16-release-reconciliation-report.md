# LJM V2 RELEASE RECONCILIATION REPORT

Branch: `claude/ljm-v2-release-reconciliation-800qa9`
Final HEAD at time of writing: `7b17f54`

## 1. Starting commit

`origin/main` = `7772abc7091f0461dde8447152a4f8b1c37615b8` ("Close a CONTRIBUTING.md
coverage gap: not-found edge cases for the new Ministry endpoints"). The
reconciliation branch started as an exact copy of this commit (verified
`git diff origin/main HEAD --quiet` before any work began).

## 2. Branches inspected

**Named in the brief, inspected in full:**
- `claude/ljm-v2-major-milestone-c1cko4` — 30 commits, 63 files, +4535/-598. The
  strongest branch by a wide margin; used as the reconciliation base.
- `claude/ljm-v2-milestone-completion-p3gfo2` — its tip (`c6f47e6`) is a **strict
  ancestor** of c1cko4's tip (verified via `git merge-base --is-ancestor`):
  every commit on this branch is already contained in c1cko4. No unique work.
  Dropped from consideration entirely.
- `claude/ljm-v2-backend-security-jzeovu` — 1 commit (`4d8c2de`), 4 files,
  +212/-3. theme.js production-write-hazard fix + Watch & Listen XSS fix +
  2 regression tests. Not on the c1cko4 line (sibling of origin/main).
- `claude/ljm-v2-full-system-qa-utsj26` — 1 commit, 11 files, +844/-7.
  settings.js media-URL validation, programs.html overflow guard,
  testimonies.html query-string fix, own watch.html XSS fix, docs.
- `claude/ljm-v2-agent2-qa-umyqs5` — 1 commit, 32 files, +630/-135. A
  competing programs-recurrence migration (`0023_program_week_of_month.sql`)
  and a second, smaller Playwright suite (`.spec.mjs`).

**Also identified during the branch survey (`git branch -r` + diffstat
against `origin/main` for all 29 branches) but out of scope for this
milestone, documented rather than merged:**
- `claude/ljm-v2-release-candidate-3v3663`, `-migration-hardening-5s44jz`,
  `-admin-hardening-hy8x4l`, `-agent-hardening-ur0s8r`, `-fund-hardening-d6had9`,
  `-integration-audit-vsmxj3` and their ancestors
  (`admin-overview-dynamic-funds-quatcl`, `fund-foundation-phase-bjoybm`,
  `agent-rules-quality-gates-mvvkd1`, `lojm-website-architecture-audit-px3jzf`) —
  all on a **separate lineage** that forks from `2ff9598`/`de840b7`, well
  before the v2 ministry-site milestone's own fork point. This is a
  different feature track entirely (Archive Fund bug, Fund Foundation
  metadata, migration-validation tooling, agent-process rules) targeting the
  legacy admin console, not the v2 public ministry site this brief scopes.
  Verified via `git merge-base --is-ancestor` that none of it overlaps with
  c1cko4. **Not merged — see §22.**
- `claude/ljm-v2-product-completion-gtmw76`, `-deep-implementation-no3jir`,
  `-bug-fixes-a8gsm2`, `-pre-release-hardening-6bjrwy`,
  `-overnight-completion-ozbyw3` (already merged into c1cko4 at `b4b5fc7`),
  `-programs-prayer-meet-fwrxn6` (already merged into c1cko4 at `f832038`),
  `-deep-qa-hardening-vwwf1h`, `-adversarial-qa-515nfy`,
  `-release-audit-al8u2p` — smaller/overlapping branches; not independently
  merged given c1cko4's superset coverage and time constraints. Flagged for
  a follow-up audit pass rather than silently dropped — see §21/§22.

## 3. Features reconciled

Events & VBS admin CRUD, programs ordinal recurrence + Google Meet, Youth
Ministry page, EN/TA i18n, Watch & Listen, checked-in Playwright E2E suite,
theme.js production-write hazard, settings media-URL validation, malformed-
JSON handling across all new endpoints. Full detail in §4.

## 4. Changes selected

| Feature | Source | Selected implementation | Reason |
|---|---|---|---|
| Events & VBS admin CRUD (create/edit/delete/publish/cover/gallery) | c1cko4 | c1cko4 (`e44a8d4`, `functions/api/events.js`, `admin.html` +445 lines) | Only branch with a complete Events & VBS admin console section; verified live via `tests/e2e/admin-events.spec.js` (138 lines, passed against real wrangler dev + D1). |
| VBS 2026 content | c1cko4 | c1cko4's `0025_v2_launch_content_seed.sql` | Honest about unresolved fields ("Exact month/year is being finalised"), real theme "Journey With Jesus" (Matt 4:19). No invented dates — verified by reading the migration directly. |
| Programs ordinal recurrence (2nd Fri / 2nd Sun) | c1cko4 vs agent2-qa-umyqs5 | c1cko4 (`month_ordinal` column + `parseMonthOrdinal` validation + bilingual `scheduleLabelEn/Ta` rendering) | Audited via background agent: c1cko4's mechanism is semantically identical to agent2-qa's `week_of_month` column but additionally has server-side validation, deterministic schedule-label rendering, and Google Meet URL support agent2-qa lacks. agent2-qa's `migrations/0023_program_week_of_month.sql` **dropped entirely** — would only add a redundant, unused column and a migration-number collision with c1cko4's own `0023_programs_online_recurrence.sql`. |
| Google Meet for prayer programs | c1cko4 | c1cko4's `meeting_url`/`meetingUrl`, https-only validated | Only implementation; agent2-qa doesn't touch this. |
| Youth Ministry page | c1cko4 | `v2/youth.html` (258 lines), wired into nav | Only branch with this page. |
| i18n (EN/TA, nav/CTA/Home/Events/Give/Watch/Our-Giving/My-Giving, interpolation) | c1cko4 | c1cko4's `v2/i18n.js` (+446 lines) + per-page translation commits | Only branch with this scope of i18n work; verified live via `tests/e2e/language.spec.js`. |
| Playwright E2E suite | c1cko4 vs agent2-qa-umyqs5 | c1cko4's suite (13 specs, `.spec.js`) kept as-is; 4 specific test cases ported in from agent2-qa's suite | Audited via background agent: c1cko4 is a strict superset in breadth (13 vs 7 specs), has the full 320–1440 breakpoint matrix (agent2-qa has none), real migration-backed seed data, and a hard network guard (`fixtures.js` intercepts any request to the production host before it leaves the browser — a true prevention, not a "fail after the fact" check). Ported in: (1) console/pageerror check across all pages, (2) draft-blocked-via-direct-slug-URL, (3) generic i18n undefined/null leak scan, (4) exhaustive beta-gated-root-path nav check. agent2-qa's own `playwright.config.js`/`fixtures.mjs`/`helpers.mjs`/`seed.sql` discarded — kept one config, no duplicate test infra. |
| theme.js production-write hazard | backend-security-jzeovu | Ported verbatim (GET/HEAD-only redirect) + its regression test | c1cko4 doesn't touch theme.js at all. Investigated first per the brief's explicit checklist (§ below) — confirmed live hazard on unmodified main, no legitimate workflow depends on writes reaching prod, GET/HEAD split is sound and closes the hole without changing the (undocumented but apparently intended) read-only preview convenience. |
| Watch & Listen XSS (client-side) | c1cko4 | c1cko4's `esc()`/`safeUrl()` in `v2/watch.html`, integrated with i18n | c1cko4's version is a superset of both backend-security-jzeovu's and full-system-qa-utsj26's independent fixes for the same bug — same escaping approach, additionally wired through the i18n render path. The other two branches' `v2/watch.html` diffs and `watch-url-xss.test.mjs` were reviewed and found redundant, not ported (avoids duplicate tests). |
| Media URL server-side validation (Watch & Listen settings) | full-system-qa-utsj26 | Ported: `MEDIA_KEYS` reject non-http(s) schemes in `functions/api/settings.js`, 3-line insert | c1cko4 was missing this defense-in-depth layer (had only the client-side fix). Ported the accompanying test. |
| Programs overflow guard | full-system-qa-utsj26 (partial) | Ported: `overflow-wrap: anywhere` on `.pg-item h4`/`p` | c1cko4 already fixed the flex `min-width:0` half via `.pg-item-main`; the QA branch's remaining fix for a pathologically long unbroken title/description was still missing. |
| testimonies.html query-string fix | — | **No change** | Audited: c1cko4's ternary already always includes a leading `?`, avoiding the `/api/testimonies&_t=...` malformed-URL bug the QA branch's fix targets. Confirmed already correct. |
| GET /api/events?id= draft visibility | c1cko4 | c1cko4's fix (`c6f47e6`) kept | See §22 for full investigation writeup — classified P0, fix confirmed correct, admin preview preserved via bearer auth. |
| Malformed JSON handling (all 9 new ministry endpoints) | New, found during this reconciliation | `try { body = await request.json() } catch { return 400 }` at all 17 call sites across churches/promises/testimonies/prayer/contact/programs/blog/events/settings | Found live via the required curl attack matrix (not in any source branch): all 9 endpoints returned 500 with the raw parser error echoed to the client on malformed JSON. `functions/api/_lib.js` (frozen) untouched — fixed locally in each handler. |

## 5. Changes rejected and why

- **agent2-qa-umyqs5's `migrations/0023_program_week_of_month.sql`** — redundant with c1cko4's `month_ordinal` mechanism, would only introduce an unused column and a migration-number collision.
- **agent2-qa-umyqs5's `playwright.config.js`/`fixtures.mjs`/`helpers.mjs`/`seed.sql`** — c1cko4's suite is the stronger, more complete one; kept a single config rather than two competing ones.
- **backend-security-jzeovu's and full-system-qa-utsj26's independent `v2/watch.html` XSS fixes and `watch-url-xss.test.mjs`** — c1cko4's own `esc()`/`safeUrl()` fix (with `tests/frontend/watch-xss-escaping.test.mjs`) already covers the same vulnerability class more completely (integrated with i18n rendering); porting the others would duplicate coverage of already-fixed code.
- **full-system-qa-utsj26's testimonies.html query-string change** — c1cko4's existing code doesn't have the bug it targets.
- **The entire "fund/admin-hardening" branch lineage** (`release-candidate-3v3663` and its ancestors) — different milestone track (legacy admin/funds features), not in scope for this v2 ministry-site reconciliation; merging it would mix two unrelated release trains. Flagged for the owner in §22, not silently discarded.

## 6. Bugs found

**P0**
- (Already fixed on c1cko4, verified not reverted) `GET /api/events?id=N` returned draft/unpublished event content to unauthenticated callers — real IDOR, ID enumeration possible. Fix (`c6f47e6`) confirmed correct and preserved.

**P1**
- theme.js: on unmodified `origin/main`, **any** local admin session's mutating (`POST`/`PUT`/`PATCH`/`DELETE`) call to `/api/*` was silently redirected to the real production Cloudflare Pages deployment, with `admin.html` alone containing ~50 such call sites across every admin panel. Live hazard on the codebase as it stood at the start of this reconciliation. **Fixed** (GET/HEAD-only redirect).
- Malformed JSON body on any of the 9 new ministry POST/PUT endpoints returned HTTP 500 with the raw JS parser error message echoed to the caller, instead of a clean 400. **Fixed** across all 17 call sites, confirmed live via curl.

**P2**
- Programs page: a pathologically long, unbroken program title/description could still force horizontal page overflow (the flex `min-width` half of the bug was already fixed in c1cko4; the `overflow-wrap` half was not). **Fixed.**
- Watch & Listen settings accepted any URL scheme server-side (client-side escaping in `v2/watch.html` was the only defense). **Fixed** with server-side `MEDIA_KEYS` scheme validation.

**P3 / P4**
- None found rising to this severity within the scope actually audited (public journeys, admin CRUD for the new ministry panels, Programs/Events/Watch/Testimonies/Blog rendering, i18n, responsive matrix). See §21 for what was **not** exhaustively audited (legacy funds/members/subscriptions panels, the separate fund-hardening branch lineage, production R2).

## 7. Security results

Ran the required curl-based attack matrix (unauthenticated GET/POST/PUT/DELETE,
IDOR, malformed JSON, boundary IDs, SQLi-shaped input, XSS/URL-scheme payloads)
against a real local `wrangler pages dev` + local D1 for `churches`, `programs`,
`events`, `blog`, `settings`, `testimonies` — **0 mismatches after fixes** (initial
run found the 2 real issues in §6, both fixed and re-verified live).

XSS sink spot-check (grep + read, not exhaustive): `v2/testimonies.html`,
`v2/blog.html`, `v2/events.html`, `v2/watch.html` — every user- or
admin-controlled field rendered into the DOM (`titleEn`, `bodyEn`,
`excerptEn`, event `title`/`description`, Watch & Listen media titles/URLs)
is passed through a local `esc()` before interpolation; the one place that
uses `.textContent` directly (`v2/events.html`'s gallery-modal title) is
inherently safe. SQL injection: D1 access throughout is via parameterized
`.bind()` calls; a `'; DROP TABLE testimonies;--`-shaped `kind` query
parameter was sent live and the table was confirmed intact afterward.

## 8. Authorization results

Grepped every `requireAuth(context, ...)` call across all 9 new ministry
endpoint files: `churches`/`promises`/`testimonies`/`prayer`/`contact`/
`programs`/`blog` consistently require `manage_content`; `events` consistently
requires `manage_events`; `settings` requires `manage_funds` with a
`manage_content` fallback for non-financial keys (verses, pastor info, Watch
& Listen links) — matching the task's explicit permission model. Live curl
matrix confirmed 401 on every unauthenticated mutation and every
admin-only listing (`?all=1`) attempted.

## 9. Admin CRUD results

Verified via the real Playwright suite against actual Chromium + wrangler
dev + local D1 (not just API calls): `admin-events.spec.js` (full
create→publish→public-visible round trip including a real file upload),
`admin-ministry.spec.js`. Not manually click-tested in this session beyond
what the E2E suite exercises: Churches/Promises/Testimonies/Prayer/Contact
moderation-only flows (covered by API-level `tests/api/*.test.mjs`, not
independently browser-driven in this pass).

## 10. Public journey results

Verified live via Playwright: Home→Prayer→Giving→Events→Blog→About→Home
navigation (`navigation.spec.js`), testimony submit→pending→moderate→publish
(`testimonies.spec.js`), Watch & Listen empty/populated/XSS states
(`watch.spec.js`), language toggle EN↔TA on 4+ pages (`language.spec.js`),
VBS/Events with photo (`admin-events.spec.js`), Programs schedule rendering
including "Second Friday"/"Second Sunday" labels (confirmed in seed-migration
test and Playwright `programs.spec.js`). Prayer-request-privacy and
Contact-authorization journeys (C/D) verified at the API/auth level (§8), not
independently re-driven through the admin UI in this pass.

## 11. Responsive matrix

Full required matrix (320/360/375/390/393/430/768/1024/1280/1440) run live
against all 13 v2 pages + admin console via `responsive.spec.js` — **all
pass**, zero horizontal overflow beyond a 2px tolerance. Additional real
narrow-width checks (hamburger visibility, tap-target size, drawer
overflow) at 320–430px also pass.

## 12. i18n results

EN/TA toggle verified live: nav labels switch and persist across reload,
`html[lang]` tracks the toggle, language selector present on every sampled
v2 page, and (added this session) a generic scan across 4 pages confirmed
no leaked `undefined`/`null`/`[object Object]` placeholders after switching
to Tamil. Scope matches the brief: nav, CTA, Home, Events, Give Flow, Watch
& Listen, Our Giving, My Giving.

## 13. Programs / recurrence results

Verified end-to-end: DB (`month_ordinal` column) → API
(`functions/api/programs.js` validates 1–5, rejects out-of-range) → seed
data (Youth Prayer = day_of_week=0/Sunday, month_ordinal=2; Full Night
Prayer = day_of_week=5/Friday, month_ordinal=2) → rendered label
("Second Sunday of every month" / "Second Friday of every month", confirmed
in `tests/regression/seed-migration.test.mjs` and live in the Prayer page's
accessibility snapshot captured during E2E debugging). Matches the required
schedule exactly. Google Meet URL field present, https-only validated,
configurable through admin with an honest empty state when unset (no
invented URLs).

## 14. Events / VBS / photos results

Verified live via `admin-events.spec.js`: create → cover photo upload →
gallery photos → publish → public event page shows title/description/photos.
R2 fallback (base64-in-D1 when no R2 binding, per `functions/api/events.js`'s
`storePhoto()`) exercised locally since this sandbox has no real R2 binding
— **production R2 was not and could not be verified** (no access); this
report makes no claim about it. VBS 2026 content confirmed honest about
unresolved dates (§4).

## 15. Database / migrations

Final migration sequence on this branch: `0002` through `0026`, strictly
sequential, no gaps, no duplicate numbers (`ls migrations/ | sort -V`
verified). agent2-qa-umyqs5's competing `0023_program_week_of_month.sql`
was never applied to this branch (dropped per §4/§5) — no collision exists
in the merged result. `tests/regression/schema-contract.test.mjs` and
`tests/regression/seed-migration.test.mjs` (idempotency + no-duplication on
double-apply) both pass. No destructive migration; all additive.

## 16. R2

Not verified against production R2 — no access from this sandbox. Local
fallback path (base64-in-D1) verified live via Playwright photo-upload
tests. See §14.

## 17. Payment-path verification

All 8 frozen files verified byte-for-byte identical to `origin/main` via
SHA256 at 5 checkpoints across this session (after the c1cko4 merge, after
each subsequent commit, and at the final HEAD): `functions/api/webhook.js`,
`functions/api/verify.js`, `functions/api/contributions.js`,
`functions/api/purchases.js`, `razorpay-checkout.js`, `functions/api/_lib.js`,
`functions/api/auth.js`, `functions/api/roles.js`. No real payments were
made; no payment code was touched at any point in this reconciliation.

## 18. Production-safety verification

theme.js investigated per the brief's explicit checklist:
- **A) Why it exists:** introduced in an earlier, undocumented commit
  (`4c3461d`) with no rationale beyond an inline comment — best guess is a
  local-preview convenience for seeing real data while iterating on static
  pages. No `wrangler.toml`/`dev` script/docs describe an intended workflow.
- **B) Which pages load it:** only the legacy/root pages (`admin.html`,
  `index.html`, `events.html`, etc.) — no `v2/*.html` page loads theme.js.
- **C) Which calls it redirects:** on unmodified main, *every* `/api/*`
  fetch call regardless of method, whenever `location.hostname` is
  localhost/127.0.0.1.
- **D) Could mutations reach production from localhost:** **yes, on
  unmodified main** — `admin.html` alone has ~50 mutating call sites across
  every admin panel, all routed through a shared `api()` helper with a real
  bearer token attached.
- **E) Legitimate live-preview dependency:** none found; only plausible use
  is read-only convenience.
- **F) Fix implemented:** scoped the redirect to GET/HEAD only (verbatim
  port of `backend-security-jzeovu`'s fix), preserving read-only preview
  while eliminating the mutation hazard.

**Hard network guard for local testing:** the Playwright suite's
`fixtures.js` intercepts (`page.route`) any request whose hostname matches
the production host **before it ever leaves the browser**, and fulfills it
from the local server instead — this is a true prevention (no request can
physically reach production, regardless of what any page's JS attempts),
which is a stronger guarantee than a "fail the test after the fact" check
and does not rely on the sandbox's network being unreachable. This was
already present in c1cko4 and was exercised (successfully) across all 195
E2E tests in this session's runs.

No production API, D1, or R2 was contacted at any point in this
reconciliation session.

## 19. Unit test result

`npm test` (`node --test 'tests/**/*.test.mjs'`): **428/428 passing**
(419 inherited from c1cko4 + 9 new malformed-JSON regression tests added
this session).

## 20. E2E result

`npx playwright test` against real Chromium + real `wrangler pages dev` +
local D1: **195/195 passing** on the final run (two intermediate runs
surfaced and fixed 3 test-authoring bugs in the E2E suite additions made
this session — a console-error false positive from intentionally-blocked
external hosts, a settings-validation/test conflict, and a
localStorage-persistence ordering bug in the new i18n leak-check test; none
were product bugs). Details of the debugging trail are in the commit
history (`221a1df`, `02bc115`).

## 21. Remaining risks

- The following source branches were surveyed (diffstat + ancestry only,
  not deep-diffed) and not independently audited for unique fixes beyond
  what c1cko4 already contains: `product-completion-gtmw76`,
  `deep-implementation-no3jir`, `bug-fixes-a8gsm2`,
  `pre-release-hardening-6bjrwy`, `deep-qa-hardening-vwwf1h`,
  `adversarial-qa-515nfy`, `release-audit-al8u2p`. Given time constraints,
  these were deprioritized because c1cko4 was already confirmed the
  strongest branch and the four branches explicitly named in the brief were
  fully reconciled; a residual risk is that one of these unaudited branches
  contains an additional fix not yet captured.
- The legacy admin panels not part of this v2 ministry milestone (Members,
  Families, Subscriptions, Expenses, Wishlist) were not re-audited in this
  session — out of scope per the brief, and untouched by any change made
  here.
- Production R2 is unverified (§16).
- Prayer-request-privacy (Journey C) and Contact-authorization (Journey D)
  were verified at the API/permission level, not independently re-driven
  through the live admin UI with a real browser click-through in this
  session.

## 22. Explicit owner decisions required

1. **The "fund/admin-hardening" branch lineage** (`release-candidate-3v3663`
   and its 6+ ancestor branches: Archive Fund bug fixes, Fund Foundation
   metadata, migration-validation tooling, agent-process rules) sits on a
   separate, older fork point and was never merged into this reconciliation.
   It may contain real fixes the owner wants in production. **Decision
   needed:** should this be reconciled as a second release train, or is it
   superseded/abandoned?
2. **`GET /api/events?id=N` draft-visibility fix** — classified P0 and kept
   as-is (requires `manage_events` auth for non-published events). No
   product-intent conflict was found (no share-by-link or unauthenticated
   preview feature depends on the old behavior), so no owner decision is
   strictly required, but flagging per the brief's instruction to surface
   any P0 security remediation explicitly.
3. **theme.js's underlying purpose** was never documented by whoever
   introduced it. The GET/HEAD-only fix preserves its apparent intent
   (read-only local preview against real data) rather than removing it
   outright. **Decision needed:** confirm this convenience is still wanted,
   or should the redirect be removed entirely in favor of seeded local
   fixtures?

## 23. Exact commits

Starting point: `origin/main` @ `7772abc7091f0461dde8447152a4f8b1c37615b8`

This branch's commits, oldest to newest:
```
19af7d4 Reconcile: integrate claude/ljm-v2-major-milestone-c1cko4 as release base
8d12917 Close three gaps c1cko4 didn't cover: theme.js prod-write hazard, media-URL scheme validation, programs overflow-wrap
d10300f Strengthen the E2E suite with 4 checks ported from claude/ljm-v2-agent2-qa-umyqs5
221a1df Fix two E2E regressions surfaced by a real Playwright run (not just static review)
02bc115 Fix test bug: language.spec.js's leak-check must reset localStorage between pages
7b17f54 Security sweep: malformed JSON now returns 400 across all 9 new ministry endpoints, not a 500 with a leaked parser error
```
(`19af7d4` is a merge commit bringing in all 30 of c1cko4's commits, from
`6662f1d` through `bcf63db` — full list in §2/§4 above and in `git log`.)

Total diff vs `origin/main`: 75 files changed, +4889/-618.

## 24. Final release recommendation

**READY FOR OWNER REVIEW**

Rationale: all automated verification gates pass (428/428 unit, 195/195 E2E
against real Chromium/wrangler/D1, frozen payment files byte-identical
throughout, no production contact, no destructive migrations, security
attack matrix clean, authorization consistent). No unresolved P0/P1 — both
found this session were fixed and re-verified live. This is short of
**READY FOR MERGE** only because of the three items in §22 that require an
explicit owner decision (most significantly, the unreconciled
fund/admin-hardening branch lineage, which may carry real fixes the owner
still wants) and the residual-risk items in §21 that a fuller pass would
close out. Not blocked on anything technical.
