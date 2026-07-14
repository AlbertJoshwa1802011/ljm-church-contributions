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
| `--accent` / `--accent-deep` / `--accent-soft` | `#5046E5` indigo | `#8983FF` (lightened) | Brand color, CTAs, active states |
| `--green` / `--red` / `--amber` / `--info` | semantic hues | softened equivalents | Status colors (paid/error/warning/neutral-distinct) |
| `--radius` / `--shadow` / `--shadow-lift` | — | — | Shared corner radius and elevation shadows |

Switching `data-theme` on `<html>` (done by `theme.js`) is the *only* thing that needs to happen for a component to re-theme — as long as it's written with `var(--token)` instead of a literal color, it gets dark mode for free.

## Why the dark palette isn't pure black

The dark theme uses a warm near-black elevation scale (`#16140f` → `#1c1a14` → `#232019`) rather than a stark OLED black, echoing the light theme's warm-paper tone instead of jumping to a cold, stark black. This is the same reasoning most platforms' dark-mode guidelines give for avoiding true `#000`: it reads as more premium and is easier on the eyes at night, while still giving cards a visible "step up" in elevation.

- **`--info` is a separate token** (`#3f7a94` light / `#6fa8c2` dark, a muted teal) so that a 4th or 5th distinct chart/stat-card hue doesn't have to reuse the primary brand color. Where a distinct hue was needed (e.g. the Overview stat-card row: goal/collected/remaining/count), `--info` fills that role.

## The accent color: indigo/violet "shuttle" blue

The brand accent was previously a warm terracotta (`#d97757` light / `#e2825f` dark). It's now a cool indigo-blue-violet, chosen after looking at how Apple and Google define their own primary accent colors:

- **Apple's HIG** treats `systemBlue` (community-measured ≈ `#007AFF` light / `#0A84FF` dark) and `systemIndigo` (`#5856D6` light / `#5E5CE6` dark) as dynamic semantic colors — the dark variant is not simply the light one over a dark background, it's a distinct, slightly shifted value tuned for that surface.
- **Material Design 3**'s baseline seed color is a violet (`#6750A4`), and its tonal-palette system explicitly maps "Primary" to a *darker* tone (40) in light mode and a *lighter* tone (80) in dark mode — the same tone is never reused as-is across both themes.

Following that same principle (a tuned pair per theme, not one color duplicated), the new tokens are:

- **Light**: `--accent: #5046E5` (indigo), `--accent-deep: #3F3BC7` (darker, for hover/emphasis text — passes WCAG AAA at 7.5:1 on the page background).
- **Dark**: `--accent: #8983FF`, `--accent-deep: #A79FFF` — both lightened/desaturated relative to the light-mode hue (not just brightened) so they read as a refined periwinkle-indigo rather than a neon or washed-out blue against the dark surfaces. Both clear WCAG AA on `--surface`/`--bg` (5.2:1 / 5.9:1), and `--accent-deep` clears AAA (7.0:1+).
- `--accent-soft` is a pale indigo tint in each theme (`#ECEBFB` light, `rgba(137,131,255,0.16)` dark) used for active-state backgrounds and badges.

## The purple/indigo purge (historical)

An earlier pass removed a *different*, unrelated legacy brand gradient (`#667eea` → `#764ba2`, a blue-purple Material-style gradient left over from a pre-`theme.css` design) from `style.css`, `script.js`, `impact.html`/`impact.js`, `members.html`, `index.html`, `admin.html`'s chart palette, and `admin-session.js`'s floating admin-mode bar, replacing it with the (then-terracotta) accent system. That purge is unrelated to the current indigo accent above — it's mentioned here only so the two "indigo/violet" stories in this file's history aren't confused with each other.

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
