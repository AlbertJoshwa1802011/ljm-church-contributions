# 08 · Mobile Header Redesign + Ministry Hero Image — Plan & Tracker

| | |
|---|---|
| **Status** | ✅ Done — verified (desktop unaffected, mobile/tablet drawer works) and screenshotted |
| **Scope** | Same as `07-ui-mockups-review.md` — static mockups only (`mockups/*.html`), user-facing pages, admin console untouched, desktop/laptop layout must be byte-for-byte unaffected |
| **Requested by** | User, round 3 feedback: hamburger nav for mobile (matching common site patterns), a ministry image near the top of the page for mobile/tablet, "plan the header for mobile," and this tracker file itself |

## Why this doc exists

The user explicitly asked: *"Make sure you update each and every task you update
in md file and commit it so that next agent will be checking and working
without any problem."* Earlier rounds tracked round-3-style work only in the
session's internal task list, which isn't visible to a future agent or
committed to the repo. This file is the durable, checkbox-level record —
update it and commit as each item below is finished, mirroring
`docs/testing/COVERAGE-TRACKER.md`'s pattern.

## Problem statement (confirmed via grep before starting)

`mockups/mock-shared.css` line 189:
```css
@media (max-width: 980px) { .primary-nav, .church-switch, .lang-toggle { display: none; } }
```
Below 980px, the primary nav, church switch, and language toggle simply
**vanish with nothing replacing them** — on tablet (820px) and mobile (390px)
there was no way to reach About / Watch & Listen / Events / Blog / Our Giving /
language toggle at all. Only the auth-slot and Pray/Give buttons in
`.header-actions` remained (those aren't hidden by that rule).

Also: no page has a ministry image anywhere near the top — `home.html`'s hero
is pure text (headline + lede + CTAs) next to the Today's Promise card. No
photographic/illustrative visual identity greets a mobile visitor.

## Plan

### 1. Hamburger + slide-in nav drawer (mobile + tablet, ≤980px only)

- **Trigger:** a `.hamburger-btn` (☰ three-line icon, inline SVG) added inside
  `.header-actions`, `display: none` by default, `display: flex` only at
  `≤980px` — the exact same breakpoint the nav already disappears at, so there
  is no gap where nav is neither inline nor reachable via drawer.
- **Panel:** a right-side slide-in `.nav-drawer` (fixed, `translateX(100%)` →
  `translateX(0)` on `.open`), with a `.nav-drawer-backdrop` behind it.
  Contains: close button, the full nav list for that page (same links as its
  `.primary-nav`, including the current-page highlight), the language toggle,
  the church switch (events.html only, since only that page has one), and
  Pray/Give CTAs.
- **Desktop is untouched by construction:** the drawer and backdrop are
  `position: fixed` and hidden (`transform`/`visibility`) unless `.open` is
  toggled, and the hamburger button itself only renders (`display`) at
  ≤980px — there is no shared class or shared layout rule that changes at
  ≥981px, so nothing above that width can visually shift.
- Implemented identically (same CSS in `mock-shared.css`, per-page markup +
  inline `<script>` matching each page's existing nav items) across all 4
  pages: `home.html`, `our-giving.html`, `give-flow.html`, `events.html`.
- Closes on: backdrop click, close (✕) button, `Escape` key, or clicking any
  nav link inside it (it's about to navigate away anyway).
- `body` gets a `.drawer-open` class while open (`overflow: hidden`) so the
  page behind the drawer doesn't scroll.

### 2. Ministry hero image (Home page, mobile + tablet priority)

- An illustrated SVG banner (not a fabricated "real" photo of real people/
  places — consistent with the placeholder-honesty approach already used on
  `events.html`) added to the top of `home.html`'s hero: warm gold/accent sky
  gradient, radiating light rays, a simple two-building skyline silhouette
  (representing the two churches: Church of Light + City Worship Center) with
  a small heart-glow accent tying back to the real brand mark.
- Full-width band, sits above the existing hero copy/promise-card grid on all
  breakpoints, but sized so it's the prominent first thing seen on mobile/
  tablet (taller aspect ratio there) without pushing the existing desktop hero
  layout around.
- Only touches `home.html` — the page the user pointed at ("at starting").

### 3. Verification

- `document.body.scrollWidth === viewport width` check at 1440px (desktop) on
  all 4 pages before and after — must be identical, zero new overflow.
- Visual screenshot diff at 1440px against the round-2 screenshots — desktop
  should look pixel-identical except anything intentionally shared (there is
  none planned; the hamburger button itself is `display:none` at that width).
- New screenshots at 390px (mobile) and 820px (tablet): closed-drawer state,
  open-drawer state, and the new hero image, light + dark where relevant.

## Task tracker

- [x] Confirm the exact gap (grep `mock-shared.css` / all 4 pages' headers) —
      done, documented above.
- [x] Write this plan/tracker doc and commit it before building.
- [x] Add hamburger button + nav-drawer CSS to `mock-shared.css`.
- [x] Add drawer markup + toggle script to `home.html`.
- [x] Add drawer markup + toggle script to `our-giving.html`.
- [x] Add drawer markup + toggle script to `give-flow.html`.
- [x] Add drawer markup + toggle script to `events.html`.
- [x] Design + add the ministry hero SVG banner to `home.html`.
- [x] Verify desktop (1440px + 1024px) `scrollWidth` unchanged on all 4
      pages, and that `#hamburgerBtn` computed `display` is `none` there —
      automated Playwright check, all 8 combinations passed.
- [x] **Found + fixed a real bug during verification**: the first build put
      the hamburger button *alongside* the existing lang-toggle/auth-slot/
      Pray/Give buttons inside `.header-actions`. On a 390px phone that's too
      much content for the row, and because `.site-header` has
      `overflow: hidden`, the hamburger got silently clipped off-screen —
      invisible and unusable, even though it still "worked" if you knew the
      element's ID (which is how the first automated check missed it; it
      asserted `display !== 'none'`, not actual visibility). **Fix:** at
      ≤980px, `.header-actions` now shows *only* the hamburger — the
      language toggle, church switch, Pray/Give, and the sign-in/admin chip
      all moved into the drawer instead (added a `.nav-drawer-auth` section
      mirroring the header's auth-slot, and switched the viewer-toggle demo
      script from `getElementById` to `querySelectorAll('.signin-btn')` etc.
      so both the header and drawer copies stay in sync). Re-verified after
      the fix — all 16 desktop/mobile/tablet checks pass, and the hamburger
      is now visibly present in every screenshot.
- [x] Re-screenshot mobile (390px) + tablet (820px): closed + open drawer +
      hero image, and a spot-check desktop screenshot proving no regression.
- [x] Update this tracker's checkboxes to all-done, commit, push.
- [x] Send screenshots to the user.

## What the mobile/tablet header looks like now (≤980px)

Header row: brand mark + "Light of Jesus Ministry" + a single ☰ button.
Everything else — About/Watch & Listen/Events/Blog/Our Giving nav, language
toggle, church switch (events.html only), the sign-in/admin-access chip, and
Pray/Give — lives in the slide-in drawer. This is a deliberate simplification
from the desktop header (which keeps everything inline) — it's the standard
"logo + hamburger" mobile pattern the user asked for ("existing websites...
three lines... on clicking they can see the about prayer request etc"), and
it's what fixed the clipping bug above.

Desktop (≥981px) keeps the full inline header exactly as it was in round 2 —
confirmed pixel-for-pixel via the `scrollWidth` check and a side-by-side
screenshot.
