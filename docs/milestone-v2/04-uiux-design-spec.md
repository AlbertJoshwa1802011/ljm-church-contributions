# 04 · UI/UX Design & Spec Sheet

| | |
|---|---|
| **Product** | Light of Jesus Ministry — Worldwide Ministry App |
| **Milestone** | v2 — "Worldwide Ministry App" |
| **Document** | 4 of 6 (UI/UX Design & Spec) |
| **Version** | 1.0 (Draft) |
| **Date** | 2026-07-16 |
| **Status** | Draft — awaiting approval |
| **Builds on** | [`01-PRD.md`](./01-PRD.md) · [`02-TRD.md`](./02-TRD.md) · [`03-app-flow.md`](./03-app-flow.md) |
| **Next document** | [`05-backend-schema.md`](./05-backend-schema.md) — Backend Schema |

> **Purpose.** Define the **look, color, and feel**, and the **component styles &
> design language** for the screens in the App Flow. It **evolves the existing
> `theme.css` token system** (documented in `THEME_AND_DESIGN_SYSTEM.md`) — it does
> **not** fork or replace it — so light/dark mode and the member-selectable accent
> keep working for every new component for free.

---

## 1. Design principles

1. **Trust first.** Calm, credible, transparent. The design should make a first-time
   visitor from anywhere in the world feel this is a real, caring, trustworthy church.
2. **Warm & sacred, not corporate.** Warm paper tones, generous whitespace, gentle
   elevation — reverent but modern (in the spirit of Jesus Calls / Jesus Redeems).
3. **Inspiration is the hero.** The promise word, testimonies, and worship come first;
   chrome recedes.
4. **Effortless action.** Give · Pray · Contact are always one tap away and never
   intimidating.
5. **One system, everywhere.** Every surface — public site, member portal, admin —
   shares the same tokens so it reads as one product and re-themes as one.
6. **Worldwide & bilingual.** Legible in English and Tamil, on any device, on any
   connection.

---

## 2. Foundations — reuse, don't fork

**Hard rule (from `CLAUDE.md` + `THEME_AND_DESIGN_SYSTEM.md`):** every color is a CSS
custom property consumed as `var(--token, <fallback>)`. New components add **no** raw
hex (except pure white on a colored button). This is what gives us dark mode and the
member accent-swap with zero per-component work. The existing **16-token set** already
covers almost every need; add a new token to **both** the `:root` and `[data-theme]`
blocks in `theme.css` only if a genuinely new *semantic* category appears.

### 2.1 Color tokens (unchanged core)
| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#faf9f5` | `#16140f` | Page background (warm paper) |
| `--bg-soft` | `#f4f2ec` | `#1c1a14` | Recessed panels |
| `--surface` | `#ffffff` | `#232019` | Cards, modals |
| `--border` / `--border-strong` | warm greys | translucent warm greys | Dividers, borders |
| `--text` / `--text-soft` / `--text-faint` | near-black → grey | near-white → grey | Text hierarchy |
| `--accent` / `--accent-deep` / `--accent-soft` | `#3D6079` / `#2E4A5E` / `#E8ECEF` (**Wedgwood**) | `#5E90AB` / `#A9C7DB` / `rgba(94,144,171,.16)` | Brand, CTAs, active states — **member-selectable** |
| `--green` / `--red` / `--amber` / `--info` | semantic hues | softened | Status (paid/error/warn/neutral-distinct) |
| `--radius` / `--shadow` / `--shadow-lift` | — | — | Corner radius, elevation |

**Accent stays Wedgwood by default**, and the "English heritage" accent collection
(Sage, Heather, Aubergine, Claret, Terracotta, Ochre, Teal, Slate) keeps working via
`theme.js` — the new ministry UI inherits it automatically. **All palettes remain
WCAG-AA validated** against the real `--bg`/`--surface`.

### 2.2 New semantic tokens proposed (add to both theme blocks)
Only where a real new category appears in the ministry UI:
| New token | Light (suggested) | Dark (suggested) | Role |
|---|---|---|---|
| `--gold` / `--gold-soft` | `#B08D4C` / `#F3EAD6` | `#D8B877` / `rgba(216,184,119,.16)` | Sacred/celebration accent for **promise cards**, live badges — sparingly, WCAG-checked |
| `--live` | reuse `--red` | reuse `--red` | "Live now" indicator on Media |

