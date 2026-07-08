# Public-Site UI/UX Redesign — Review Notes

Branch: `claude/post-migration-safety-check-kf6gb4` · 2026-07-08

Covers the 5 items you asked for. Screenshots (light/dark × desktop/mobile, for
the dashboard, funds, members, and about pages) are attached separately —
please review those and send corrections before this merges. Nothing in this
batch has been merged or deployed.

## 1. Dashboard reorganized + "advanced" upgrades

**What was wrong:** `index.html` showed the same member-ranked data twice —
a "Top Contributors" grid (top 6) followed a few sections later by an "All
Contributors" grid that was the *same ranking*, just longer. There was no
chronological view anywhere — no way to see "what just happened" without
opening a specific member's history modal. Also a rendering bug: the trends
chart section (`renderEnhancedStats`) grabbed the DOM's *first* `.chart-card`
via `querySelector` and overwrote whatever was already there — fragile, and
on some layouts it clobbered a real chart.

**What changed** (`index.html`, `script.js`):
- Added a **Recent Activity** feed — a real chronological, per-transaction
  list (most recent 8), new `renderRecentActivityFeed()` in script.js. This
  didn't exist anywhere before.
- **All Contributors** is now sorted **A–Z** (new `getContributorsAlpha()`)
  instead of duplicating the Top-Contributors ranking — it now reads as a
  lookup directory, not a repeat of the leaderboard above it.
- Gave the trends section its own dedicated container
  (`#enhancedStatsContainer`) instead of hijacking the first pie-chart card —
  fixes the fragile-DOM-query bug.
- Page order top→bottom is now: stat KPIs → goal progress → **Recent
  Activity** → Giving Insights → member portal card → Top Contributors
  (leaderboard) → charts (category / distribution / source / trends) → All
  Contributors (A–Z directory) → wishlist.
- Applied the same fix to the Christmas Fund's separate render path
  (`initChristmasFundDashboard`), since it's a near-duplicate pipeline with
  its own copy of the same code.

## 2. Light / dark mode, "based on phone mode"

New `theme.css` + `theme.js`, loaded on all 6 public pages (`index`, `funds`,
`members`, `impact`, `member`, `about`):
- Detects the OS/browser color-scheme preference (`prefers-color-scheme`) on
  first visit and applies it immediately (no flash of the wrong theme).
  Live-updates if the phone's system theme changes while the tab is open.
- A toggle button (sun/moon) is injected into the navbar — one copy for
  desktop, one for the mobile header (since the mobile breakpoint hides the
  desktop nav in favor of the bottom tab bar). Manual choice is remembered
  (`localStorage`) and overrides the system default until changed again.
- Palette follows the same warm, editorial system you liked in the admin
  console (Lora serif headings / Inter body, soft cream light theme) with a
  matching warm-dark theme built for it — not just an inverted light theme.
- The brand's purple navbar/CTA gradient was left as-is in both themes — it
  already reads fine on dark backgrounds and is your recognizable identity;
  I didn't recolor the whole site to orange to match admin.html exactly.
- Dark-mode coverage: I went through every major surface (stat cards, chart
  cards, contributor cards, modals, tables, member cards, about-page cards,
  bible verse card, progress panel, mini stat cards inside the trends
  section) and gave each an explicit dark override, rather than trusting a
  single global variable flip — style.css has two duplicate `.stat-card` /
  `.insight-modal` rule blocks and a lot of hardcoded hex colors, so a pure
  variable-cascade approach would have missed things. I verified this by
  screenshotting every page in dark mode and fixing what was still white
  until nothing was left illegible.

## 3. Mobile bottom nav — Instagram/WhatsApp style

- The site already had a fixed bottom tab bar with a raised center action
  button on 3 of 6 pages, using emoji icons. It's now on **all 6 pages**
  (added to `funds.html`, `about.html`, `member.html`, which had none) with
  **consistent items** (Home / Members / Give / Bought / About) so it behaves
  like a persistent app-shell tab bar, not a per-page nav.
- Replaced emoji icons with a small inline SVG outline icon set (home,
  people, heart, bag, info) matching the outline style Instagram/WhatsApp
  use — `theme.js` swaps them in based on a `data-icon` attribute, no icon
  font or external asset.
- On mobile, the desktop nav links disappear and this bar takes over
  (that behavior already existed in style.css; it's now paired with the new
  icon set and applies everywhere).
- I did **not** touch `admin.html` — you said you loved it as-is, so it's
  unchanged. Happy to extend dark mode there too if you want it.

## 4. Testing performed

Ran everything against a local Cloudflare Pages dev server (`wrangler pages
dev`) with a local D1 database seeded with realistic multi-member data across
both funds, plus purchases — not against production. Used Playwright/Chromium
to screenshot every page at light/dark × desktop (1440px)/mobile (390px,
iPhone-sized). Fixed every dark-mode contrast issue the screenshots turned up
(progress panel, bible verse text, member-portal card, trends mini-cards,
chart backgrounds, about-page cards, toggle-button icon rendering) before
taking the final set attached to this message.

**Not tested:** the actual Razorpay checkout flow (no live payment gateway
in this sandbox) and Google Sign-In (blocked in a headless test browser) —
neither was touched by this change, only their surrounding page chrome.

## 5. Migration / sheet-data verification

I can't reach your production Cloudflare account from this sandbox (no
`wrangler login` credentials here), so I could not run this against the real
D1 database. What I *can* confirm:

- The `/api/verify` and `/api/selftest` endpoints built in the previous pass
  on this branch still work correctly and are unaffected by this frontend
  change — re-ran both against the local test database: **selftest 27/27**,
  **verify: 0 fail** (1 expected warning from deliberately-seeded future-dated
  test rows, not real data).
- **To actually verify your live production data**, sign in as an admin on
  the deployed site and open:
  - `GET /api/verify` — reconciles D1 against the live Google Sheet row-by-row
    (proof IDs, amounts, member lists) and flags any mismatch.
  - `GET /api/selftest` — expects 27/27.
  - Full runbook is in `POST_MIGRATION_SAFETY_REPORT.md` on this branch.

I did not run this against production and won't claim it's clean until you
(or I, with deploy access) actually run it there.
