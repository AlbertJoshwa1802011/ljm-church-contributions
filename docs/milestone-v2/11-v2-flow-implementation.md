# 11 · Real Implementation: flag-gated "v2" flow

| | |
|---|---|
| **Status** | 🚧 In progress — this is the live audit trail; update checkboxes as work lands, commit every meaningful step. **If you are a new agent picking this up, read this whole doc before touching anything.** |
| **Scope** | This is **real implementation**, not a mockup — touches `functions/api/*`, adds new files, and (with explicit user sign-off) adds one small new admin-console panel. The existing `index.html`/`script.js`/`admin.html`/every existing `functions/api/*.js` file must remain **byte-for-byte unmodified** except the one explicitly-approved admin addition (§6). |
| **Requested by** | User, verbatim: "dont touch the existing code let it be as it is... but build a flow switch... based on Feature key from admin console... allowing the new flow only for the specific user alone... on public until stabilised we have the old flow... once tested we can make the default flow as new flow." Confirmed via question: routing = email-based, allowlist = signed-in email list (admin-managed), scope = all pages at once (with continuous audit), Give Flow keeps today's real post-payment behavior (no new confirmation backend yet). |

## 0. Why this doc is long — read this first

This is the first round in this engagement that touches real, live-money-adjacent
code instead of static preview files. Getting the *architecture* right up front
matters more than speed, because a mistake here either (a) breaks the live site
for everyone, or (b) leaks the new unfinished flow to real visitors before it's
ready. Sections 1–6 lock the architecture; §7 is the page-by-page build
tracker; §8 is verification; §9 is what still needs the user's action outside
of code (env vars, real photos, etc).

## 1. The core problem this design solves

The site has **no server-side session** today — `functions/api/auth.js` verifies
a Google ID token per-request; the frontend just re-sends it. That's fine for
API calls, but page-serving decisions (which HTML to return for `GET /`) happen
in Cloudflare Pages **before** any client-side JS runs, so there's nothing to
check a "logged in as X" state against at that point — no cookie exists.

**Solution:** a small, separate "beta activation" step mints a short-lived,
tamper-proof cookie the moment someone proves (via the *same* real Google
sign-in) that their email is on the admin-managed allowlist. Every subsequent
page request checks that cookie. Nothing about this touches the existing
sign-in flow used by `index.html` today — it's an entirely new, additional
one used only by people opting into the beta.

## 1.5 Corrected understanding — real site structure (found while building, not assumed)

Before wiring real pages I checked the actual repo root, and it changed a few
things I'd gotten wrong in earlier mockup rounds. Recording this here because
it's exactly the kind of thing a future agent needs to know before touching
routing:

- **The real site is multi-page, not a single-page dashboard.** Root has
  `index.html` (the stats dashboard, giving modal via `razorpay-checkout.js`),
  `about.html`, `events.html` (real, already exists!), `funds.html` (fund
  picker), `impact.html` ("What We Bought"), `member.html`, `members.html`,
  `subscriptions.html` — all real, separate pages, not mockup gaps.