> Keep additions minimal — reuse `--accent`, `--info`, `--green`, `--amber` first.

### 2.3 Typography
Reuse the existing `--serif` / `--sans` families (already declared as admin extension
tokens sourced from theme.css). Design language:
- **Serif for scripture & headings of inspiration** (promise word, testimony titles,
  hero) — evokes reverence and print-Bible warmth.
- **Sans for UI, body, data** — clarity and neutrality.
- **Tamil:** pair with a legible Tamil webfont (e.g. Noto Sans/Serif Tamil) loaded
  the same no-build way; ensure the type scale holds for Tamil glyph heights.

**Type scale (rem):** Display 2.5 · H1 2.0 · H2 1.5 · H3 1.25 · Body 1.0 · Small
0.875 · Caption 0.75. Line-height 1.5 body / 1.2 headings. Scripture set slightly
larger and looser for calm reading.

### 2.4 Spacing, radius, elevation
- **Spacing scale (px):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 (8-pt rhythm).
- **Radius:** reuse `--radius` for cards/inputs; pill radius for buttons/chips/badges.
- **Elevation:** `--shadow` (resting cards) and `--shadow-lift` (hover/active, modals)
  only — no bespoke shadows.
- **Chart-height rule preserved:** any Chart.js canvas with
  `maintainAspectRatio:false` needs a parent with bounded height (per `CLAUDE.md`).

### 2.5 Layout & grid
- **Container:** max-width ~1200px, centered, 16–24px side gutters.
- **Breakpoints:** ≤480 (mobile) · 481–768 (large phone/tablet) · 769–1024 (tablet/
  small laptop) · >1024 (desktop). **Mobile-first.**
- **Grids:** cards flow 1-col (mobile) → 2 → 3 (desktop) with `minmax()` auto-fit.
- Wide content (tables, charts) scrolls inside its own `overflow-x:auto` container;
  the page body never scrolls horizontally.

---

## 3. Component spec sheet

Each component: what it is · key states · tokens. All are theme-reactive by
construction.

