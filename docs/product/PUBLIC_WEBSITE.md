# Public Website

## Current page inventory

| Page | Purpose | Notes |
|---|---|---|
| `index.html` | Main dashboard — fund progress, contribution timeline, Google Sign-In, Razorpay "Contribute" modal | The de facto homepage today; still framed around giving, not the broader ministry story the vision calls for |
| `funds.html` | Fund picker grid | Two hard-coded system-fund cards + dynamically appended admin-created funds |
| `impact.html` | "What We Bought" — public purchase/transparency gallery | |
| `subscriptions.html` | Monthly dues status — public paid/unpaid grid | |
| `about.html` | Mission, connect/social links | Admin-editable via `about_content` (`config` key) |
| `members.html` | Member directory + OTP verification | |
| `member.html` | "My Contributions" — signed-in member's personal giving history | Still reads from the legacy Google Apps Script endpoints directly for the two system funds, not `/api/` — see [`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md) |
| `events.html` | Published events gallery with category filter + photo carousel | |
| `preloader.html`, `beta-login.html` | Legacy/utility entry points, not linked from the main site | |

`v2/` (beta, allowlist-gated — see
[`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md#the-v2-beta-flow-current-rollout-mechanism))
restyles `index.html`, `events.html`, and adds `our-giving.html`,
`give-flow.html`, `my-giving.html` — same data, new UI. Its footer already
carries the two-church concept as static copy (see
[`../architecture/CHURCH_ARCHITECTURE.md`](../architecture/CHURCH_ARCHITECTURE.md)),
and a "Request prayer →" CTA that isn't wired to anything yet.

## Target site (per the constitution and `01-PRD.md`)

The public website is not a fund website — funds are one section among many.
`docs/milestone-v2/03-app-flow.md` has the full target sitemap and
screen-by-screen spec (S0–S14); `04-uiux-design-spec.md` has the visual
language. Do not re-derive either from scratch — extend them.

Target homepage sections (from the constitution, matching `03-app-flow.md`'s
Home anatomy): hero, LJM introduction, what we do / why we do it,
churches/branches, current prayers, join-us-in-prayer, upcoming events,
current activities, YouTube live service, current fundraising campaigns,
fund transparency, testimonies, prayer request, contact, other
admin-approved sections. Exact ordering should remain configurable where
practical — this is a repeated instruction (constitution §7 and elsewhere)
and should guide implementation: prefer an ordered/configurable block list
over a fixed template when building the homepage, the same way funds must be
configuration-driven rather than hard-coded.

**Do not hard-code individual events, funds, churches, or prayers into the
frontend** — this is the same principle already violated once (see
[`../architecture/FUND_ARCHITECTURE.md`](../architecture/FUND_ARCHITECTURE.md))
and should not be repeated for any new content type.

## Branding

Configurable per the constitution: logo, primary imagery, tagline, ministry
description, hero content, media. The existing opened-Bible/red-heart visual
concept and the theme-token system (`THEME_AND_DESIGN_SYSTEM.md`) are the
foundation to extend, not replace — `04-uiux-design-spec.md` explicitly
evolves the existing token set rather than forking it.
