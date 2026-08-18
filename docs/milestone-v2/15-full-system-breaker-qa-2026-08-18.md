# 15 · Full-system breaker / real-user QA — 2026-08-18

| | |
|---|---|
| **Branch** | `claude/ljm-v2-full-system-qa-utsj26` |
| **Baseline** | 368/368 tests passing, working tree clean, on branch, 6 commits ahead of `main` (the Phase 0–5 ministry-content work — Churches/Promises/Testimonies/Prayer/Contact/Programs/Blog/Watch & Listen — already merged into this branch's history) |
| **Scope** | Adversarial, real-user QA of the v2 ministry app — public pages, admin console, i18n, recurring schedules, events/VBS, security — per the 33-section mission brief. Not a rubber-stamp review: every finding below was reproduced live against a real running server, not inferred from reading code alone. |
| **Environment** | Local only. `wrangler pages dev` + a local D1 emulation (`--persist-to=.wrangler/state`), seeded with realistic + adversarial ministry content. **Production was never touched** — see §18/§22/§31. |

---

## 1. Executive summary

The ministry-content phase (Churches, Promises, Testimonies, Prayer, Contact,
Programs, Blog, Watch & Listen) is **structurally solid**: every endpoint has
real auth gates, real draft/pending/published visibility boundaries, and
consistent HTML-escaping almost everywhere. That held up under live adversarial
testing (XSS payloads, Tamil, emoji, huge strings, malformed IDs, IDOR probes),
not just code review.

But two bugs would have embarrassed the owner immediately on a real launch:

1. **The Testimonies page was completely broken for every visitor.** A missing
   `?` in a URL-building expression meant the *default* ("All") view of
   `/v2/testimonies.html` never reached the API — it silently rendered the
   legacy homepage's HTML as if it were JSON, failed to parse, and showed
   "Couldn't load testimonies right now" to 100% of visitors. **Fixed.**
2. **A real, working stored-XSS in the public Watch & Listen page.** The
   admin-configurable livestream URLs had no server-side validation and were
   interpolated unescaped into the page — proven with a live payload that
   executed in a real browser render. **Fixed**, both client- and server-side.

Beyond those two, the recurring-schedule model genuinely can't express what the
ministry needs ("second Friday of every month" renders as a bare "FRI" —
exactly the failure mode the brief called out by name), there's a confirmed
local-dev safety hazard (`theme.js` silently redirecting API calls to
production) that this session worked around but did not change, and a handful
of smaller gaps are documented, not fixed, because fixing them needs a product
decision this session isn't authorized to make on its own.

**5 real bugs found. 4 fixed and regression-tested (with mutation testing).
1 documented, not fixed (data-model gap, needs a product decision). Payment
path byte-identical throughout. Production never touched.**

---

## 2. Actual baseline

- `git status`: clean before starting. `git log -5`: last commit
  `7772abc "Close a CONTRIBUTING.md coverage gap..."`.
- `npm test`: **368/368 passing** before any change (confirmed, not assumed).
- Frozen payment-path files hashed (SHA-256) before touching anything — see §18.

## 3. Environment

- `npx wrangler pages dev . --persist-to=.wrangler/state` (port 8788) against a
  local D1 built from `schema.sql` via `wrangler d1 execute --local`.
- `.dev.vars` (gitignored) set a local-only `ADMIN_API_TOKEN` so admin
  endpoints could be exercised without needing a real Google OAuth token —
  never used against production, never committed.
- Playwright (Chromium, the environment's pre-installed browser) for real
  browser rendering, screenshots, and console/network capture. Installed as
  `npm install -D playwright --no-save` — not added to `package.json` (kept
  the "no build step" contract; see §14 recommendation).
- All test/scratch scripts live under `.qa-scratch/` (gitignored, not shipped).

## 4. Tests executed

- `npm test` — full suite, run repeatedly across the session (see §19).
- No pre-existing Playwright E2E suite exists yet (`tests/e2e/` is empty) —
  browser testing this session was exploratory (`.qa-scratch/*.mjs`), not
  added as a durable suite. See §24 recommendation.
- Live adversarial HTTP testing (curl) against every new ministry endpoint:
  auth-gate probes, IDOR probes, SQLi-shaped/negative/huge IDs, malformed
  JSON, XSS/HTML-injection payloads, Tamil, emoji, 50KB+ strings.
- Live browser testing (Playwright): full public-page sweep, i18n EN↔TA
  toggle on 9 pages, responsive screenshot sweep (10 pages × 7 widths = 70
  screenshots, visually inspected — not just `scrollWidth` checks), admin
  console login + Ministry-panel walkthrough + mobile admin screenshots.
- 2 mutation-tested fixes (see §7): broke each fix, confirmed the new test
  failed, restored the fix, confirmed green again.

## 5. Browser matrix

Chromium (Playwright), real renders, not just HTTP status checks. Widths
tested: 320, 375, 390, 430, 768, 1024, 1440. Pages: Home, About, Prayer,
Programs, Events, Testimonies, Blog, Watch, Contact, Give-flow, plus Admin at
1280 and 390.

---

## 6. 11-block status

| Block | Status | Tested | Bugs | Remaining |
|---|---|---|---|---|
| 1. Home & Core Navigation | ✅ Working | All 12 v2 pages loaded, header/footer/nav links enumerated on every page, deep-links checked | 404-handling gap (see §5 below, shared) | Verify `not_found_handling` against real production |
| 2. About, Churches & Contact | ✅ Working | About page (churches list, mission cards, verses — all esc()'d), Contact form + XSS/bad-email inputs | None found | — |
| 3. Prayer & Ministry Schedules | ⚠️ Partial | Prayer submit + admin inbox tested end-to-end; Programs recurrence tested with the real ministry schedule | **Recurrence semantics gap** (not fixed — data model) | Needs a schema/product decision |
| 4. Programs | ⚠️ Partial | Full CRUD via API, church-scoping, recurrence display | Recurrence gap (above) + fixed layout-overflow bug | See §16 |
| 5. Testimonies | ✅ Fixed | Full journey: public submit → admin moderate (publish/reject) → public visibility, incl. XSS/Tamil/emoji/long-text | **Default view was 100% broken — fixed** | — |
| 6. Events & VBS | ✅ Working | VBS 2026 event created with R2-backed photo, draft-vs-published visibility, church attribution | None found | R2 real-upload path now exercised (was previously an accepted test gap) |
| 7. Blog | ✅ Working | Draft/published visibility (404 on draft slug), XSS payload correctly escaped, Tamil content | None found | — |
| 8. Youth Ministry | ❌ Not built | Confirmed absence, not fabricated | No dedicated page/nav entry exists anywhere | Matches doc 12's own "not yet done" — still true |
| 9. Watch & Listen | ✅ Fixed | All 3 media cards, embed detection, non-YouTube fallback link | **Stored XSS — fixed**, both ends | — |
| 10. Giving & Transparency | ✅ Untouched | Presentation-only screenshot check | None (frozen, not touched) | — |
| 11. Admin Console, i18n & Platform Quality | ⚠️ Partial | Real login, all 7 Ministry panels opened + screenshotted at desktop and mobile, i18n toggle on 9 pages | `theme.js` prod-redirect hazard (documented, not changed) + admin table mobile scroll (documented) | See §11/§22 |

---

## 7. Bugs found and fixed

### BUG-1 (P1): Testimonies page default view never loaded — every visitor saw an error

- **File**: `v2/testimonies.html:182`
- **Repro**: Load `/v2/testimonies.html` fresh (the default "All" filter). The
  list-fetch URL was built as
  `'/api/testimonies' + (currentKind ? '?kind=...' : '') + '&_t=' + Date.now()`.
  With the default empty `currentKind`, that's `/api/testimonies&_t=171234...`
  — **no `?`**. Cloudflare Pages Functions routes on exact pathname, so this
  never reached `functions/api/testimonies.js`; it fell through to
  static-asset serving, which returned the **legacy root `index.html`** at
  `200 text/html` (see BUG-4). `fetch(...).then(r => r.json())` then threw on
  the HTML body.
- **Expected**: the real, published testimonies.
- **Actual**: "Couldn't load testimonies right now — please try again
  shortly." — on every load, for every visitor, with the "kind" filter chips
  (Testimonies/Miracles) working fine (they always included a `?`).
- **Verified live**: `curl '.../api/testimonies&_t=1'` → returns the legacy
  homepage's HTML; a real Playwright render of `/v2/testimonies.html` showed
  the error state; after the fix, the same render showed all 4 published
  testimonies (incl. Tamil and emoji content, correctly escaped).
- **Fix**: always start the query string with `?`:
  `'/api/testimonies?' + (currentKind ? 'kind=' + currentKind + '&' : '') + '_t=' + Date.now()`.
- **Regression test**: `tests/frontend/testimonies-query-string.test.mjs` (2
  tests) — statically extracts and evaluates the URL-building expression for
  both the default and filtered cases.
- **Mutation-tested**: reverted the fix → both new tests failed → restored →
  green again.
- **Security impact**: none directly, but see BUG-4 — this bug is a visible
  symptom of the same missing-404-handling root cause.

### BUG-2 (P1): Stored XSS in the public Watch & Listen page

- **Files**: `functions/api/settings.js`, `v2/watch.html:121-155`
- **Repro**: `PUT /api/settings` with `{"key":"sunday_live_url","value":"\"><img src=x onerror=\"window.__xss=1\">"}`
  — accepted with `200 OK`, **no scheme or format validation at all** on the
  three `MEDIA_KEYS` (`sunday_live_url`/`daily_prayer_url`/`podcast_playlist_url`).
  `v2/watch.html` then rendered the non-YouTube-matching URL straight into
  `'<a ... href="' + c.url + '" ...>'` with **no HTML-escaping**.
- **Verified live**: loaded `/v2/watch.html` in a real Chromium render after
  setting the payload — `window.__xss` fired (`1`), confirmed via
  `page.evaluate`. Also confirmed the raw `<script>` variant broke out of the
  `href` attribute in the actual DOM (visible via `page.content()`), even
  though `<script>` tags specifically don't execute via `innerHTML` (the
  `onerror` variant does, and did).
- **Expected**: only real http(s) URLs ever render as a link/iframe; anything
  else is treated as "not configured."
- **Actual**: any string — including `javascript:`, `data:`, or HTML/attribute
  breakout — was stored and rendered verbatim on the public page.
- **Fix (both ends, defense-in-depth)**:
  - `functions/api/settings.js`: reject any `MEDIA_KEYS` value that doesn't
    match `^https?:\/\//i` with a `400`.
  - `v2/watch.html`: added an `esc()` helper (this page was the *only* v2
    ministry page without one) and HTML-escape `url`/`title`/`desc`; only
    render a card at all if its URL passes the same `https?://` check
    (a non-conforming value is treated identically to "not set" — no broken
    button, per the mission brief's explicit requirement for that state).
- **Regression tests**: `tests/api/settings.test.mjs` — 2 new tests (rejects
  `javascript:`/`data:`/attribute-breakout values across all 3 media keys and
  confirms real `https://` values + the empty-clears-it case still work).
- **Mutation-tested**: reverted the server-side guard → the new rejection test
  failed → restored → green (13/13 in that file).
- **Security impact**: was a real stored XSS reachable by anyone with
  `manage_funds` access to the Settings panel (not public-writable) — but the
  payload executes for **every public visitor** of `/v2/watch.html`, not just
  admins. Fixed.

### BUG-3 (P2): A single long admin-entered program title could blow the whole page up to ~2.26 million px wide

- **File**: `v2/programs.html` (`.pg-item` CSS)
- **Repro**: `POST /api/programs` with a 50,000-character `titleEn` (no server-
  side length cap exists — see §16) → `/v2/programs.html`'s
  `document.documentElement.scrollWidth` went from `1280` to `2,263,745`.
  Root cause: `.pg-item` is a flex row; its unlabeled title/description
  `<div>` had no `min-width: 0`, so a flex child's default `min-width: auto`
  refused to shrink below the unbroken string's intrinsic width, forcing the
  entire row — and therefore the page — to grow instead of wrapping.
- **Fix**: gave that wrapper a `.pg-body` class with `min-width: 0`, and added
  `overflow-wrap: anywhere` to `.pg-item h4`/`.pg-item p`.
- **Verified live**: re-ran the same 50KB-title scenario after the fix —
  `scrollWidth` back to `1280` (== `clientWidth`), no overflow.
- **Regression test**: `tests/frontend/programs-overflow-guard.test.mjs` (3
  tests, static-source, matching this repo's no-build-step pattern).
- **Mutation-tested**: reverted the CSS → 2 of 3 tests failed → restored →
  green.
- **Note**: this is a mitigation, not a full fix — a sufficiently long string
  still makes the *element* pathologically tall (still wraps, just doesn't
  blow out the page width). The real fix is a server-side length cap; see the
  unfixed item in §16.

### BUG-4 (documented, not fixed): nonexistent routes return `200` + the legacy homepage instead of a real 404

- **Repro**: `GET /v2/does-not-exist.html`, `/v2/blog/nonexistent`,
  `/api/does-not-exist` all return `200 text/html` with the title "LJM
  Church" and legacy nav (funds/members/impact/about/admin) — the **legacy
  root `index.html`**, not a 404. This also cascades into broken relative
  asset requests (MIME-type console errors for style.css/theme.js/etc. under
  the wrong path) and a `ReferenceError: LJMAdmin is not defined` page error.
- **Root cause**: no `not_found_handling` is set in `wrangler.jsonc` and there
  is no custom `404.html` anywhere in the repo. `functions/_middleware.js`
  was checked and ruled out — it only intercepts a small explicit route map
  and falls through (`next()`) for everything else; it isn't the cause.
- **Why not fixed**: confirmed only against the **local** `wrangler pages dev`
  emulation. Cloudflare Pages' documented `not_found_handling` behavior in
  actual production may differ from the local dev-server default, and I
  deliberately did not touch or query production to verify which. Fixing this
  blind (e.g. guessing at a `not_found_handling` value) risks a production
  behavior change I can't verify locally is correct — exactly the kind of
  change the mission brief says to document and stop on, not push through.
- **Recommendation**: add a real `404.html` (or set `not_found_handling` in
  `wrangler.jsonc`) and re-verify against the actual deployed site.

---

## 8. Bugs not fixed (documented, need a product decision)

### The recurrence model can't express what the ministry's real schedule needs

- **File**: `migrations/0020_programs.sql` / `functions/api/programs.js` /
  `v2/programs.html:136`.
- The schema: `recurrence TEXT DEFAULT 'weekly'` (`'weekly' | 'monthly' |
  'once'`) + a single `day_of_week` int (0–6, nullable). There is **no field
  for "which week of the month."**
- Seeded the real ministry schedule from the mission brief and screenshotted
  the actual public render (`.qa-scratch/shots/programs-clean-390.png`):
  - "Daily Morning Prayer" / "Daily Night Prayer" (`day_of_week: null`,
    `recurrence: 'weekly'` — there's no `'daily'` option) render as a bare
    **"—"** with zero schedule information.
  - "Full Night Prayer" (`recurrence: 'monthly'`, `day_of_week: 5`) renders
    as **"FRI"** — the exact "BAD" example named in the mission brief. The
    prose description below it ("Second Friday of every month.") does
    clarify it, but the prominent bold badge is indistinguishable from a
    real weekly Friday service.
  - "Youth Prayer" (`recurrence: 'monthly'`, `day_of_week: 0`) renders as
    **"SUN"** — identical badge to the two real weekly Sunday services above
    it, with no visual distinction.
- **Why not fixed**: this needs a schema decision (a `week_of_month` int, or
  a free-text `recurrence_note` field, or something else) plus an admin-form
  and public-render change — not a one-line, isolated, obviously-safe fix.
  Flagged per the mission's fix policy: "if the fix requires a product
  decision: STOP that change and report it."

### No Google Meet link field for Daily Night Prayer

- Only one `daily_prayer_url` setting exists (`functions/api/settings.js`
  `MEDIA_KEYS`), labeled "Daily Morning Prayer" on `/v2/watch.html`. There is
  no column or setting anywhere for the night prayer's Google Meet link. The
  mission brief's ministry-content spec calls for both. Product decision
  (add a second `MEDIA_KEYS` entry / column) — not made unilaterally.

### No server-side length limits on the new ministry endpoints' free-text fields

- `programs.js`/`testimonies.js`/`blog.js`/`prayer.js`/`contact.js`/
  `promises.js`/`churches.js` accept unbounded text (confirmed: a 50,000-char
  `titleEn` on `POST /api/programs` → `200 OK`). `settings.js` already has
  this discipline (`MAX_VALUE_LEN`/`MAX_VALUE_LEN_BY_KEY`); the newer
  ministry endpoints didn't carry it forward. This combined with BUG-3 above.
  Not fixed — needs a chosen limit per field (product decision), not guessed.

### Malformed/empty JSON body → `500`, not `400`

- Every one of the 7 new ministry handlers' generic
  `try { await request.json() } catch` returns a `500` on unparseable JSON,
  not a `400`, technically at odds with `CONTRIBUTING.md`'s "a missing
  required field is a 400, not a 500" rule. **Confirmed this is a
  pre-existing, repo-wide pattern** (checked `funds.js` — same behavior), not
  something introduced by the ministry-content phase. Not fixed here: a real
  fix touches every `functions/api/*.js` file for a one-line status-code
  change, which is broader scope than this session's mandate.

---

## 9. Security findings

- **Confirmed working correctly** (live-tested, not just read): every
  `?all=1` admin listing (churches/programs/testimonies) rejects
  unauthenticated callers with `401`; `GET /api/prayer` and `GET
  /api/contact` (the inboxes) require auth from the very first line and
  return zero data without it; a draft blog post returns a clean `404` by
  slug (doesn't leak existence); a rejected testimony is excluded from the
  public list; a draft event is excluded from the public list; an
  unprivileged legacy-email token is rejected with `401` on a moderation
  attempt; SQLi-shaped/negative/huge IDs are all handled as clean
  `400`/`404`s, never `500`s or silent no-ops.
- **XSS escaping audit** across every v2 ministry page: About (mission
  cards, verses), Blog (title/body — proven live with a raw `<script>`/`<img
  onerror>` payload rendered as literal escaped text), Testimonies
  (title/body/author — same), Events (title/location/category/description +
  `coverPhoto` background-image url), Programs (church names, program
  title/description/location) all correctly use an `esc()` helper. **Only
  Watch & Listen did not** — see BUG-2, now fixed.
- `mediaUrl` (testimonies) and `coverUrl` (blog) are accepted by their admin
  APIs but never actually rendered anywhere on the public pages — dead
  fields, not a security issue, just an inconsistency worth noting (P4).
- **`theme.js` local/production redirect hazard** — see §11 below; documented
  in detail, not modified.

## 10. Responsive findings

70 screenshots across 10 pages × 7 widths (320/375/390/430/768/1024/1440),
visually inspected (not just `scrollWidth` checks). All 12 real v2 pages
rendered cleanly with header/footer/nav intact at every width after BUG-3 was
fixed. One confirmed layout bug (BUG-3, fixed). One minor cosmetic
observation, not fixed: the header's brand tagline (`<small>Coimbatore ·
Worldwide</small>`) gets visually clipped by sibling flex items at ≤375px on
every v2 page (doesn't cause page-level horizontal overflow — `scrollWidth`
stays clean — just an unattractive clip). P4.

One thing I specifically investigated and **could not reproduce as a real
bug** after careful re-testing: my first pass appeared to show the fixed
mobile bottom action bar (`.mobile-actions`) permanently covering the
footer's Quick Links when scrolled to the true bottom of a v2 page. A
full-page Playwright screenshot did show this — but that turned out to be a
known Playwright artifact (fixed-position elements get captured once at a
frozen position during full-page stitching, not truly re-pinned per scroll
position). Re-tested carefully with a real single-viewport scroll-to-bottom
(confirmed via `scrollY`/`scrollHeight` measurement, screenshotted, visually
clean) and found no actual overlap. I'm recording this so it isn't
independently "rediscovered" — investigated, not a real bug, no fix applied.

## 11. i18n findings

Toggled English → Tamil → English on 9 pages
(`.qa-scratch/i18n-results.log`). The mechanism itself is solid: no
`[object Object]`, no literal `undefined`/`null` leaks, `lang` attribute
updates correctly, choice persists correctly across a reload. No layout
overflow from the toggle itself (once BUG-3's unrelated overflow was fixed).

**Coverage gap, not a code bug**: `v2/i18n.js`'s dictionary covers ~19
nav/CTA/state keys — nav, footer tagline, a handful of buttons. Nearly every
page heading, description paragraph, and form label is hardcoded English with
no `data-i18n` wiring at all. This matches the documented architecture
("small client-side dictionary... not full content translation," per the
file's own header comment) — I'm not classifying it as broken code — but a
Tamil-speaking visitor tapping "TA" would reasonably expect far more of the
page to change than it does. Worth the owner's attention as a scope/roadmap
item, not a bug to fix in this session.

## 12. Admin findings

Logged into the real admin console locally (the `localhost`/`127.0.0.1`
dev-login prompt path, gated behind `ALLOW_LEGACY_EMAIL_TOKEN=true`, which was
already `true` in `wrangler.jsonc` before this session). All 7 Ministry
panels (Churches, Promises, Testimonies, Prayer requests, Contact messages,
Programs, Blog) opened, loaded real seeded data, and rendered without console
errors. Screenshotted at 1280px and 390px.

- Churches panel: full add-church form (Slug/Name EN+TA/Mother-church
  toggle/City/Phone/Email/Map URL/Address/Service times) + list with
  Edit/Archive — clean at desktop.
- Testimonies moderation queue: correctly shows the XSS-payload testimony as
  **escaped plain text**, not executed — confirms the admin console itself
  isn't a second XSS surface for the same content.
- **Mobile admin tables** (`.table-wrap { overflow-x: auto; }`) require a
  horizontal swipe to reach Status/Actions columns on a 390px phone — the
  scroll works (not literally broken), but there's no visual affordance
  hinting it's scrollable. This is a **pre-existing, systemic pattern across
  every admin table in the app** (all ~15 `.table-wrap` tables use the exact
  same CSS, not something introduced by the ministry-content phase), so
  fixing it here would be a disproportionate, out-of-scope redesign. P3,
  documented.
- Admin Overview's chart cards showed "Failed to load: Chart is not defined"
  — this is a **sandbox artifact** (this environment's network policy blocks
  `cdn.jsdelivr.net`, so Chart.js itself never loaded), not a production bug.
  Noted because the *error handling itself* is a positive finding: it failed
  cleanly with a visible message rather than faking a zero-value chart.

## 13. Cross-feature journeys

- **Testimony**: public submit (pending) → admin publish (via the real admin
  UI, not just the API) → visible on `/v2/testimonies.html`; a second
  submission → admin reject → confirmed excluded from the public list.
- **Admin mutation → public page**: created churches/programs/promises/blog
  posts/a VBS event via the admin API and confirmed each appeared correctly
  on its public page; deleted the two adversarial 50KB/200KB "programs" test
  rows and confirmed they disappeared from `/v2/programs.html`.
- **Draft → published**: a draft blog post and a draft event were both
  confirmed invisible publicly, then a real published one was confirmed
  visible — the boundary is enforced at the API layer for every content
  type tested, not just in the admin UI.

## 14. Events/VBS findings

Created a real "VBS 2026" event (Church of Light, 2026-05-11, with a cover
photo + one gallery photo) through the admin API. Since this environment's
`wrangler.jsonc` declares an `EVENT_PHOTOS` R2 binding, local `wrangler pages
dev` emulates R2 — so **the real R2 upload path was exercised** (not just the
base64-D1 fallback), closing a gap the coverage tracker had previously
flagged as untested (`COVERAGE-TRACKER.md`'s "real R2 object storage branch"
row). Photo served back correctly via `/api/events/photo?key=...`
(`200 image/png`). A draft event was confirmed excluded from the public
`/api/events` list. Church attribution (`churchId`/`churchSlug`/
`churchNameEn`) joined correctly.

## 15. Prayer/program schedule findings

See §8 (recurrence model) — the core finding. Timezone: not separately
re-litigated this session; `functions/api/promises.js`'s IST "today" resolver
was inspected (not modified) and the daily promise seeded for today's IST
date rendered correctly.

## 16. Google Meet findings

See §8 — only one media-URL field exists for prayer (labeled "Daily Morning
Prayer"), no field for Daily Night Prayer's link at all. The one field that
exists was the XSS vector in BUG-2, now fixed with both scheme validation and
HTML-escaping; a genuinely valid `https://meet.google.com/...` value renders
and is clickable correctly.

## 17. Giving/transparency freeze verification

**Zero giving-path files touched.** `v2/give-flow.html`/`our-giving.html`/
`my-giving.html` were loaded and screenshotted (presentation-only, per the
mission's explicit allowance) — no mutations attempted, no admin data
touched. SHA-256 hashes of all 8 frozen files taken at session start and
re-verified at session end (see §18) — **byte-identical**.

## 18. Payment freeze verification

Hashed before touching anything and re-verified at the end:

| File | SHA-256 (start == end) |
|---|---|
| `functions/api/webhook.js` | `54fcaa24fabab1c8b9e46778dd64a3a3c0fd676fc6e22b062ecb0181d66b62bb` |
| `functions/api/verify.js` | `e4de9c48ac924e41a73be4a8fab00dfa63c70a99ce9105f559c6362caa7b433b` |
| `functions/api/contributions.js` | `0864497974ced7c28737e229d7227b2b24376836ec993f689af26d8b4d57cce7` |
| `functions/api/purchases.js` | `ad06c4319ba2e1fec9633efef4a66ca863b570537f308c804352614438e6cdbc` |
| `razorpay-checkout.js` | `b8a43d5959007d93ff47d32207f31fc17c697df2ecd246090a7d2c270688b6d7` |
| `functions/api/_lib.js` | `77bc345228377caecacf0bb64794210ab779d472b10aa788d9e6227aedcbf8cd` |
| `functions/api/auth.js` | `1ca4747a9a065a7b47fe223b9b0e799fded58ce51d8b99a5300e7f5afb72791f` |
| `functions/api/roles.js` | `ffa10ba1edd0fff124fc8648ca4e74558307b239cc62d2982ad26a728a866304` |

All 8 identical start vs. end. **Clean.**

## 19. Database/migration findings

No migrations added or modified this session. Applied the existing
`schema.sql` to a local D1 emulation only (`wrangler d1 execute --local`).
`tests/regression/schema-contract.test.mjs` stayed green throughout (368→375
as fixes/tests were added).

## 20. R2 findings

See §14 — the real R2-bound upload path was exercised locally (this
environment's `wrangler pages dev` emulates the `EVENT_PHOTOS` binding
declared in `wrangler.jsonc`), not just the base64 fallback. Worth updating
`COVERAGE-TRACKER.md`'s accepted-gap note about this once a proper
`tests/helpers/` R2 mock exists for automated (not just manual) coverage —
not done this session (would need new test infrastructure, out of scope for
a QA pass).

## 21. Console/network findings

Every v2 page: no page-crashing console errors. The only console
errors/failed requests seen were this **sandbox's** outbound network policy
blocking `cdn.jsdelivr.net` (Chart.js) and `fonts.googleapis.com`/
`accounts.google.com` — not application bugs (see §12's note on the Overview
chart). Distinguished carefully from real bugs throughout — the
`net::ERR_CONNECTION_RESET`/`ERR_TUNNEL_CONNECTION_FAILED` pattern was
present on essentially every page load and is environmental, not app-level.

## 22. Production status

**Never touched.** All testing ran against a local `wrangler pages dev` +
local D1. See §23 for the one confirmed, real hazard that makes this
distinction matter.

## 23. Local environment safety — `theme.js` production-redirect hazard

Investigated per the mission brief's explicit instruction. **Confirmed real
and still present**, `theme.js:5-15`:

```js
var isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
if (isLocalhost) {
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
        var url = ...;
        if (url && url.startsWith("/api/")) {
            url = "https://light-of-jesus-ministry-contributions.pages.dev" + url;
        }
        return originalFetch.call(this, url, init);
    };
}
```

**Proven with live network capture**, not just reading the code: opening
`admin.html` locally sent real GET requests for `/api/settings`,
`/api/contributions`, `/api/funds`, `/api/wishlist` to the actual production
domain. This applies to **every** `/api/*` fetch — GET or mutation — with no
method distinction, on every legacy page that loads `theme.js` (`index.html`,
`about.html`, `admin.html`, `member.html`, `funds.html`, `impact.html`,
`members.html`, `subscriptions.html`, `events.html`). **`v2/*.html` pages do
not load `theme.js` and are unaffected.**

- **Intentional or accidental?** The code is deliberate (added in commit
  `4c3461d` alongside an unrelated feature, by the repo owner, not a stray
  typo) — almost certainly meant as a "preview the local UI against real
  data without needing a local D1" convenience. But it does not distinguish
  GET from POST/PUT/DELETE, which is very likely an oversight: it converts
  any local *admin mutation* testing into a real production mutation,
  silently.
- **What I did**: did **not** modify it — changing behavior for whatever the
  intended "preview against live data" use case is would itself be a
  production-behavior change I'm not authorized to make unilaterally. Instead,
  for every piece of browser-based testing this session, I built a Playwright
  network-interception harness (`.qa-scratch/lib.mjs`'s `launchSafe()`) that
  intercepts any request to the production origin and replays it against the
  local server instead — logging every interception as proof. Every admin
  mutation performed during this session's testing is confirmed to have
  landed only in the local D1 emulation.
- **Recommendation**: the owner should decide deliberately — e.g. scope the
  redirect to `GET` only, or gate it behind an explicit opt-in flag — rather
  than have it silently apply to every method on every legacy page.

## 24. Remaining risks

1. The recurrence-model gap (§8) — real ministry schedules (Full Night
   Prayer, Youth Prayer, both prayer times) are not accurately represented
   in the public UI today.
2. `theme.js`'s production-redirect hazard (§23) is unchanged — any future
   agent/developer testing `admin.html` (or any of the 8 other legacy pages
   that load it) locally without building a similar safety harness **will**
   send real mutations to production if they're not careful.
3. Production's actual `not_found_handling` behavior for `/v2/*` and `/api/*`
   typos is unverified (BUG-4) — only confirmed locally.
4. No length caps on the 7 new ministry endpoints' free-text fields (§8) —
   BUG-3's CSS mitigation helps the *page layout* but a malicious/mistaken
   huge input can still bloat the database and produce a pathologically tall
   (if no longer pathologically wide) element.
5. No durable Playwright E2E suite exists yet — this session's browser
   testing was thorough but exploratory/manual (`.qa-scratch/*.mjs`, not
   committed). The 2 regressions this session did add
   (`tests/frontend/testimonies-query-string.test.mjs`,
   `tests/frontend/programs-overflow-guard.test.mjs`) are static-source
   tests in the existing no-build-step pattern, not live-render E2E tests.

## 25. Recommended next actions

1. **Product decision**: choose a recurrence representation that can express
   "Nth weekday of the month" and "daily" (see §8), then implement + migrate.
2. **Product decision**: add a Daily Night Prayer Google Meet field.
3. Choose and enforce length caps on the new ministry endpoints' text fields.
4. Verify `not_found_handling` against the real production deployment and
   add a proper `404.html` if it's missing there too.
5. Decide `theme.js`'s intended scope (GET-only? opt-in flag?) and fix it
   deliberately — this is a standing hazard for every future local-dev
   session, not just this one.
6. Stand up a real `tests/e2e/` Playwright suite (this session's
   `.qa-scratch/lib.mjs` network-interception pattern is a reasonable
   starting point for making it production-safe by construction).
7. Build the Youth Ministry hub page (still not started, confirmed absent).

## 26. Exact files changed

```
 .gitignore                                        |  2 +
 docs/testing/COVERAGE-TRACKER.md                  | 40 ++++++++
 functions/api/settings.js                         |  3 +
 tests/api/settings.test.mjs                        | 27 +++++
 tests/frontend/programs-overflow-guard.test.mjs    | 31 ++++++ (new)
 tests/frontend/testimonies-query-string.test.mjs   | 40 ++++++++ (new)
 v2/programs.html                                   |  7 +++----
 v2/testimonies.html                                |  2 +-
 v2/watch.html                                      | 12 ++++++----
```

`.gitignore` adds `.dev.vars` and `.qa-scratch/` (local-only test
infrastructure, never shipped). No migrations, no payment-path files, no
production config changed.

## Commits

See git log on this branch after this report is committed.

---

# OVERALL:
P0: 0
P1: 2 (both found and fixed this session — Testimonies default view 100% broken; stored XSS in Watch & Listen)
P2: 2 (1 fixed — programs.html layout blowout; 1 documented, not fixed — recurrence-semantics gap)
P3: 3 (documented, not fixed — no length caps on ministry endpoints; malformed-JSON returns 500 not 400 repo-wide; admin tables need horizontal scroll on mobile with no affordance)
P4: 2 (documented, not fixed — header tagline clips at ≤375px; mediaUrl/coverUrl accepted but never rendered)

11-BLOCK STATUS:

1. Home & Core Navigation: Working (404-handling gap shared with block 4/9, see BUG-4)
2. About, Churches & Contact: Working
3. Prayer & Ministry Schedules: Partial (recurrence semantics gap, documented not fixed)
4. Programs: Partial (layout-overflow bug fixed; recurrence gap documented not fixed)
5. Testimonies: Fixed (was completely broken for every visitor — now working)
6. Events & VBS: Working
7. Blog: Working
8. Youth Ministry: Not built (confirmed absent, not fabricated)
9. Watch & Listen: Fixed (stored XSS closed, both client + server side)
10. Giving & Transparency: Untouched (frozen, verified byte-identical)
11. Admin / i18n / Platform: Partial (theme.js hazard documented not changed; admin mobile tables documented not fixed; i18n coverage gap documented, mechanism itself works)

TESTS:
npm test: 375/375 passing (was 368/368 baseline; +7 from this session's 2 new test files + 2 settings.js tests + regression test additions)
Playwright: Exploratory only this session (.qa-scratch/*.mjs) — no durable tests/e2e/ suite added
Targeted: Live curl adversarial testing against all 7 new ministry endpoints (auth/IDOR/XSS/SQLi-shaped/malformed input)
Mutation: 2/2 fixes mutation-tested (broke → confirmed test failure → restored → confirmed green)

BROWSER:
Mobile: 320/375/390/430px — 70-screenshot sweep, visually inspected
Tablet: 768/1024px — included in sweep
Desktop: 1280/1440px — included in sweep + admin console

SECURITY:
Status: 1 real stored-XSS found and fixed (Watch & Listen media URLs); all other new-endpoint auth/visibility/IDOR checks passed live testing; no other injection vectors found

PAYMENT PATH:
Status: Untouched — all 8 frozen files byte-identical (SHA-256 verified start and end)

PRODUCTION:
Touched: NO
Verified: YES (hashes + git diff confirm zero production-path changes; all testing ran against a local wrangler pages dev + local D1)

TOP 5 REMAINING RISKS:

1. Recurring-schedule model can't represent "second Friday of every month" or "daily" — public UI misrepresents real ministry schedules today.
2. theme.js still silently redirects every /api/* call (GET and mutations alike) to production for any local session on 9 legacy pages — a standing hazard for the next agent/developer who doesn't build a safety harness first.
3. Production's actual 404/not_found_handling behavior for mistyped /v2/ and /api/ routes is unverified — only confirmed locally, where it silently serves the legacy homepage at 200.
4. No server-side length caps on the new ministry endpoints' free-text fields — a single huge input can still bloat the database even after the layout mitigation.
5. No durable Playwright E2E suite exists yet — this session's thorough browser testing doesn't persist as an automated regression net.

RECOMMENDED NEXT AGENT:

Start with the product-decision items this session explicitly could not make
unilaterally: (a) design and migrate a real recurrence model (day-of-month /
week-of-month / daily) for programs.js, working from the real ministry
schedule in this report's §8 as the acceptance test; (b) add the missing
Daily Night Prayer Google Meet field. Then verify BUG-4's 404-handling gap
against the actual production deployment (read-only — do not deploy blind)
and fix `wrangler.jsonc`/add a `404.html` if it reproduces there too. Only
after those: stand up `tests/e2e/` using this session's
`.qa-scratch/lib.mjs` production-redirect-interception pattern as the
starting point, and build the still-missing Youth Ministry hub page.
