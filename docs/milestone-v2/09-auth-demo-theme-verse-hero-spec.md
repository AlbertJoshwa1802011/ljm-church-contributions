# 09 · Round 4: Sign-in demo, theme switch, verse rotation, hero image spec

| | |
|---|---|
| **Status** | ✅ Done — verified (desktop unaffected, all interactions work) and screenshotted |
| **Scope** | Same static-mockup rules as `07`/`08` — no backend/API/`script.js` changes, admin console untouched |
| **Requested by** | User, round 4 feedback (see below) |

## What was asked, verbatim intent

1. Move the light/dark switch to the bottom as a small, quiet icon switch —
   not two loud labeled "Light / Dark" buttons announcing the option exists.
2. Remove the Guest/Member/Admin demo switcher. In the real product, sign-in
   is global (anyone signs in with Google) and whether you're an admin is
   determined automatically after that — so the preview should show *that*
   flow instead: click "Sign in" → see the signed-in/admin state, not a
   3-way role picker.
3. "Is the blue design-preview banner at the top of mobile finished or not?"
   — direct question, answered in §4 below.
4. Auto-advancing verse rotation: when logged in, cycle to the next
   verse/promise automatically on an interval.
5. Give exact pixel dimensions for the hero image so the pastor's real photo
   (in the spirit of Jesus Calls / Jesus Redeems) can be supplied later, sized
   correctly for desktop, tablet, and mobile — and note that admin should be
   able to upload separate images per breakpoint.

## 1. Sign-in demo replaces the viewer-toggle

Removed `.viewer-toggle` (the fixed Guest/Member/Admin pill) from every page.
Clicking **"Sign in"** (header or drawer) now flips straight to the signed-in
state — avatar, name, and (since our demo persona has admin rights) the gold
**"⚡ Admin Access"** pill — simulating what happens the instant Google OAuth
completes and the backend looks up the account's role. Clicking the avatar
chip signs back out. This matches the real flow exactly: **there is no
role-picker in production; the role comes back from the account lookup**,
so the preview shouldn't imply otherwise.

## 2. Theme switch — small icon, not a labeled announcement

Replaced the two-button "☀ Light / ● Dark" pill with a single small (42px)
circular icon button, bottom-right, that swaps a sun/moon glyph on click.
Same functionality, far less "look, there's a setting here" presence.

## 3. Verse auto-rotation (Today's Promise card)

Added a small rotator to Home's promise card: it cycles through a short list
of sample verses automatically (every 8s, with a fade), with small dot
indicators so it's clear content is rotating rather than static.

**Flagged, not assumed:** this is a genuinely new feature — nothing in the
current product schedules a "verse of the day" or rotates promises. The real
Bible content already has a full backend (`functions/api/bible.js` — a
KJV/version dictionary with `lookup`/`search`/`books`/`chapters` actions used
today by the admin's manual verse picker), but there's no existing table or
schedule of *which* verses to feature or in what order/interval. Two ways to
implement this for real, worth your call before it's built:
- **Simplest:** the pastor/admin curates an ordered list of references (e.g.
  in a small new `promises` table or a JSON setting), and the frontend
  fetches + rotates through those via the existing `bible.js` `lookup`
  action.
- **Automatic:** pick a verse algorithmically (e.g. day-of-year indexed into
  a version) — needs no curation but loses the "chosen with intention" feel
  a promise page usually has.
The mockup demonstrates the *rotation interaction* with a hardcoded sample
array; wiring it to real content is new backend surface (needs its own
tests per `CONTRIBUTING.md`) and isn't built yet.

## 4. The blue "Design preview" banner — is it finished?

No — and it's not supposed to look finished. That banner (`.mock-banner`,
solid blue/navy, "🎨 Design preview — Home · static, no live data...") is
explicitly mockup-only chrome, same category as the theme switch and the old
viewer-toggle — see the code comment directly above it in
`mock-shared.css`: `/* ---- Mockup-only chrome (not part of the real site)
---- */`. It exists purely so that when you open these files, it's obvious
you're looking at a design review artifact and not the live site. It — and
the light/dark + sign-in preview controls — **disappear entirely** the
moment this design becomes real implementation on `index.html`/`script.js`.
Nothing to fix here; it's working as intended.

## 5. Hero image — exact dimensions for the real photo

