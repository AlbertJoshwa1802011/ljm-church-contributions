# 13 · v2 Liquid Glass (Apple iOS materials)

| | |
|---|---|
| **Status** | Implemented on `/v2/*` public pages |
| **Scope** | Visual language only. Same routes, same drawer IDs, same Give endpoints. |
| **Does not touch** | `functions/api/*`, `webhook.js`, `razorpay-checkout.js`, `admin.html`, v1 portal |

## Product choice

Keep today’s v2 navigation (sticky header + hamburger drawer) **and** add a
WhatsApp-style bottom tab bar (icon + label) as a floating Liquid Glass
capsule: **Home · Events · Give · Pray · More**.

- Home / Events / Give / Pray are existing pages — no new routes.
- **More** toggles the existing `#navDrawer` (same `open` class the hamburger
  already uses). It does not replace the hamburger.
- The old full-width `.mobile-actions` Give/Pray/Contact strip is retired so
  it cannot stack on top of the tab bar. Give and Pray stay one tap (tabs);
  Contact stays in the drawer + footer (as on most v2 pages already).

## Materials (light + dark)

Tokens live in [`v2/shared.css`](../../v2/shared.css) on `:root`,
`prefers-color-scheme: dark`, `[data-theme="dark"]`, and `[data-theme="light"]`.

- Light: translucent white glass over warm paper + soft accent/gold washes.
- Dark: more-opaque glass over true black so body text stays WCAG-AA.
- Fallbacks: `prefers-reduced-transparency` and missing `backdrop-filter`
  resolve `--glass` / `--glass-filter` back to solid `--surface`.

## Frozen path

Give still loads `/razorpay-checkout.js` and still toggles
`.insight-modal-visible`, `.contrib-toggle.active`, `.amount-chip.selected`.
Only the CSS around those class names changed.
