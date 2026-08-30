# 13 · Home experience rework — 10 owner-reported issues

| | |
|---|---|
| **Branch** | `claude/light-jesus-ministry-issues-0v9jmj` |
| **Scope** | `/v2/*` public pages, `admin.html`, additive backend for hero slides + videos + program/church fields |
| **Status** | In progress — see the phase checkboxes below |
| **Requested by** | Owner, listing 10 issues after reviewing the live V2 site |

## Why this doc exists

`CLAUDE.md`'s milestone ritual requires major work to be planned in a document
before implementation, and `CONTRIBUTING.md` §1 requires a future session to be
able to discover in-flight work. This is that record for the 10-issue rework.
It is an extension of the v2 milestone, not a new milestone, so it lives here
alongside `08-mobile-header-and-hero.md` and `09-auth-demo-theme-verse-hero-spec.md`
and follows their tracker pattern.

## The 10 issues, and what investigation found

| # | Reported | Root cause found |
|---|---|---|
| 1 | Today's Promise can't be swiped; want monthly verse | The card auto-rotates on an 8s timer but has **no touch/pointer/keyboard handlers at all** — there was never anything to swipe. `/api/promises?when=today` already returns `today.monthly` with `text_en`/`text_ta`, so no backend work is needed |
| 2 | Move "Give Today" to the bottom | It is the hero's primary CTA plus an actions-band card, both near the top |
| 3 | Header images: many, admin-managed, light + dark | Two hardcoded files (`v2/assets/hero/hero-{light,dark}.jpg`), swapped by CSS with **both always downloaded**. No admin surface, no table, no endpoint |
| 4 | Auto-swipe every 2.5s, user can interrupt | No carousel exists anywhere in `/v2` |
| 5 | YouTube thumbnail + inline play below the live link | Video surface today is three fixed URL slots in Settings rendered on `v2/watch.html`. No video table, no custom thumbnails, no home-page live section |
| 6 | Remove the "other church"; LJM is the parent of two churches | Two causes: (a) `admin.html`'s `saveChurch()` never sends `status`, and `churches.js` PUT defaults it to `'active'`, so **editing an archived church silently un-archives it** — a stray church can't be removed; (b) Home bills both churches identically in hardcoded HTML and never calls `/api/churches` |
| 7 | Move "Plan a Visit" down | It is a hero button anchored to `#happening`; there is no Plan-a-Visit section at all |
| 8 | Service times inline on Home + a join link for online prayer | Service times live only on `v2/programs.html` — and on Home only as **pixels baked into the hero JPEG**. `programs` has no online/Meet column |
| 9 | Events asks for login, popup blocked | Every V2 nav links Events as bare `/events.html`. That path goes through `functions/_middleware.js`, which serves V2 only to holders of a **24-hour** `ljm_beta` cookie; once it lapses you get the V1 page, which loads `portal-telemetry.js` — a fail-closed login overlay. `GET /api/events` is and always was public. Home (`/`) has the same leak |
| 10 | What's Happening fully dynamic, expanding, with Meet links | Cards navigate away instead of expanding; the photo is a CSS gradient placeholder so **no event photo ever appears on Home**; `admin.html` has **no Events section at all** and `manage_events` is missing from `PERMISSION_SCOPES` |

## Decisions taken with the owner

- **Beta gate stays for now.** Fix everything inside V2; opening it to everyone
  is a separate, later step. `functions/_middleware.js` is not touched here.
- **Promise card**: this month's promise, **Tamil and English**, auto-swipe plus
  manual swipe. Daily and yearly drop off the home card.
- **Issue 6**: do both halves — fix the admin archive bug *and* present the
  ministry → mother church → second campus hierarchy.
- **Videos**: Home page only this round; `v2/watch.html` is left alone.

## Phase tracker

- [ ] **Phase 0** — this doc, committed before any code.
- [ ] **Phase 1** — migration `0023`, `_media.js`, `media.js`, `hero.js`,
      `videos.js`; `programs.js` + `churches.js` additive fields and the
      archive-preservation fix; tests for each; `schema-contract` updated.
- [ ] **Phase 2** — admin: Header Images, Videos, Events sections; Churches,
      Promises, Programs fixes.
- [ ] **Phase 3** — `v2/carousel.js`; hero carousel; theme persistence;
      Tamil+English monthly promise; new section order; church hierarchy.
- [ ] **Phase 4** — service-times section; expandable What's Happening.
- [ ] **Phase 5** — live card + inline-playing video grid on Home.
- [ ] **Phase 6** — link repoint across all 14 V2 pages; `portal-telemetry.js`
      ternary fix (separate commit); `tests/frontend/v2-home.test.mjs`.

## Standing constraints (from `CONTRIBUTING.md`)

- Tests ship in the same commit as every endpoint change.
- The giving/money path stays byte-identical to `origin/main`.
- Migrations are additive only, and mirrored into `schema.sql`.
- `npm test` green before starting and before each phase is called done.
  Baseline at the start of this work: **377/377 passing**.

## Known issue found but deliberately not fixed here

`wrangler.jsonc:23` sets `ALLOW_LEGACY_EMAIL_TOKEN: "true"`, so
`_lib.js:130-140` accepts a bare email string as an admin credential — anyone
who knows a super-admin's email address can pass `?token=<that email>` and get
`["*"]` permissions. It is unrelated to these 10 issues and switching it off may
break existing admin logins, so it needs its own session. Flagged to the owner.
