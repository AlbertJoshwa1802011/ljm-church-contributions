# Admin Console Guide

`admin.html` is a single self-contained page (its own inline `<style>`/`<script>`, no external page-logic file) that every admin feature lives in, gated behind Google sign-in plus a role/permission check (see `functions/api/_lib.js`).

## Navigation structure

Everything is organized into 5 top-level groups, each expanding to its pages:

| Group | Pages | What it's for |
|---|---|---|
| **Overview** | Overview | Dashboard KPIs, giving trend, fund distribution, recent contributions |
| **Giving** | Funds, Contributions, Sandha, Purchases, Expenses | Money in and money out |
| **People** | Members, Families | The church directory and household grouping |
| **Content** | Wishlist, Verses, About page | What believers see on the public site, editable without a code deploy |
| **Admin** | Roles, Audit log, Settings, Self-test | Permissions, configuration, and system health |

**Desktop**: the sidebar is an accordion — clicking a group header expands its pages and collapses the others; navigating to a page (including via a `#hash` link or browser back/forward) automatically opens the group it belongs to, so the sidebar always shows "you are here."

**Mobile**: the bottom bar shows only the 5 group icons — never a horizontally-scrolling strip of every page. Tapping a group opens a slide-up sheet listing that group's pages (the same visual pattern as the public site's mobile "More" menu, reusing its `.ljmh-sheet-*` styles).

This replaced a single flat list of 13 pages that was rendered **twice** (once into the desktop sidebar, once into a horizontally-scrolling mobile strip) from one `NAV` array — the same list, duplicated DOM/event-listener surface, no grouping. If you're adding a new admin page, add it to the appropriate group in the `NAV_GROUPS` array near the top of the `<script>` block (search for `var NAV_GROUPS`) — everything else (sidebar rendering, mobile sheet, hash routing, active-state highlighting) derives from that one array.

## Sticky section headers

Each section's title/description block (`.page-head`) is `position: sticky` at the top of the scrollable area, so it stays visible while you scroll through a long section (e.g. a big Contributions table) instead of scrolling away with the content. This uses the standard "negative-margin bleed + sticky" technique — `main`'s own padding is temporarily cancelled and re-applied as the header's own padding, so the sticky bar visually spans the full content width. The page itself still scrolls at the document level (no new internal `overflow: auto` box was introduced) — only the sidebar's own nav list scrolls independently, which was already true before this change.

## Dark mode

The whole console now supports dark mode (previously it was permanently light-themed, deliberately left alone during an earlier redesign pass). A toggle button (🌙/☀️) sits next to the "LJM Console" brand mark in the sidebar. See [THEME_AND_DESIGN_SYSTEM.md](THEME_AND_DESIGN_SYSTEM.md) for how the palette itself works.

## Permissions

Every admin action is gated server-side by a permission scope (checked in the relevant `functions/api/*.js` file via `requireAuth(context, "scope_name")`), not just hidden in the UI. Current scopes: `edit_purchases`, `edit_wishlist`, `manage_roles`, `view_members`, `manage_funds`, `delete_funds`, `view_audit`, `manage_expenses`, `manage_sandha`, `manage_members` (families), `manage_content` (About page + Bible verse import). Manage who has which scopes from **Admin → Roles**. `super_admin` (and the three hardcoded bootstrap emails in `_lib.js`) always has every scope.

## Content the pastor can edit without a deploy

Three admin sections exist specifically so the site's content stays current without an engineer touching code:

- **Content → About page**: the entire public About page — hero text, mission cards, Bible verses shown there, the motivation banner and its buttons, and the "Connect With Us" links — all editable as structured fields (add/remove rows for each list), stored as one JSON setting (`about_content`). See the About page section of the admin form for the exact fields.
- **Content → Verses**: the Verse of the Month/Year cards shown on the dashboard and to signed-in believers. Search by reference (e.g. `Philippians 4:13`) or keyword, click a result to fill in the reference and text — see [BIBLE_VERSES.md](BIBLE_VERSES.md).
- **Admin → Settings**: force-login toggle, fund goals, and pastor contact info (name, phone, email, address) — shown at the top of every public page and in the mobile "More" menu.

## Families & Sandha

See [FAMILIES_AND_SANDHA.md](FAMILIES_AND_SANDHA.md) — this is substantial enough to warrant its own document.