### Navigation
- **Header bar** — sticky, `--surface` with `--border` bottom; logo (→Home), primary
  nav, **Give**/**Pray** buttons, **church switcher**, **language toggle**, auth.
  Mobile: hamburger drawer; Give/Pray persist. Active link uses `--accent`.
- **Church switcher** — segmented/dropdown (*All · Church of Light · City Worship
  Center*); active pill `--accent-soft` bg + `--accent-deep` text. Persists.
- **Language toggle** — compact `EN / தமிழ்` switch; active state `--accent`.
- **Sticky mobile action bar** — Give · Pray · Contact; `--surface` + `--shadow-lift`.
- **Footer** — `--bg-soft`; churches/addresses/times, socials, quick links,
  daily-prayer link.

### Buttons & chips
- **Primary CTA** — `--accent` bg, white text (AA-guaranteed), pill, `--shadow` →
  `--shadow-lift` on hover. Used for Give / Proceed to Pay / Submit.
- **Secondary** — outline `--accent`, transparent bg.
- **Tertiary/ghost** — `--text-soft`, no border.
- **Amount chips** (giving) — reuse existing chip styling; selected = `--accent-soft`
  + `--accent-deep`.
- **Disabled/loading** — reduced opacity + spinner; never a dead click.

### Cards
- **Promise card (hero)** — `--surface`, subtle `--gold-soft` inner accent + a small
  scripture-reference tag; serif promise text; "Today · <date>" label; share icon.
  Monthly/Yearly variants are compact.
- **Testimony card** — media thumbnail, serif title, 2-line excerpt, name/place; hover
  lift. Detail opens full story.
- **Event / good-deed card** — cover image, church tag (`--accent-soft`), date,
  title, "beneficiaries helped" stat, "Give to this cause" link.
- **Program/schedule item** — day/time, program name, church tag.
- **Blog card** — thumbnail, category tag, title, date.
- **Stat / KPI chip** — reuse existing Overview KPI style (`--info` for the distinct
  hue) for transparency stats (Collected/Spent/Available).

### Media
- **Video embed** — responsive 16:9 wrapper (`max-width:100%`), YouTube iframe;
  **"Live now"** badge uses `--live` with a soft pulse; offline shows latest recording.
- **Podcast/archive list** — playlist rows with thumbnail, title, date, duration.

### Forms (Pray, Contact, Submit testimony)
- Inputs: `--surface` bg, `--border` → `--accent` on focus, `--radius`; labels
  `--text-soft`; helper/validation in `--text-faint` / `--red`.
- **Success state** — inline confirmation card (`--green` accent) with a warm message
  ("Thank you — our team will reach you soon").
- **Call-us / tap-to-call** — prominent button revealing the number.
- Minimal required fields; optional fields clearly marked; bilingual labels.

### Giving modal (reuse)
- Reuse the existing contribution modal, now fully tokenized in `payment-modal.css`
  (header band, month toggle pills, inputs, amount chips, submit) — it already follows
  light/dark. **No backend or flow change** — restyle entry points only. The modal
  must keep calling the **same** Razorpay checkout + endpoints (the giving path is
  frozen; TRD §4 and [`SAFETY-AND-TESTS.md`](./SAFETY-AND-TESTS.md)).

### Feedback & states
- **Badges/pills** — status (published/pending, paid/unpaid, live) via semantic tokens.
- **Empty states** — gentle illustration + one-line guidance + a CTA (never a blank).
- **Loading** — skeleton cards / spinners consistent with `preloader.html`.
- **Errors** — inline, calm, `--red`; never blame the user.

### Imagery & iconography
- **Photography** — warm, human, real congregation and outreach photos; consistent
  aspect ratios; `max-width:100%`; lazy-loaded for worldwide/low-bandwidth.
- **Watermark** — the public-site background photo (`body::before` in theme.css)
  stays on public pages, cancelled in admin (as today).
- **Icons** — a single lightweight line-icon set, `currentColor` so they inherit
  tokens; faith motifs used tastefully (dove, light, cross) — never cluttered.

---

## 4. Motion
- Purposeful and quiet: 150–250ms ease for hover lift, drawer, modal, tab changes.
- Promise card and live badge get a subtle, slow emphasis; nothing flashy.
- Respect `prefers-reduced-motion` — disable non-essential animation.

---

## 5. Accessibility
- **WCAG AA** minimum: body text ≥4.5:1, large text/icons ≥3:1 — already guaranteed by
  the validated palettes; new `--gold`/`--live` uses must be checked the same way.
- Full keyboard navigation, visible focus rings (`--accent`), semantic landmarks,
  alt text on all imagery, labels on all inputs, adequate tap targets (≥44px).
- Works in light **and** dark, and across every accent palette.

---

## 6. Bilingual design notes
- Language toggle swaps UI labels (client i18n dictionary) and shows `*_ta` content.
- Tamil glyphs are taller/denser — verify line-height and card heights hold; avoid
  clipping. Both languages are LTR (no RTL work needed).
- Never hardcode English strings in components meant to be translated.

---

## 7. Do / Don't
| Do | Don't |
|---|---|
| Use `var(--token, fallback)` for every color | Hardcode hex (breaks dark mode & accent-swap) |
| Reuse existing components (modal, KPI chips, cards) | Re-implement a parallel style |
| Keep Give/Pray/Contact always reachable | Bury primary actions |
| Let promises/testimonies/worship lead | Lead with data/forms |
| Add a token to both theme blocks for a new semantic color | Invent one-off colors per component |
| Check any new color for AA | Ship an unvalidated accent |

---

## 8. Next steps — document chain

UI/UX spec complete. Proceed to **[`05-backend-schema.md`](./05-backend-schema.md)** —
define the database tables, relationships, and API calls that back these screens
(additive-only; giving path frozen, per TRD §4–§5). **No implementation until all six
documents are approved.** See [`README.md`](./README.md) for the live tracker.
