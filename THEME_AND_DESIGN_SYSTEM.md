# Theme & Design System

## Token system

All colors are CSS custom properties defined once in `theme.css`, and consumed everywhere else as `var(--token-name, <fallback>)`. There are two blocks:

```css
:root { --bg: #faf9f5; --surface: #ffffff; --accent: #d97757; ... }        /* light (default) */
[data-theme="dark"] { --bg: #16140f; --surface: #232019; --accent: #e2825f; ... }  /* dark */
```

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#faf9f5` | `#16140f` | Page background |
| `--bg-soft` | `#f4f2ec` | `#1c1a14` | Subtle recessed panels |
| `--surface` | `#ffffff` | `#232019` | Cards, modals |
| `--border` / `--border-strong` | warm greys | warm greys (translucent) | Dividers, card borders |
| `--text` / `--text-soft` / `--text-faint` | near-black → grey | near-white → grey | Text hierarchy |
| `--accent` / `--accent-deep` / `--accent-soft` | `#3D6079` Wedgwood | `#5E90AB` (lifted) | Brand color, CTAs, active states (member-selectable — see below) |
| `--green` / `--red` / `--amber` / `--info` | semantic hues | softened equivalents | Status colors (paid/error/warning/neutral-distinct) |
| `--radius` / `--shadow` / `--shadow-lift` | — | — | Shared corner radius and elevation shadows |

Switching `data-theme` on `<html>` (done by `theme.js`) is the *only* thing that needs to happen for a component to re-theme — as long as it's written with `var(--token)` instead of a literal color, it gets dark mode for free.

## User-selectable accent themes (the "Appearance" panel)

The three `--accent*` values above are the *default* (**Wedgwood**, a muted dusty blue). Members can swap the accent to any of a curated **"English heritage"** collection — Wedgwood, Sage, Heather, Aubergine, Claret, Terracotta, Ochre, Teal, Slate — independently for light and dark mode, from the **Appearance** panel (palette button in the header, plus entries in the avatar menu and the mobile "More" sheet). These are muted, sophisticated tones (Farrow & Ball–style) rather than bright primaries. The choice is saved on the device and — when signed in — synced to the member's account so it follows them across devices.

**How it works (no new per-component code):** because the entire app derives from `--accent` / `--accent-deep` / `--accent-soft` (and the `--google-*` aliases point at them), re-theming is just a matter of overriding those three tokens. `theme.js` does this by writing them as **inline styles on `<html>`**, which win over both the `:root` and `[data-theme="dark"]` blocks. So a component written with `var(--accent)` picks up the member's chosen accent for free, in both modes.

