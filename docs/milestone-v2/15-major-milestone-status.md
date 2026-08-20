# 15 · Major milestone completion status — 11-block roadmap

**Branch:** `claude/ljm-v2-major-milestone-c1cko4`
**HEAD:** `e5b6b9e`
**Base/main relationship:** fast-forward from `origin/main` (`7772abc`) onto
`origin/claude/ljm-v2-milestone-completion-p3gfo2` (`c6f47e6`), then 10 new
commits on top this session. `main` itself is unchanged — nothing has been
merged into it; this branch is still ahead-only.
**Supersedes:** `14-milestone-completion-status.md` (stale as of this
session — several of its claims, e.g. "Admin: yes" for Events, turned out
to be false against actual code; see §5).

This document follows the same structure as its predecessor: the 14
detailed PRD requirements (§7 of [`01-PRD.md`](./01-PRD.md)) mapped onto
the 11-block management roadmap.

## Status legend
✅ Done and verified this session · 🟡 Real, partial · 🔶 Scaffolded/scoped, not implemented · ⛔ Not started

| # | Block | Backend | DB | Admin | Public | i18n | Responsive | Browser-tested | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Home & Core Navigation** | ✅ | ✅ | 🟡 (Promises: full CRUD incl. edit) | ✅ real hero, promise-of-the-day, footer | ✅ hero/action-cards/transparency/footer fully wired this session | ✅ full 320–1440 matrix, real footer overflow bug fixed | ✅ E2E | ✅ 95% |
| 2 | **About, Churches & Contact** | ✅ | ✅ | 🟡 (Churches: no Tamil address/service-times fields — content gap, not functional) | ✅ | 🟡 nav/CTA wired, About page content not | ✅ | ✅ E2E | 🟡 80% |
| 3 | **Prayer & Ministry Schedules** | ✅ | ✅ (real schedule seeded) | ✅ | ✅ real Mon–Sun/monthly schedule rendered in human language | 🟡 well-wired (reference page) | ✅ | ✅ E2E | ✅ 90% |
| 4 | **Programs** | ✅ recurrence (weekly/daily/monthly-ordinal) + `meeting_url` | ✅ | ✅ full CRUD incl. edit, recurrence fields exposed, ministryArea mismatch fixed | ✅ human-readable recurrence ("Every 2nd Friday" etc.) | 🟡 (reference page) | ✅ | ✅ E2E | ✅ 90% |
| 5 | **Testimonies** | ✅ | ✅ (4 sample, 1 pending) | ✅ moderation queue, verified escaping | ✅ published-only, filters work, verified escaping | 🔶 nav only | ✅ | ✅ E2E | ✅ 85% |
| 6 | **Events & VBS** | ✅ | ✅ VBS 2026 seeded w/ real theme/venue/dates | ✅ **full admin section added this session** (was completely missing — see §5) | ✅ | ✅ i18n wired this session | ✅ | ✅ E2E + new admin round-trip spec | ✅ 90% |
| 7 | **Blog** | ✅ | ✅ (5 posts, 1 draft) | ✅ full CRUD incl. edit + Tamil fields, ministryArea mismatch fixed | ✅ list + detail | 🔶 nav only | ✅ | ✅ E2E | ✅ 85% |
| 8 | **Youth Ministry** | ✅ (`ministryArea='youth'` on blog/programs) | ✅ | — (uses Blog/Programs admin; ministryArea now normalized so posts can't silently disappear from this page) | ✅ dedicated `/v2/youth.html`, wired into every nav | ✅ nav.youth wired | ✅ | ✅ E2E | ✅ 90% |
| 9 | **Watch & Listen / Media** | ✅ | ✅ (3 media URL settings) | ✅ + RBAC scope fixed (manage_content can now write it) | ✅ + stored-XSS fix (prior session), i18n wired this session | ✅ full page i18n added this session | ✅ | ✅ **new dedicated E2E spec** (4 tests: empty state, real embeds, XSS rejection, language toggle) | ✅ 90% |
| 10 | **Giving & Transparency** | ✅ *(frozen, byte-verified unchanged — see §7)* | ✅ *(frozen)* | ✅ *(frozen)* | ✅ Give flow/Our Giving/My Giving, **our-giving.html and my-giving.html fully translated this session** | ✅ full dashboard i18n (interpolation helper added) — was the largest single content gap, now closed | ✅ | ✅ E2E (presentation-only, never touches real payment) | ✅ 90% |
| 11 | **Admin Console, i18n & Platform Quality** | ✅ | ✅ | ✅ Events section added, RBAC scope fixed, ministryArea footgun fixed | — | ✅ i18n architecture extended with `t(key,vars)` interpolation + plural helper `tn()`, 210 keys now parity-checked EN/TA | ✅ admin verified 320–1440, real footer overflow bug found+fixed at 320px | ✅ **179 E2E specs** (was 62), **412 unit/regression tests** (was 409) | ✅ 90% |

**Overall: 11/11 blocks have real, working functionality. 9 of 11 are at
≥85%. The two largest gaps closed this session were: (1) i18n coverage —
Our Giving, My Giving, Home, Events, Give Flow, and Watch & Listen were all
previously "nav only" and are now fully translated; (2) Events & VBS admin
management — the backend/DB/public page were complete, but there was
zero admin UI for it, discovered independently by this session's own audit
and confirmed by a background CRUD-audit agent.**

## 1. What this session actually did (audit-first, per the non-negotiable principle)

Per operating principle §0, this session inspected the actual repository
before writing anything: current branch (`claude/ljm-v2-major-milestone-c1cko4`,
a stale ancestor of `origin/main`), ~40 unmerged remote branches, and
`docs/milestone-v2/14-milestone-completion-status.md`'s own claims. That
audit found the prior status doc's branch reconciliation to already be
correct and independently re-derivable (see §5), so this session fast-
forwarded onto it rather than re-doing that work, then began its own
audit of the *resulting* state — which is what surfaced the Events admin
gap (14's "Admin: yes" for Events was checked against a *docs claim*, not
the actual `admin.html`, which has zero references to `/api/events`).

## 2. Fixes made this session (confirmed-real bugs, not re-reports)

| # | Finding | How found | Fix |
|---|---|---|---|
| 1 | **No admin UI existed for Events/VBS at all** | This session's own audit + independently confirmed by a background CRUD-audit agent | Added a full Ministry → Events & VBS admin section: create/edit/delete, publish/unpublish, cover-photo upload with preview, multi-file gallery upload with remove-before-save staging, per-photo removal on existing events |
| 2 | **Home page overflowed the viewport by 9px at 320px width** (real iPhone SE) | Expanding the responsive E2E matrix from 3 breakpoints to the full 320–1440 set and bisecting the DOM | `.footer-grid > div { min-width: 0 }` — the brand column's unbreakable nowrap text was forcing its 1fr track past its fair share |
| 3 | **Migration numbering collision**: `0011_events.sql` / `0011_member_appearance.sql` | Background migration-audit agent | Renumbered the later file to `0026_member_appearance.sql`; verified it still applies cleanly to a fresh DB; updated the stale CI workflow dropdown (which also hadn't been updated past 0011) |
| 4 | **`ministryArea` free-text mismatch**: an admin typing "Youth" (capitalized) saves successfully but silently never appears on `/v2/youth.html`, which does an exact-match query for `youth` | Background CRUD-audit agent | Added a `<datalist>` suggestion + explicit hint, and trim+lowercase the value on save so casing/whitespace variants self-correct |
| 5 | **RBAC scope mismatch**: `/api/settings` PUT required `manage_funds` for every key, including Watch & Listen links, pastor/About info, and verses — none of which are financial controls, unlike every other ministry section (correctly gated by `manage_content`) | Background CRUD-audit agent | Now accepts `manage_funds` (unchanged) OR `manage_content`, but financial keys (goal amounts, sandha amount) still require `manage_funds` specifically, checked per-request across a whole batch update. Mutation-tested: reverting the check fails exactly the 2 new regression tests written for it |
| 6 | i18n gap: Our Giving (~35 strings), My Giving (~20), Home hero/actions/transparency/footer, Events, Give Flow, Watch & Listen — all previously untranslated or nav-only | Tracked as known remaining work in doc 14 | Added `t(key, vars)` interpolation + `tn(key, n, vars)` plural helper to `v2/i18n.js`; translated all of the above; 210 EN/TA keys now parity-checked (verified programmatically, no key missing from either language) |

## 3. Branch reconciliation (inherited, re-verified)

Doc 14's reconciliation was independently re-derived this session (merge-base
checks against every remote branch) before trusting it — it holds up:

| Branch | Verdict | Notes |
|---|---|---|
| `claude/ljm-v2-programs-prayer-meet-fwrxn6`, `claude/ljm-v2-overnight-completion-ozbyw3` | Already merged (ancestors of current HEAD) | Recurrence engine, Youth page, hero redesign, Playwright suite |
| `claude/ljm-v2-product-completion-gtmw76` | Not merged | Standalone Promises-archive page — still real, unmerged, tracked as future work |
| `claude/ljm-v2-release-candidate-3v3663` and its ancestors (admin/agent/fund/migration-hardening, integration-audit — ~7 branches) | Not merged, confirmed out of scope | All branch from `2ff9598`, *before* the v2 ministry-content work existed at all — a separate fund/payment-hardening workstream, not a v2 continuation. Merging would reintroduce deleted v2 pages. Independently re-verified this session by checking each branch's merge-base and diff content, not just trusting the prior doc's claim |
| `claude/ljm-v2-deep-qa-hardening-vwwf1h` | Rejected (newly evaluated this session) | Branches from current HEAD with 4 bug-fix commits, but diffing showed it's an inferior/regressive variant — it strips the `/v2/` prefix from nav links (would break routing) and removes Home's schedule cards. The same underlying bugs it targets (hamburger clipping, nav/i18n gaps) were already independently fixed in the current lineage |
| ~15 other branches (résumé review, subscription admin, theme redesign, etc.) | Out of scope | Unrelated one-off tasks sharing this repo, not part of the LJM V2 milestone |

## 4. Real ministry schedules (inherited from prior session, re-verified unchanged)

`migrations/0024_seed_prayer_programs.sql` still seeds the real supplied
schedule (Daily Morning/Night Prayer via Google Meet, Sunday First/Second
Service, Full Night Prayer 2nd Friday, Youth Prayer 2nd Sunday) with
`meeting_url` deliberately `NULL` until real links are supplied. Unchanged
this session — verified still correct, not re-implemented.

## 5. Content-safety: nothing fabricated this session

No new ministry facts, dates, phone numbers, addresses, or testimonies
were invented. The Events admin UI operates on real API fields only
(`title`, `category`, `eventDate`, `location`, `description`, `status`,
`featured`, `beneficiariesCount`, church link) — no placeholder content was
seeded through it. VBS 2026's month/year remains honestly marked
unconfirmed, unchanged.

## 6. Testing

- **`npm test`: 412/412 passing** (up from 409 — 3 new regression tests for
  the RBAC fix, mutation-tested to confirm they actually guard the
  behavior).
- **`npx playwright test`: 179/179 passing** (up from 62 — see breakdown
  below), Chromium only, against a real local `wrangler pages dev` + D1.
  - Responsive matrix expanded from 3 breakpoints (390/768/1440) to the
    full 10-breakpoint set the milestone brief asks for
    (320/360/375/390/393/430/768/1024/1280/1440), across 13 pages
    (added `my-giving.html`, previously missing from coverage) — this is
    what surfaced the real footer-overflow bug (§2.2).
  - New `tests/e2e/watch.spec.js` (4 tests): empty state, real
    admin-configured YouTube/playlist embeds via the actual admin-form
    round trip, `javascript:` URL rejection, language toggle.
  - New `tests/e2e/admin-events.spec.js` (3 tests): full create → draft
    hidden from public → publish → visible with cover photo → add gallery
    photos → remove one before saving → remove an already-saved photo →
    delete removes from both admin and public page. This is a *real*
    round trip against the actual API/D1, not mocked.
  - New mobile-header/hamburger-shape and card-width assertions in
    `responsive.spec.js` (tap target sizing, brand/hamburger overlap,
    drawer width, nav-link reachability at 320px).
- **R2 event-photo coverage**: verified already comprehensive (not
  re-implemented) — `tests/api/events.test.mjs` and
  `tests/api/events-photo.test.mjs` cover base64 fallback, R2-bound
  branches (POST/PUT/DELETE with a mock bucket), MIME rejection, oversized
  rejection, allowed-type coverage, missing-object, and R2-throwing
  branches. `admin-events.spec.js` additionally exercises the base64
  fallback path through a real browser upload (no R2 binding in local
  dev, matching the honest "R2 unavailable" fallback behavior the
  milestone brief asks to verify, not fabricate).

## 7. Payment-path verification

Byte-diffed against the pre-session baseline (`2ff9598`, the last commit
that touched any of these files, predating all v2 work): `functions/api/webhook.js`,
`functions/api/verify.js`, `functions/api/contributions.js`,
`functions/api/purchases.js`, `razorpay-checkout.js`, `functions/api/_lib.js`,
`functions/api/auth.js`, `functions/api/roles.js` — **all unchanged, confirmed
via `git log` (no commits touch them since `2ff9598`) and `git diff` (empty)
before and after this session's work.**

## 8. Security review

Manual review (a background agent for this ran out of session budget
partway through and is not re-reported here as complete) covering the
highest-risk surfaces:

- **XSS**: `v2/watch.html`, `v2/testimonies.html`, `v2/blog.html`,
  `v2/events.html`, and the new Events admin table all consistently
  escape user/admin-submitted content via a local `esc()` helper before
  interpolating into `innerHTML`. No raw interpolation found in any
  surface checked.
- **Auth**: every mutating endpoint checked (`churches`, `promises`,
  `testimonies`, `prayer`, `contact`, `programs`, `blog`, `events`,
  `settings`) calls `requireAuth` with an appropriate permission; public
  POST submission endpoints (prayer/contact/testimony) correctly have no
  auth (by design — that's how the public submits) but explicitly
  whitelist fields and hardcode `status='pending'`/no status field at all,
  so a caller can't self-publish or bypass moderation.
- **RBAC scope bug found and fixed** — see §2.5.
- **File upload**: `functions/api/events.js`'s `storePhoto()` validates
  MIME type against a whitelist, decoded size against an 8MB cap, before
  either R2 or base64-in-D1 storage — confirmed via existing test
  coverage, not re-implemented.
- **SQL injection**: every D1 call reviewed uses parameterized `bind()`
  calls, no string concatenation into SQL, consistently across every file
  checked.
- **Not completed this session** (tracked as follow-up, not silently
  dropped): a from-scratch pass on `churches.js`/`promises.js` write
  handlers specifically for IDOR (the CRUD-audit agent's broader pass
  already checked these and found no issues, but that was a different
  agent with a different focus, not a dedicated security pass); rate-
  limiting on public submission endpoints (prayer/contact/testimony have
  none — a plausible spam vector, not assessed as blocking for this
  milestone).

## 9. Migration audit

Full audit completed by a background agent, findings acted on (§2.3):
additive-only compliance verified across all 26 migration files (no
`DROP`/destructive `RENAME` found anywhere), `schema.sql` parity verified
table-by-table against every v2 migration, idempotency of the two seed
migrations verified (both guard every `INSERT` and are covered by a
"applying twice doesn't duplicate" regression test), foreign-key ordering
verified safe. The one real finding (numbering collision) was fixed and
re-verified by applying schema.sql + all 26 migrations to a fresh local D1
with zero errors.

## 10. Remaining work

**P1:**
- About page content (§7.12) still hardcoded English — only nav/CTA
  wired.
- Churches/Promises admin forms are missing Tamil field inputs that the
  schema/API already support (`address_ta`, `service_times_ta`,
  `reflection_ta`) — content-completeness gap, not a functional break.
- A dedicated, from-scratch security pass on IDOR for `churches.js`/
  `promises.js` (the CRUD-audit agent checked these as a side effect of a
  different focus; worth a dedicated look).

**P2:**
- Rate-limiting for public prayer/contact/testimony submission endpoints.
- Reconsider the standalone Promises-archive page from
  `product-completion` (real, unmerged implementation exists — see §3).
- Testimonies/Blog i18n (currently nav-only, like About).

**P3 / Future:**
- Real Google Meet URLs for Daily Morning/Night Prayer — deliberately
  `NULL`/admin-configurable, needs the actual links from ministry
  leadership.
- VBS 2026 exact month/year and poster/photo assets — needs the real
  information/files from the ministry.
- `testimonies.mediaUrl` is captured by the API and stored, but never
  rendered anywhere on the public or admin side — currently inert, not a
  live vulnerability, but worth either wiring it up (with the same
  `safeUrl()`-style scheme validation `watch.html` uses) or removing the
  dead field.

## 11. Human actions required

- Real Google Meet links for the two daily prayer programs.
- VBS 2026's confirmed month/year and any real event photos.
- A decision on whether to revisit the standalone Promises-archive page.

## 12. Production status

**Not deployed.** This session made no production changes, ran no
destructive SQL against any real database, and did not push to `main` or
create a PR — per operating instructions, changes are pushed to the
designated branch only. "Production verified" claims are not made
anywhere in this document; everything above is CODE VERIFIED and LOCAL/
BROWSER VERIFIED (real `wrangler pages dev` + local D1 + real Chromium),
never PRODUCTION VERIFIED.
