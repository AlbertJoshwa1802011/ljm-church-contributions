# Admin Console UI Improvements — Progress & Pending Tasks (memory for follow-up agents)

> Purpose: A durable, hand-off record of **completed** admin console UI/UX enhancements and **pending** improvements so a future session/agent can pick it up. Last updated: 2026-07-14.

---

## ✅ Already shipped (live on `main` / production)

### PR #8: Polish admin console UI (KPI cards, tables, empty states)
**Merged:** 2026-07-XX | **Commit:** `10045dd`

- **KPI Cards** (Overview section):
  - Redesigned `.kpi` class with icon chip, primary metric, and trend indicator (▲ green up / ▼ red down / → flat)
  - Added `kpi()` function signature: `kpi({ icon, primary, trend: {dir, text} })`
  - Hover lift effect for interactivity
  - Updated Overview KPI rendering: fund count, member count, expense trend
  
- **Table Improvements**:
  - Sticky headers (`.sticky-header` + `position: sticky; top: 0`)
  - Zebra striping (alternating row background colors)
  - Tabular-nums class for right-aligned numeric columns
  - Consistent styling across all data tables
  
- **Empty States**:
  - Data-icon attributes for visual glyphs when no records exist
  - Clear messaging and icon consistency
  
- **Layout Fixes**:
  - Profile button overlap fix: reserved right padding on `.page-head`
  - Flexbox constraints to prevent text overflow on narrow viewports

### PR #9: Fix invisible sign-in button (GIS async load)
**Merged:** 2026-07-XX | **Commit:** `0c9ac75`

- Fixed race condition where Google Identity Services loads async
- Prevents login button from disappearing before GIS is ready
- Auth gate properly waits for identity provider initialization

### PR #13: Add native-feeling global search 🔍
**Merged:** 2026-07-14 | **Commits:** `1bfb6dd` + merge commit `3a7d4e5`

#### Backend (`functions/api/search.js` — NEW)
- **Endpoint:** `GET /api/search?q=<query>`
- **Cross-entity search** across:
  - Members (by name, email, phone)
  - Families (by family_name, primary_phone, primary_email)
  - Funds (by name, slug, description)
  - Purchases (by name, vendor, description)
  - Wishlist items (by item_name, notes)
- **Permission gating:** Each category locked behind its own scope:
  - `view_members` → members + families
  - `manage_funds` → funds
  - `edit_purchases` → purchases
  - `edit_wishlist` → wishlist
- **Query validation:** Rejects queries < 2 chars (instant return, no DB hit)
- **Performance:** Parallel task execution with `Promise.all()` for all queries
- **Response format:** `{ success: true, results: { members: [...], families: [...], funds: [...], purchases: [...], wishlist: [...] } }`

#### Frontend (`admin.html` — MODIFIED)
- **Search UI** — Full-screen modal sheet (iOS Spotlight style):
  - Triggered by:
    - 🔍 search icon button in header (next to profile shortcut)
    - "/" keyboard shortcut (global hotkey)
    - ESC to close
  - **Topbar:** Search icon + input field + "Cancel" button
  - **Results grid:** Multiple columns depending on viewport width
  - **Spring easing animation:** `.ss-panel` uses `cubic-bezier(0.34, 1.56, 0.64, 1)` for native feel
  
- **Search behavior**:
  - **Client-side instant results:** `pagesMatching(q)` returns matching page names from `NAV_GROUPS` instantly as user types
  - **Debounced API call:** 220ms delay before fetching `/api/search` to reduce server load
  - **Sequence ID (`searchSeq`):** Discards stale API responses if user types faster than API responds
  - **Smart result navigation:** `goToSearchResult(cat, record)` pre-fills filter inputs on landing pages
  
- **CSS improvements**:
  - **Flexbox fixes:** `min-width: 0` on flex containers to prevent text overflow on narrow phones (320px–430px tested)
  - **Overflow handling:** `overflow: hidden` + `text-overflow: ellipsis` for proper text truncation
  - **Safe-area-inset:** `calc(14px + env(safe-area-inset-top))` for mobile notches
  - **Dark mode:** Token-based CSS variables from `theme.css` (prefers-color-scheme)
  - **Result styling:** Icon + text per entity type, SEARCH_CATS metadata object
  
- **JavaScript functions** (in `admin.html` `<script>`):
  - `openSearchSheet()` — Display modal, focus input
  - `closeSearchSheet()` — Hide modal, clear input
  - `renderSearchResults(query)` — Render both client-side pages and API results
  - `pagesMatching(q)` — Client-side instant matching against NAV_GROUPS
  - `goToSearchResult(cat, record)` — Navigate to section, pre-fill filters
  - `wireSearchSheet()` — Event handlers (trigger click, "/" key, ESC, input debounce)
  
- **Result categories (SEARCH_CATS)**:
  - Members → icon 👤, lands on Members page
  - Families → icon 👨‍👩‍👧‍👦, lands on Members/Families tab
  - Funds → icon 💰, lands on Funds page
  - Purchases → icon 🛒, lands on Funds/Purchases tab
  - Wishlist → icon 🎁, lands on Funds/Wishlist tab

#### Tests (`tests/api/search.test.mjs` — NEW)
4 comprehensive tests:
1. **Too-short query** — Returns `{ success: true, results: {} }` without DB hit
2. **Cross-entity matching** — Finds members by partial name + seeded funds by name
3. **Permission filtering** — Scoped token (wishlist_only) sees NO members/families/funds, only wishlist results
4. **Authentication** — Rejects unauthenticated requests (401 status)

**Test coverage:** All 40 tests pass (36 existing + 4 new)

---

## ⏳ PENDING

### 1. Further native app feel enhancements (future polish)