Key pieces:
- **`theme.js`** owns the palette catalog (`PALETTES`), the pre-paint `applyAccent()` (called at load *before* first paint, so there's no color flash), and the `window.LJMTheme` accent API: `getPalettes()`, `getAccent(mode)`, `setAccent(mode, id)`, `resetAccent()`. Selection is stored per mode in `localStorage` (`ljmAccentLight` / `ljmAccentDark`, palette ids, default `wedgwood`). `applyAccent()` also sets a `data-accent` attribute so canvas consumers (the progress ring in `script.js`) can redraw on an accent-only change.
- **`appearance.js`** is the panel UI (mode segmented control + swatch grid + live preview) and the account-sync layer. It's device-local first (instant, offline-safe, works signed-out); when signed in it GETs `/api/appearance` on load to rehydrate and PUTs on change.
- **`functions/api/appearance.js`** + **`member_preferences`** table (`migrations/0011_member_appearance.sql`) store `{ email, accent_light, accent_dark }`, keyed by the **verified** Google email (writes reject unverified/legacy tokens). Identity is resolved with the shared `resolveViewer` in `_lib.js` (member self-service), not `requireAuth` (admin-only).

**Every palette's light and dark triplet is WCAG-AA validated** against the real `--bg`/`--surface` colors (accent-deep text ≥4.5:1 — mostly AAA; white-on-accent button ≥3:1). Palette ids are stored (not raw hex), so the exact colors can be re-tuned in `theme.js` without a data migration. To add a palette, add one entry to `PALETTES` in `theme.js` **and** its id to `PALETTE_IDS` in `functions/api/appearance.js` (the server-side whitelist).

## Why the dark palette isn't pure black

The dark theme uses a warm near-black elevation scale (`#16140f` → `#1c1a14` → `#232019`) rather than a stark OLED black, echoing the light theme's warm-paper tone instead of jumping to a cold, stark black. This is the same reasoning most platforms' dark-mode guidelines give for avoiding true `#000`: it reads as more premium and is easier on the eyes at night, while still giving cards a visible "step up" in elevation.

- **`--info` is a separate token** (`#3f7a94` light / `#6fa8c2` dark, a muted teal) so that a 4th or 5th distinct chart/stat-card hue doesn't have to reuse the primary brand color. Where a distinct hue was needed (e.g. the Overview stat-card row: goal/collected/remaining/count), `--info` fills that role.

## The accent color: a tuned pair per theme

The brand accent was previously a warm terracotta, then a bright indigo; it's now **Wedgwood** (a muted dusty blue) by default, part of the member-selectable "English heritage" collection. Whatever the palette, each one carries a **distinct value per theme**, not one color reused — a principle worth keeping when adding palettes:

- **Apple's HIG** treats `systemBlue`/`systemIndigo` as dynamic semantic colors — the dark variant is a distinct, slightly shifted value tuned for that surface, not the light one over a dark background.
- **Material Design 3**'s tonal-palette system maps "Primary" to a *darker* tone in light mode and a *lighter* tone in dark mode — the same tone is never reused as-is across both themes.

So every palette in `PALETTES` (theme.js) has a `light` and a `dark` triplet (`a` = `--accent`, `d` = `--accent-deep`, `s` = `--accent-soft`). The light `a` is dark enough for white button text (≥4.5:1); the dark `a` is a medium "dusty" tone that both reads as colored text on the dark surface (≥4.5:1) *and* takes white button text (≥3:1). The Wedgwood default is `#3D6079`/`#2E4A5E`/`#E8ECEF` (light) and `#5E90AB`/`#A9C7DB`/`rgba(94,144,171,0.16)` (dark).

## The purple/indigo purge (historical)

An earlier pass removed a legacy blue-purple brand gradient (`#667eea` → `#764ba2`, left over from a pre-`theme.css` design) from `style.css`, `script.js`, `impact.html`/`impact.js`, `members.html`, `index.html`, `admin.html`'s chart palette, and `admin-session.js`'s floating admin-mode bar, replacing it with the shared `--accent` token system. Noted here only so it isn't confused with the current accent work.

Two categories of replacement were used, depending on context:
- **CSS contexts** (stylesheets, inline `style="..."` on real DOM elements) → `var(--accent, #d97757)` etc., so the color is theme-reactive.
- **Chart.js / Canvas 2D contexts** → literal hex values matching the token's current value. Canvas doesn't resolve CSS custom properties, so a chart's colors are fixed at the moment it's drawn — this is a pre-existing limitation of the charting approach, not something introduced here. (A chart isn't automatically re-colored if you toggle dark mode without also re-rendering it; that was already true before this change.)

## Admin console now shares the same tokens

`admin.html` used to fork its own **light-only** copy of the same token names (`:root { --bg: #faf9f5; ... }`, no `[data-theme="dark"]` block at all, and it didn't even load `theme.css`/`theme.js`). Because every admin component (`.card`, `.kpi`, `.nav-item`, etc.) already consumed `var(--bg)`/`var(--surface)`/etc. rather than literal colors, switching the *source* of those tokens from admin's own fork to the shared `theme.css` gave the entire admin console real dark mode for free — no changes were needed to the hundreds of component rules themselves.

`admin.html` also defines a couple of admin-specific extension tokens theme.css doesn't need (`--radius`, `--shadow`, `--serif`, `--sans`) — those are still declared, just now sourced from theme.css instead of a local fork, so admin and the public site stay visually consistent as the palette evolves.

The public-site background watermark photo (`body::before` in theme.css) is explicitly cancelled in admin.html (`body::before { content: none !important; }`) — the admin console keeps its own flat, minimal surface rather than inheriting a decorative photo overlay meant for public pages.

## The contribution modal (`payment-modal.css`)

This was a fully standalone, hardcoded-light stylesheet (Material Design purple/pink: `#673ab7`, `#9c27b0`, pale lavender/pink backgrounds) with **zero** dark-mode rules of its own. Only the outer modal shell got dark treatment (via a `!important` override elsewhere in `theme.css`), so every control inside it — the header band, toggle pills, input fields, amount chips, submit button — stayed light-themed, floating inside a dark card: a "light island in a dark sea." This is what showed up as harsh/high-contrast in dark mode.

It's now written entirely with `var(--token, fallback)`, consuming the same shared design system, so it follows light/dark mode automatically like everything else. The "paid"/"unpaid" month-status pills (previously hardcoded green/pink) and the `.payment-status-preview` box (previously hardcoded pink) were retheme'd the same way.

## Adding a new component

Use `var(--token-name, <light-hex-fallback>)` for every color. Never hardcode a hex value directly unless it's genuinely meant to be identical in both themes (e.g. pure white text on a colored button that itself uses a token). If you need a color that doesn't map to an existing semantic token, consider whether it's really a new *semantic* category (add a token to both blocks in `theme.css`) versus just a one-off — the existing 16-token set covers almost every real use case in this app.
