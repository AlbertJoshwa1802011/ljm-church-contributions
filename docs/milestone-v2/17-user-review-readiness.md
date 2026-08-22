# V2 — Real User Review Readiness

**Branch:** `claude/ljm-v2-merge-main-h4nmnl` (not merged, not pushed to `main`, no
production deploy performed)
**Commits this session:** `48a4f04`, `e2eda5e`, `b8ce7cb` (on top of `a61636e`,
the already-verified V2 release integration)

This session's job was narrower than a full audit: get V2 to a state the owner
can actually click through as a real visitor, not re-run the architecture/
security review already completed in prior sessions (see
[`16-release-reconciliation-report.md`](./16-release-reconciliation-report.md)
and `docs/audits/2026-08-21-production-hardening.md`).

## How to review it

Visit `/v2/index.html` directly (or any `/v2/*.html` page) — these are **not**
beta-gated. Root `/` intentionally still serves the old V1 dashboard unless
your browser holds a signed beta cookie (`functions/_middleware.js`); that's
the existing gradual-cutover design, not something this session changed. Every
`/v2/*.html` page's own nav/footer links stay inside the v2 flow.

## What was fixed

1. **Our Giving / My Giving had no way to reach Contact, Prayer, About,
   Programs, Youth, Blog, Testimonies, Watch, or Give.** Both pages shipped
   with a stripped-down footer (copyright + "Back to Home" only) while every
   other `/v2/*.html` page carries the full footer-grid. Neither page's top
   nav includes Contact or Prayer either (no page's does — those only live in
   the footer), so this was a real dead end for a visitor landing on either
   page. Fixed by adding the same footer-grid markup used everywhere else.
   Regression test: `tests/frontend/v2-footer-consistency.test.mjs`.

2. **Long descriptions cut off mid-word with no ellipsis.** The VBS 2026
   event description (real seeded content, migration `0025`) is longer than
   the card truncation limit, and `events.html`, `index.html`'s Home
   "Upcoming" card, and `blog.html` each did a raw `.slice(0, N)` — so the
   card visibly read "...Three days of B" instead of "...Three days of…".
   `testimonies.html` appended an ellipsis but still cut mid-word. All four
   now use a small `truncate(s, limit)` helper that breaks at the last whole
   word. Regression test:
   `tests/frontend/v2-description-truncation.test.mjs`.

Both are UI-only changes to `v2/*.html` — no API, schema, or auth logic
touched.

## Pages verified (visual + functional)

All 13 `v2/*.html` pages — Home, About/Our Churches, Watch & Listen, Events,
Blog, Testimonies, Programs, Youth, Our Giving, Give Flow, My Giving, Prayer,
Contact — were loaded against a real local D1 seeded from `schema.sql` +
migrations `0024`/`0025` (the project's own `npm run db:local:setup`), full-page
screenshotted at phone/tablet/desktop, and checked for horizontal overflow,
console errors, and broken/empty layouts. All render with real seeded content
(prayer schedule, VBS event, testimonies, blog posts, promises), zero
horizontal overflow at any viewport, and honest (not fabricated) empty states
where content genuinely doesn't exist yet (Watch & Listen has no livestream
link configured; Youth has no youth-specific programs seeded — both surface a
clear "check back soon" message rather than a blank page).

**Responsive viewports checked:** 390×844 (phone), 768×1024 (tablet),
1440×900 (desktop) for the full page set, plus the existing E2E suite's wider
matrix (320/360/375/390/393/430/768/1024/1280/1440) for header, nav, cards,
and admin layout.

## Admin → public round trips verified

Beyond the existing E2E round-trip coverage (Events: create/edit/delete with
photos; Watch & Listen: admin-configured media links), this session manually
drove and confirmed, against the live local API + D1 + rendered page (not
just the API response), then cleaned up the test rows:

- **Program** — admin create → appears on public Programs *and* Prayer pages.
- **Church** — admin address update → reflected on the public About page.
- **Blog** — admin create (published) → appears on public Blog list.
- **Testimony** — public submit (lands `pending`, invisible publicly) → admin
  approve → appears on public Testimonies page.
- **Contact** — public submit → lands in the admin Contact inbox.

## Tests actually executed

- `npm test` (unit/regression): **499/499 passing** (497 pre-existing + 2 new
  regression tests added this session).
- `npx playwright test` (full browser E2E suite, real local Cloudflare Pages
  Functions + D1 + Chromium): **195/195 passing**, run twice — once before
  today's fixes to establish a baseline, once after.
  - Note for reproducibility: the E2E suite's admin dev-login bypass requires
    a local `.dev.vars` (copied from `.dev.vars.example`, git-ignored by
    design) setting `ALLOW_LEGACY_EMAIL_TOKEN=true`. Without it, 6 admin/
    dev-login-dependent specs fail with "Legacy email tokens are disabled" —
    this is a local environment-setup gap, not a product regression; it was
    reproduced and confirmed here, then resolved by adding the file.
- `git diff --check`: clean, no whitespace/conflict markers.
- Payment path: confirmed byte-for-byte unchanged vs. `origin/main` —
  `functions/api/webhook.js`, `razorpay-checkout.js`, `verify.js` all show an
  empty diff.

## Known non-blocking issues / owner review items

- **Tamil translation gap** on About/Churches/Testimonies/Blog page *content*
  (structural i18n exists; per `15-major-milestone-status.md` this was
  already a known, tracked gap — not something this session's scope covers).
- **VBS 2026 event** has no real date/location yet and shows a plain color
  placeholder instead of a photo — intentional per migration `0025`'s
  comments (never invent a real date or fabricate a photo); ready for an
  admin to fill in via the Events panel once known.
- **Watch & Listen** and **Youth programs** show honest empty states in a
  fresh database — this is by design (no fabricated livestream URLs or youth
  programs), and resolves itself the moment an admin adds real ones through
  the existing panels.

## Migrations

`0023_programs_online_recurrence.sql`, `0024_seed_prayer_programs.sql`,
`0025_v2_launch_content_seed.sql`, `0026_member_appearance.sql` all exist,
are correctly ordered, additive-only (`ALTER TABLE ... ADD COLUMN` /
`INSERT ... WHERE NOT EXISTS` — no drops, renames, or retypes), and are all
listed in `.github/workflows/deploy-migrations.yml`'s dispatch dropdown. **No
migration was applied to production D1 this session** — that remains a
manual, owner-authorized step per `CONTRIBUTING.md` §4.

---

### Final gate

1. **Can a real user now review V2 end-to-end?** Yes, via `/v2/index.html`
   and its nav — see "How to review it" above.
2. **Which pages are ready?** All 13 `v2/*.html` pages.
3. **Which pages are not ready?** None blocking; see "Known non-blocking
   issues" for cosmetic/content gaps.
4. **What defects were fixed?** Missing footer nav on Our Giving/My Giving;
   mid-word description truncation on Events/Home/Blog/Testimonies cards.
5. **What tests actually ran?** `npm test` (499/499) and the full Playwright
   E2E suite (195/195), both executed in this session, not just cited.
6. **Did V1/payment behavior remain unchanged?** Yes — confirmed empty diff
   on the webhook/checkout/verify files; V1's root `/` dashboard is untouched.
7. **Are migrations handled by the existing workflow?** Yes —
   `deploy-migrations.yml` already lists all four; nothing new needed.
8. **What still requires human review?** Tamil content translation gap
   (tracked, pre-existing); the owner's own visual sign-off on copy/tone; and
   the eventual decision to merge to `main` and run the production migration
   workflow, both explicitly out of scope for this session.