- **`member.html` ("My Contributions") already exists in production.**
  Round 6's `mockups/my-giving.html` was documented as "no equivalent exists
  in production today" — **that was wrong.** `member.html` does the same
  job today: shows one person's total given, gift count, fund breakdown.
  Correction, not a new feature: the v2 port restyles an existing real page,
  it doesn't invent backend surface.
  - How it identifies "who": a `?name=` URL query parameter — **not**
    signed-in identity. Same trust model as the public contributor-history
    click-through I built in round 6 (this data is already fully public;
    the user confirmed that's intentional).
  - **It reads from legacy Google Apps Script URLs directly**
    (`member-dashboard.js`'s `API_URL_TECH`/`API_URL_CHRISTMAS`), not the
    modern D1-backed `/api/contributions`. This is old, pre-migration
    plumbing still live in production. **Not touching or "fixing" this** —
    out of scope, flagging only. The v2 port will read from the modern
    `/api/contributions` instead (consistent with every other v2 page),
    which is a legitimate modernization, not a functional regression: same
    real numbers, current source of truth.
  - **v2 design decision:** after Google sign-in (`/api/auth`, real,
    unchanged), look up the matched `member.name` from the response, then
    client-side-filter the real `/api/contributions` rows by that name —
    exactly what the round-6 modal already does, just for "yourself"
    instead of "whoever you clicked." **No new backend endpoint needed for
    My Giving after all** — this removes the "?email= filter, TBD" open
    item from §7 below.
- **Giving happens via a modal on `index.html`** (`razorpay-checkout.js`),
  not a separate page — so `/give-flow.html` is a genuinely new URL in v2,
  no old-file collision to route around.
- **`index.html` already covers what the mockups called "Our Giving."**
  Matches what was already flagged back in round 1 (`07-ui-mockups-review.md`
  §3) — nothing new here, just confirming it while wiring real routes.

### Revised routing map

| Path | Old flow (unchanged) | New flow (eligible testers only) |
|---|---|---|
| `/`, `/index.html` | Today's dashboard + give modal | v2 Home (new welcoming landing page) |
| `/our-giving.html` | *(doesn't exist old-flow)* | v2 Our Giving (the full stats report) |
| `/events.html` | Real, existing events page | v2 Events |
| `/give-flow.html` | *(doesn't exist old-flow — giving is a modal)* | v2 Give Flow (real Razorpay, same as the modal) |
| `/my-giving.html` | *(doesn't exist old-flow — see `/member.html`)* | v2 My Giving (real data, signed-in, not `?name=`) |
| everything else (`/about.html`, `/funds.html`, `/impact.html`, `/member.html`, `/members.html`, `/subscriptions.html`, `/admin.html`, all `/api/*`) | unchanged | unchanged — never intercepted, not part of this phase |

## 2. Architecture

```
                            ┌─────────────────────────────┐
  GET / (any page)  ─────▶ │  functions/_middleware.js    │
                            │  (new file, runs on every    │
                            │   request, before anything)  │
                            └───────────────┬───────────────┘
                                            │
                     has valid, unexpired   │   no cookie / invalid / expired
                     signed "ljm_beta"      │
                     cookie?                │
                            │ yes                          │ no
                            ▼                               ▼
                 env.ASSETS.fetch(/v2/<page>)      next() → existing static
                 (new files, real data,             file, completely untouched
                  new design, same real APIs)        (today's production site)
```

- **`functions/_middleware.js`** (new) — the only thing that decides. Only
  intercepts the known page paths (`/`, `/index.html`, `/our-giving.html`,
  `/give-flow.html`, `/events.html`, `/my-giving.html`); everything else
  (`/api/*`, `/admin.html`, any other static asset) passes straight through
  via `next()` and is **never touched**.
- **`/v2/*.html`** (new directory) — the real-data ports of the mockups.
  Same Google sign-in flow (`/api/auth`), same `/api/contributions`,
  `/api/funds`, `/api/events`, and — for Give Flow — the *exact same*
  Razorpay checkout + `/api/webhook` path as today, just wrapped in the new
  UI. No payment-path behavior changes.
- **`/beta-login.html`** (new) — a small, separate page: "Sign in with
  Google" → POSTs the ID token to a new `/api/beta-activate` → if the email
  is on the allowlist, sets the signed `ljm_beta` cookie and redirects to
  `/`. This is the *only* new entry point; nothing on the existing site
  links to it yet (you'd share the link directly with testers, or I can add
  a link once you confirm where).
- **`functions/api/beta-activate.js`** (new) — verifies the Google token
  (reuses `verifyGoogleToken` from `_lib.js`, zero duplication), checks the
  email against the `beta_testers` table, mints the cookie.
- **`beta_testers` table** (new, additive migration) — the admin-managed
  allowlist. `email TEXT PRIMARY KEY, added_by TEXT, added_at DATETIME, note TEXT`.
- **Cookie design:** `ljm_beta=<base64 payload>.<HMAC-SHA256 signature>`,
  `HttpOnly; Secure; SameSite=Lax`, 24h expiry, signed with a new
  `BETA_COOKIE_SECRET` env var using the **same Web Crypto HMAC pattern
  `webhook.js` already uses** for Razorpay signatures — no new crypto
  approach introduced. Payload = `{ email, exp }`. Verified statelessly in
  middleware (no DB hit on every page load — this is a low-traffic church
  site, but avoiding a DB round-trip on *every single page navigation* for
  everyone still matters). **Trade-off, stated plainly:** revoking someone
  mid-session takes up to 24h (removing them from `beta_testers` stops new
  activations immediately, but an already-issued cookie stays valid until
  it expires). Given this is a 1–2 person internal test, that's an
  acceptable trade — flagging it so it's a visible decision, not a silent
  one.
- **If `BETA_COOKIE_SECRET` is not set:** the whole feature fails closed —
  middleware always serves the old flow, `beta-activate` always fails. Safe
  default; see §9 for what the user needs to set.

## 3. What is genuinely new vs. what's being reused

Reused as-is (zero duplication, just called from new pages):
- `/api/auth` (POST/PUT) — Google sign-in, unchanged.
- `/api/contributions`, `/api/funds`, `/api/events`, `/api/purchases` — the
  real data every new page needs.
- The real Razorpay checkout call + `/api/webhook` — Give Flow's actual
  payment path, untouched.
- `verifyGoogleToken` / `getPermissions` from `_lib.js`.
- **`functions/api/settings.js`'s existing verse-card content system**
  (`verse_month_label/text/ref`, `verse_year_label/text/ref`, already
  admin-editable) — this directly answers round 4's open question about
  where rotating verse content should come from. The mockup's "This Month" /
  "This Year" promise-card mini-cards now bind to this **real, already-existing**
  config instead of inventing a new content source. ("Today's Promise" itself
  still has no real per-day source — see §7 Home for how it's handled.)
- **`settings.js`'s `about_content` JSON blob** — real, admin-editable About
  page content already exists; the new Home/nav "About" link will use it
  instead of staying a placeholder `#`.

Genuinely new:
- `functions/_middleware.js`, `functions/api/beta-activate.js`,
  `functions/api/beta-testers.js` (admin CRUD for the allowlist).
- `beta_testers` table (migration `0012_beta_access.sql`).
- `/v2/*.html` + `/beta-login.html`.
- One new admin-console panel (§6).

## 4. Money-path guarantee

Give Flow's new UI calls the **identical** Razorpay checkout initiation and
the **identical** `/api/webhook` — same amount/fund/member fields, same
signature verification, same D1 insert. The only thing that changes is the
HTML/CSS around it and, per your call, the post-payment confirmation stays
the current real `alert()`-based behavior (restyled, not re-behaviored).
**No new backend surface on the payment path in this phase.**

## 5. Old flow guarantee

`index.html`, `script.js`, `webhook.js`, and every existing
`functions/api/*.js` file are not edited in this phase. Verified by: (a) the
full existing test suite staying green throughout, (b) a file-diff check
before each commit confirming zero changes outside the new files listed
above, (c) a manual pass confirming `/`, `/our-giving` behavior (well,
there's no separate old our-giving page — today's `index.html` *is* the
whole dashboard) loads and works exactly as before for a non-allowlisted
visitor.

## 6. Admin console: one new panel (needs your explicit sign-off — flagging, not assuming)

Earlier in this engagement you said "don't worry about the admin console...
let it be as like now" — that was about not spending mockup-review effort
redesigning its look. This request is different: an actual new *capability*
(manage the beta allowlist) that has to live somewhere, and the admin console
is where every other operational control (`roles`, `settings`) already lives.

**Plan:** one new nav entry, "Beta Access," added the same way `roles` and
`settings` already are (`admin.html`'s `sideNav`/section-loader pattern,
same existing visual style — no redesign, just one more panel in the current
look). Lists current tester emails, add/remove, calls the new
`beta-testers.js` endpoint (permission-gated the same way `roles.js` is).

If you'd rather I not touch `admin.html` at all, tell me and I'll manage the
allowlist a different way (e.g. a hardcoded list in code, like
`HARDCODED_SUPER_ADMINS` already is in `_lib.js`, edited via a real commit
each time someone's added/removed) — less convenient for you day-to-day, but
zero admin.html changes. **Proceeding with the admin panel unless told
otherwise, since it directly matches what you asked for.**

## 7. Page-by-page build tracker

- [ ] **Foundation** — migration, `beta-testers` table, `beta-activate.js`,
      `beta-testers.js` (admin CRUD), `_middleware.js`, `/beta-login.html`,
      tests for both new endpoints, admin panel. *Verify old flow untouched,
      verify albertjoshrock101@gmail.com (pre-seeded) can activate and reach
      `/v2/` while an arbitrary other email cannot.*
- [ ] **Home** (`/v2/index.html`) — real sign-in (reuses `/api/auth`), real
      Giving-at-a-Glance teaser sourced from `/api/contributions`, real
      Month/Year promise mini-cards from `settings.js`'s verse config,
      "Today's Promise" itself: **no real per-day source exists** — ships
      as a small fixed/curated set (same honesty pattern as the mockup)
      until you decide on a real content source; hamburger drawer, hero
      image slot — all as already designed in `mockups/home.html`, now real.
- [ ] **Our Giving** (`/v2/our-giving.html`) — full stats wired to
      `/api/contributions`/`/api/funds`/`/api/purchases`, contributor
      Giving-History modal driven by **real per-contribution rows** (no
      more reconstructed/illustrative itemization — the real data has real
      dates, this was only a mockup limitation).
- [ ] **Events** (`/v2/events.html`) — wired to `/api/events`; today that's
      genuinely zero events in production, so the page will legitimately
      show an empty state rather than the mockup's placeholder gallery —
      confirm that empty state looks intentional, not broken.
- [ ] **My Giving** (`/v2/my-giving.html`) — real per-signed-in-member
      contribution history. Needs a small new read: either a `?email=`
      filter added to `/api/contributions` or client-side filtering of the
      existing full-fund response (deciding during build, whichever needs
      less new backend surface — documented here once chosen). Receipt
      download stays a demo/disabled affordance (no PDF generation exists;
      out of scope).
- [ ] **Give Flow** (`/v2/give-flow.html`) — real fund list from
      `/api/funds`, real Razorpay checkout (identical call), real webhook
      (untouched), post-payment confirmation = today's real behavior,
      restyled only (§4).
- [ ] **Final verification pass** — full test suite green, old-flow manual
      spot check, new-flow manual walkthrough for the allowlisted email,
      confirm a non-allowlisted email never sees `/v2/` content.

## 8. Testing requirements (per `CONTRIBUTING.md`)

Every new endpoint (`beta-activate.js`, `beta-testers.js`, and any
`?email=` filter added to `contributions.js`) ships with tests in the same
commit: happy path, permission gate, not-found/validation edges — same
standard as every other endpoint in this repo, no exception for being
"just a feature flag."

## 9. Things only the user can do (not code)

- **Set the `BETA_COOKIE_SECRET` environment variable/secret** in the
  Cloudflare Pages project settings (Settings → Environment variables) —
  I cannot access your Cloudflare dashboard. Any reasonably long random
  string works; I'll note the exact variable name again once the code
  lands. Until this is set, the beta feature safely stays off for everyone.
- **Share the `/beta-login.html` link** with whichever testers you add to
  the allowlist — nothing on the public site links to it yet, by design
  (so the public can't stumble onto a sign-in page for a feature they're
  not part of).
