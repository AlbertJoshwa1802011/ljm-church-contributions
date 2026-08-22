# 14 · Milestone completion status — 11-block roadmap

**Branch:** `claude/ljm-v2-milestone-completion-p3gfo2`
**As of:** this session (superseding `12-phase-0-5-implementation-status.md` and
`13-overnight-completion-status.md`, both stale — several prior sessions'
branches sat unmerged for a long time; this session's job was to reconcile
reality before adding anything new). See §5 for exactly what was merged from
where.

This document maps the 14 detailed PRD requirements (§7 of
[`01-PRD.md`](./01-PRD.md): Home, Promises, Testimonies, Giving, Prayer,
Contact, Events, Programs, Blog, Youth Ministry, Live Podcast/Watch & Listen,
About/Churches, Language, Admin) into the 11-block management roadmap. Two of
the 14 (Language, Admin) are cross-cutting rather than single screens, so
they're folded into block 11 alongside platform-quality work; the other 12
map one-to-one or pair up (Contact → About block; Promises → Home block).

## Status legend
✅ Done and verified this session · 🟡 Real, partial · 🔶 Scaffolded/scoped, not implemented · ⛔ Not started

| # | Block | Detailed requirement(s) | Backend | DB | Admin | Public | i18n | Responsive | Browser-tested | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Home & Core Navigation** | Home, Promises | ✅ | ✅ | 🟡 (Promises: full CRUD incl. edit) | ✅ real hero, promise-of-the-day, footer | 🟡 nav/CTA wired, hero copy not | ✅ (E2E: no overflow @390/768/1440) | ✅ E2E | 🟡 85% |
| 2 | **About, Churches & Contact** | About/Churches, Contact | ✅ | ✅ | ✅ | ✅ | 🔶 nav only | ✅ | ✅ E2E | 🟡 80% |
| 3 | **Prayer & Ministry Schedules** | Prayer | ✅ | ✅ (real schedule seeded) | ✅ | ✅ real Mon–Sun/monthly schedule rendered in human language | 🟡 well-wired (reference page) | ✅ | ✅ E2E | ✅ 90% |
| 4 | **Programs** | Programs | ✅ recurrence (weekly/daily/monthly-ordinal) + `meeting_url` | ✅ | ✅ full CRUD incl. edit, recurrence fields exposed | ✅ human-readable recurrence ("Every 2nd Friday" etc.) | 🟡 (reference page) | ✅ | ✅ E2E (rewritten to assert real schedule) | ✅ 90% |
| 5 | **Testimonies** | Testimonies | ✅ | ✅ (4 sample, 1 pending) | ✅ moderation queue | ✅ published-only, filters work | 🔶 nav only | ✅ | ✅ E2E | ✅ 85% |
| 6 | **Events & VBS** | Events | ✅ | ✅ VBS 2026 seeded w/ real theme/venue/dates | ✅ | ✅ | 🔶 large gap (~13 strings) | ✅ | ✅ E2E | 🟡 75% |
| 7 | **Blog** | Blog | ✅ | ✅ (5 posts, 1 draft) | ✅ full CRUD incl. edit + Tamil fields (added this session) | ✅ list + detail | 🔶 nav only | ✅ | ✅ E2E | ✅ 85% |
| 8 | **Youth Ministry** | Youth Ministry | ✅ (`ministryArea='youth'` on blog/programs) | ✅ | — (uses Blog/Programs admin) | ✅ dedicated `/v2/youth.html`, wired into every nav | ✅ nav.youth wired | ✅ | ✅ E2E | ✅ 90% |
| 9 | **Watch & Listen / Media** | Live Podcast/Watch & Listen | ✅ | ✅ (3 media URL settings) | ✅ | ✅ + stored-XSS fix this session | 🔶 nav only | ✅ | 🔶 no dedicated E2E spec yet | 🟡 70% |
| 10 | **Giving & Transparency** | Giving | ✅ *(frozen, byte-verified unchanged)* | ✅ *(frozen)* | ✅ *(frozen)* + Archive Fund bug fixed this session (fund admin, not payment core) | ✅ Give flow/Our Giving/My Giving | 🔶 nav wired, dashboard content (~55 strings, our-giving.html) not | ✅ | ✅ E2E (presentation-only, never touches real payment) | 🟡 70% |
| 11 | **Admin Console, i18n & Platform Quality** | Language, Admin | ✅ | ✅ | ✅ Churches/Testimonies/Programs/Blog/Promises all have real edit UI now | — | 🟡 architecture solid, ~4 pages need deeper content translation | ✅ admin verified 320–1440 | ✅ 62 E2E specs, 408 unit/regression tests | 🟡 80% |