The current hero banner (the illustrated skyline SVG placeholder, sitting
directly under the header) already renders as a **fixed-height, full-width
band** — its CSS never changes, only what fills it will. Real photography
should be supplied as **three separate crops**, one per breakpoint, because
the band's proportions genuinely change shape across screen sizes (wide and
short on desktop, taller and narrower on mobile) — a single image stretched
across all three would look squeezed or cropped wrong somewhere.

| Breakpoint | Recommended upload size | Aspect ratio | Rendered as |
|---|---|---|---|
| **Desktop / laptop** (≥981px wide) | **2400 × 460 px** | ~5.2 : 1 (wide letterbox) | Full browser width × 230px tall (fixed) |
| **Tablet** (641–980px) | **1600 × 600 px** | ~2.7 : 1 | Full width × up to 300px tall |
| **Mobile** (≤640px) | **1200 × 460 px** | ~2.6 : 1 | Full width × 230px tall (fixed) |

Notes for the pastor / whoever supplies the photos:
- These are **minimum recommended** sizes (already accounting for sharp
  rendering on retina/high-DPI phones and tablets) — larger is fine, smaller
  will look soft.
- **Exact pixel match isn't required** — the frontend uses `object-fit:
  cover` with `object-position: center`, so it automatically crops to fill
  the box. What actually matters is: (a) matching the **aspect ratio** above
  reasonably closely, so the automatic crop doesn't cut off something
  important, and (b) keeping the main subject (faces, the church building,
  whatever the pastor wants featured) **centered** — the edges are what get
  trimmed differently at each breakpoint, the center is always kept.
- Format: JPG or WebP, sRGB color, ideally under ~400KB each after
  compression so it doesn't slow down the page on mobile data.
- **Three separate photos, not one photo resized three ways** — the mobile
  crop especially may want a tighter, more vertical composition than the
  wide desktop banner, exactly per your ask ("admin can upload multiple same
  photos for phone, laptop, tablet").

**Implemented now:** `home.html`'s hero section uses a real `<picture>`
element with three `<source media>` breakpoints pointing at
`mockups/assets/hero/hero-desktop.jpg` / `hero-tablet.jpg` / `hero-mobile.jpg`
— i.e. the exact mechanism described above, wired and ready. Those three
files don't exist yet (no real photos to put there), so it gracefully falls
back to the illustrated SVG banner already built (via `onerror`) — nothing
looks broken today, and the moment three real files are dropped into that
folder at those names, they replace the illustration automatically with zero
further code changes.

**Not yet built (flagging, not assuming):** an admin upload UI for these three
images. That's new backend surface (storage + an API endpoint, similar to
how `events.js`/`events/photo.js` already handle event photo uploads to R2)
plus an admin console screen — out of scope for this design-review round per
your standing instruction to leave the admin console alone, and would need
its own tests before shipping per `CONTRIBUTING.md`. For now, dropping the
three files directly into the deployed site's `assets/hero/` folder (by
whoever has repo/deploy access) achieves the same result without new code.

## Task tracker

- [x] Write this doc, commit before building.
- [x] Remove viewer-toggle; wire sign-in-click demo (all 4 pages) — clicking
      "Sign in" now flips to signed-in-admin state; clicking the avatar
      signs back out. Note: since the drawer closes on any link click,
      tapping "Sign in" inside the mobile drawer closes it and reveals the
      signed-in state — reopen the drawer to see the avatar/admin pill
      there too (the mobile header itself only ever shows brand+hamburger
      per round 3's design, by intent).
- [x] Restyle theme toggle to icon switch (all 4 pages) — single 42px
      circular button, sun/moon glyph swaps on click.
- [x] Add verse auto-rotation to Home's promise card — 4 sample verses,
      8s interval, fade transition, clickable dot indicators.
- [x] Add responsive `<picture>` + SVG fallback + dimension spec (above).
- [x] Verify desktop (1440/1024px) unaffected — automated Playwright check:
      scrollWidth unchanged, hamburger still hidden, theme-toggle present,
      on all 4 pages at both widths. Also verified the sign-in/theme-toggle/
      hero-fallback/verse-rotator interactions all function correctly.
- [x] Re-screenshot + update this tracker to done + commit + push.
- [x] Send screenshots + answers to the user.
