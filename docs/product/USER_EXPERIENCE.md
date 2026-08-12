# User Experience

## Personas (from `docs/milestone-v2/01-PRD.md`)

Six personas already defined — don't re-derive: worldwide seeker/visitor,
local congregation member, donor (India + diaspora), youth, prayer-seeker,
and the pastor/admin/volunteer team. Any new feature should be evaluated
against which of these it serves; a feature that serves none of them is a
candidate for `DECISION REQUIRED` rather than assumed scope.

## Design system

Full detail in [`../../THEME_AND_DESIGN_SYSTEM.md`](../../THEME_AND_DESIGN_SYSTEM.md) —
summarized here only as much as orientation requires. All colors are CSS
custom properties (`theme.css`), light and `[data-theme="dark"]` blocks. Nine
curated, WCAG-AA-validated accent palettes, selectable independently per
light/dark mode, device-local for anonymous visitors and synced to the
account for signed-in members (`functions/api/appearance.js`,
`member_preferences` table). `docs/milestone-v2/04-uiux-design-spec.md`
evolves this same token system for the worldwide-ministry redesign — two new
semantic tokens (`--gold`/`--gold-soft` for sacred/celebration accents,
`--live` for a "live now" indicator) rather than a fork.

## Principles (from `04-uiux-design-spec.md`, apply beyond this milestone)

Trust first; warm and sacred, not corporate; inspiration is the hero, not an
afterthought; effortless action (giving, prayer, contact should never feel
like friction); one design system everywhere (admin console shares the same
tokens as the public site, already true today); worldwide and bilingual from
the start, not retrofitted.

## Accessibility & responsiveness

WCAG AA, keyboard navigation, tap targets ≥44px (per
`04-uiux-design-spec.md` §7). Mobile-first: the admin console's nav already
demonstrates the pattern to follow (accordion sidebar on desktop, group-icon
strip + slide-up sheet on mobile) — reuse it rather than inventing a new
responsive pattern per feature.

## Multilingual UX (planned, not built)

English + Tamil per `01-PRD.md` §7.13. `04-uiux-design-spec.md` §6 flags a
concrete design constraint worth remembering: Tamil glyph height/line-height
differs from Latin script and needs its own type-scale tuning, not a
same-metrics font swap; no RTL handling is needed for this language pair.
See [`../architecture/DATA_MODEL.md`](../architecture/DATA_MODEL.md) for the
proposed `*_en`/`*_ta` bilingual-column pattern.

## What not to do

Do not add a third design language for any new feature (a "prayer" section
skinned differently from "events," for instance) — the constitution's "one
system everywhere" applies as much to visual design as to navigation
structure and permission enforcement.