**Overall: 11 / 11 blocks have real, working functionality; 6 of 11 are
substantially complete (≥85%); none are merely scaffolded.** No block is at
0% — the milestone moved from "several major features exist only on
unmerged branches" to "everything is on one tested, deployable branch."

## 1. What this session actually did (audit-first, per the non-negotiable principle)

Before writing any code, this session audited real repository state instead
of trusting prior status docs (which turned out to be stale — see §5). That
surfaced a bigger problem than any single bug: **~15 long-lived branches**
with real, valuable, unmerged work (Youth page, hero redesign, programs
recurrence, a full Playwright suite, real seed content) had been sitting on
`origin/` untouched, while the checked-in `README.md` claimed features like
Youth and Playwright "not yet done." Reconciling that — not writing new
features from scratch — was the highest-leverage work available, and is
most of what changed the block percentages above from where they'd been.

## 2. Confirmed-fixed QA findings (re-verified against real code, not prior claims)

| # | Finding | Verdict | Fix |
|---|---|---|---|
| 1 | Testimonies default query-string bug | Already fixed (pre-session) | — |
| 2 | Watch & Listen stored-XSS | **Was still broken** | Escaped URLs + blocked non-http(s) schemes; regression test added |
| 3 | Root 404 behavior | **Was still broken** | Added `404.html`; regression test added |
| 4 | Mobile hamburger clipping | **Was still broken** | `.brand` made shrinkable; subtitle hidden <430px |
| 5 | Home i18n | Partially fixed | Nav/CTA cheap-wins wired; hero/dashboard content still gapped (§4) |
| 6 | Give-flow navigation consistency | **Was still broken** | Added missing Watch/Blog nav links + full footer-grid |
| 7 | Admin archive-fund behavior | **Was still broken** | Frontend sent `{action:'archive'}`, backend only reads `body.status` — fixed + regression tests |
| 8 | API HTTP error masking | Already fixed (pre-session) | — |

## 3. Real ministry schedules — implemented with proper recurrence

`migrations/0024_seed_prayer_programs.sql` (merged from a prior unmerged
branch, verified and kept) seeds the actual schedule supplied by ministry
leadership, using `programs.recurrence` (`daily`/`weekly`/`monthly`) +
`day_of_week` + `month_ordinal`, not fake "weekly Friday" approximations:

- Daily Morning Prayer 05:00–06:00, Daily Night Prayer 21:30–22:00 (both
  Google Meet — `meeting_url` is admin-configurable, deliberately `NULL`
  until a real link is set, never invented)
- Sunday First Service 06:00–08:30, Sunday Second Service 10:00–12:00
- Full Night Prayer — 2nd Friday of every month
- Youth Prayer — 2nd Sunday of every month, 16:00–17:30

The public Programs page renders this in human language ("Every day",
"Every Sunday", "Second Friday of every month") — verified by
`tests/e2e/programs.spec.js`, rewritten this session to assert on the real
schedule after removing 8 fabricated placeholder programs (see §4).

## 4. Content-safety correction made this session

The previously-unmerged seed migration (renumbered `0023`→`0025` to resolve
a numbering collision) had invented 8 generic programs ("Sunday Worship
Service" 9–11am, "Wednesday Prayer Meeting", "Youth Fellowship" Saturday
4pm, etc.) that **contradicted** the real schedule in §3. These were
removed — seeding fictional programs alongside real ones would misrepresent
the ministry's actual schedule, which is exactly what the milestone brief's
content-safety rule (§28) prohibits. The VBS 2026 event was updated with the
real supplied details (theme "Journey With Jesus" / Matthew 4:19, venue
"Church of Light, PNP, Coimbatore", days 25th/26th/27th) while leaving the
month/year honestly marked "to be confirmed" since it wasn't supplied — no
poster/photo assets were found in the repo, so `cover_photo` stays `NULL`
rather than being fabricated.