**Why:** The admin console should feel like a native iOS/Android app, not a web admin dashboard. Already implemented:
- Search sheet with spring easing (iOS Spotlight-like)
- KPI cards with trend indicators
- Safe-area-inset handling for notches
- Flexbox layout that shrinks properly on 320px–430px widths

**Potential improvements (backlog, low priority):**
- **Bottom navigation bar:** Move section nav to a sticky footer bar (iOS tabbar pattern) instead of top nav
- **Haptic feedback:** Add CSS or JS-based haptic triggers on button presses (native feedback)
- **Gesture support:** Swipe-right to go back, swipe-up to dismiss sheets
- **Page transitions:** Slide/fade animations between sections (not just instant switches)
- **Floating action buttons (FABs):** Prominent "+" button for adding records (member, fund, etc.)
- **Pull-to-refresh:** Reload data on pull-down gesture
- **Status bar styling:** Color-coded status bar (green for live, amber for draft) that matches theme

**Files to consider touching:**
- `admin.html` — Add new layout patterns, gesture handlers, animation classes
- `style.css` — Add transition keyframes, safe-area handling for notch + home indicator
- `script.js` — Gesture recognition (touch events), haptic triggers via `navigator.vibrate()`

**Decision needed:** Prioritize which of these align with the trustee's vision. Some (FABs, pull-to-refresh) may conflict with existing workflows.

### 2. Search feature polish (low-priority enhancements)

- **Recent searches:** Cache last 5–10 searches locally (localStorage) and show them above results when input is empty
- **Search analytics:** Log which entities are searched most to inform future features
- **Autocomplete suggestions:** Pre-populate search field with common queries or trending searches
- **Search filters in results:** Add facets (e.g. "Members (3) | Families (1) | Funds (2)") to narrow results interactively
- **Keyboard navigation:** Arrow keys to navigate result items, Enter to select (accessibility)

**Files:**
- `admin.html` — Extend `wireSearchSheet()` and `renderSearchResults()` logic

### 3. Mobile responsiveness audit (regression prevention)

After future changes, re-verify:
- Tested widths: iPhone SE (375px), iPhone 12 mini (375px), iPhone 14+ (430px), iPhone 6 (320px)
- **Sticky headers:** Don't overlap input or other elements on narrow viewports
- **Button overflow:** All buttons (Cancel, Save, Delete) fit without wrapping
- **Text truncation:** Long names/emails truncate properly with `text-overflow: ellipsis`
- **Safe-area-inset:** Notch + home indicator don't cover interactive elements

**Regression test:** `tests/frontend/admin-layout.test.mjs` or similar (currently doesn't exist; consider adding)

### 4. Accessibility improvements (backlog)

- **ARIA labels:** Add `aria-label` to search icon, modal, results grid
- **Keyboard-only navigation:** Tab through search results, arrow keys to move, Enter to select
- **Screen reader testing:** Verify result announcements and modal structure
- **Contrast ratios:** Verify all text meets WCAG AA minimum (currently using token variables, should be OK)
- **Focus management:** Search sheet should trap focus (modal pattern)

**Files:**
- `admin.html` — Add ARIA attributes, role="dialog" to search sheet

---

## How to pick this up (for future agents)

### Current state
- ✅ PR #13 merged to `main` (global search live)
- ✅ All 40 tests pass
- ✅ Deployment workflow auto-runs on push to main
- ✅ Admin console has iOS Spotlight-style search, KPI cards, improved tables

### If working on pending tasks:
1. **Create a new feature branch** from `main`:
   ```bash
   git checkout -b claude/admin-console-<feature-name>
   ```
2. Make changes to relevant files (listed in each pending task)
3. Add tests if applicable (e.g., new search behaviors, layout regression tests)
4. Run `npm test` to ensure all 40+ tests pass
5. **Commit with clear message** (one logical commit or related set)
6. **Create PR** with description referencing this file
7. Verify in browser at iPhone widths (use Chrome DevTools or `npx wrangler pages dev .`)
8. **Request review** from trustee/project lead
9. **Merge when approved**

### Testing checklist
- `npm test` passes (all 40+ tests)
- Tested in browser at: 320px, 375px, 390px, 430px widths
- Dark mode rendered correctly (toggle in bottom-right corner)
- Search sheet (if touched): Opens/closes on click and "/" key, ESC closes, input debounce works
- No JavaScript errors in browser console

### Key code references
- **Search API:** `functions/api/search.js` (REST endpoint + permission gating)
- **Search UI:** `admin.html` — search `// === GLOBAL SEARCH ===` block
- **Search tests:** `tests/api/search.test.mjs`
- **Style tokens:** `theme.css` (CSS variables for light/dark mode)
- **Layout baseline:** `style.css` (flex, safe-area-inset, sticky headers)
- **KPI rendering:** `admin.html` — search `kpi({` to see usage pattern

---

## Notes for future agents

1. **Keep this file updated** after each PR/session. Update the "Last updated" date and summarize what was completed.
2. **Test on real mobile devices or Chrome DevTools** at these widths (they're common iPhone sizes):
   - 320px (iPhone 6)
   - 375px (iPhone SE, 12 mini)
   - 390px (iPhone 14)
   - 430px (iPhone 14+, 15+)
3. **Dark mode matters.** Always test both light and dark themes. Use the toggle button in the bottom-right corner of admin.html.
4. **Ask the trustee** before implementing any "native app" features that might change workflows (FABs, bottom nav, pull-to-refresh).
5. **Performance:** Keep API queries fast. Parallelize DB calls with `Promise.all()` where possible. Monitor the debounce delay (currently 220ms for search).
6. **No breaking changes:** The schema, API routes, and permission scopes are stable. Additions are OK; removals risk breaking existing workflows.