## 5. Branch reconciliation record

| Branch | Verdict | What was taken |
|---|---|---|
| `claude/ljm-v2-programs-prayer-meet-fwrxn6` | Merged | Real recurrence, `meeting_url`, admin UI, real schedule seed |
| `claude/ljm-v2-overnight-completion-ozbyw3` | Merged | Youth page, hero redesign, footer, launch-content seed, full Playwright suite |
| `claude/ljm-v2-product-completion-gtmw76` | **Not merged** | Overlapping/conflicting rework of pages already covered by the above (separate `promises.html` page, `prayer.html`→`pray.html` rename) — evaluated, judged not worth the conflict risk for marginal gain. The standalone Promises-archive page it adds is real and could be revisited later (tracked as future work). |
| `claude/ljm-v2-release-candidate-3v3663` (+ its ancestors) | **Not merged** | Diverged from `main` *before* all the ministry-content work landed (base commit `2ff9598`) — merging its 21 commits would reintroduce deleted v2 pages and conflict heavily, for fund/migration-hardening work unrelated to this milestone's scope. Flagged as a separate lane; the one QA-relevant item it targeted (Archive Fund) was independently confirmed broken and fixed directly on current `main` state instead (§2, item 7). |

## 6. Testing

- `npm test`: **408/408 passing** (up from 368 at session start — 40 new/
  updated tests: funds archive regression, watch.html XSS regression,
  root-404 regression, R2 MIME/size validation, R2-bound branch coverage
  for `storePhoto`/`deletePhotoObject`/`events/photo.js`).
- `npx playwright test`: **62/62 passing, run twice for determinism**
  (Chromium only, against a real local `wrangler pages dev` + D1, per
  `playwright.config.js`). Covers Home, Programs, Prayer, Testimonies, Blog,
  Events, Giving (presentation-only, never touches real payment), Language
  toggle, cross-page navigation, admin console, and responsive smoke tests
  at 390/768/1440px.
- **Gap**: the responsive E2E matrix covers 390/768/1440px, not the full
  320/375/393/430/1024/1280 set the milestone brief asks for — tracked as
  follow-up (§7).

## 7. Remaining work

**P0 (blocker):** none identified — every block has real, tested
functionality; nothing is a stub.

**P1 (important):**
- `our-giving.html`'s analytics dashboard (~35 strings) and `my-giving.html`
  (~20 strings) need real Tamil translation — both need a `t(key, vars)`
  interpolation helper added to `i18n.js` first, since most of their copy
  embeds live numbers/dates mid-sentence. `events.html`/`give-flow.html`
  non-payment content (~13 strings each) is a smaller, faster follow-up.
- Home hero/action-card/transparency-section content and the full v2
  footer are still hardcoded English (nav/CTA already fixed this session).
- Watch & Listen has no dedicated Playwright spec yet (page works and is
  covered by `responsive.spec.js`, but not a content-specific E2E test).
- Full 320–1280px responsive matrix (currently 390/768/1440).

**P2 (polish):**
- Reconsider a standalone Promises archive page (real, working
  implementation exists on the unmerged `product-completion` branch — see
  §5 — currently Promises surfaces only via the Home promise-of-the-day
  card).
- Security review of the new v2 surfaces was run this session (see the
  session's final report for findings/fixes) — re-run after the P1 i18n
  work lands, since it touches several of the same files.

**P3 / Future:**
- `claude/ljm-v2-release-candidate-3v3663`'s fund/migration-hardening work
  (Archive Fund's specific bug is already fixed independently) needs its
  own dedicated reconciliation session against current `main`, not a bulk
  merge.
- Real Google Meet URLs for Daily Morning/Night Prayer — deliberately left
  `NULL`/admin-configurable; needs the actual links from ministry
  leadership, never to be invented.
- VBS 2026 exact month/year and poster/photo assets — needs the real
  information/files from the ministry; currently honest placeholders.
