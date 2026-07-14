# Events — Pending Tasks & Enhancements (memory for follow-up agents)

> Purpose of this file: a durable, hand-off record of what is **done** and what
> is still **pending** on the Events feature, so a future session/agent can pick
> it up. Read this first, then `EVENTS_SETUP.md` for infra, and the code
> references below. Last updated: 2026-07-14.

---

## ✅ Already shipped (live on `main` / production)

The Events feature is merged (PR #11) and the D1 migration `0011_events` has been
applied to production.

- **Public page**: `events.html` + `events.js` — responsive card gallery,
  auto category filter chips, photo-count badge, featured ribbon, and a photo
  **carousel/lightbox detail modal** (thumbnails, per-photo captions,
  keyboard/swipe nav, "additional details" list).
- **Admin**: `admin.html` → **Events** section — create/edit/delete, Draft vs
  Published, Featured, admin-defined category/date/location, repeatable extra
  details, cover photo + multi-photo upload (client-side compression). Each photo
  already has a **caption** field.
- **Backend**: `functions/api/events.js` (REST CRUD, drafts hidden from public,
  auth `manage_events`, audit) + `functions/api/events/photo.js` (R2 image
  server). Photos go to **R2** when bound, else **base64-in-D1 fallback**.
- **DB**: `events` + `event_photos` tables (`migrations/0011_events.sql`,
  mirrored in `schema.sql`). `event_photos.caption` and `sort_order` exist.

---

## ⏳ PENDING

### 1. Donation-proof / "Instagram-feed" presentation  ⭐ (requested by trustee)

**Why:** The trustees personally give donations to church people, and Events
should serve as **proof of those donations** — not just a photo grid, but a
feed where each photo carries a **prominent caption/context** the way an
Instagram post does (image + caption + who/what/when).

**What already exists to build on:** per-photo `caption` is in the data model
(`event_photos.caption`) and is shown in the carousel modal. The gap is
**presentation + prominence + donation context**, not storage.

**Scope to implement:**
- **Feed ("Instagram") view on the public page** — a vertical, single-column
  feed where each post shows the photo **large** with its **caption directly
  beneath** it, plus event title, date, and location. Options:
  - Per-photo posts (each photo = one feed post), or
  - Per-event posts (event = one post with its gallery + caption).
  - Consider a **toggle** between the existing grid view and the new feed view
    (a segmented control near the filter chips), defaulting to whichever the
    trustee prefers.
- **Make captions first-class in admin** — captions already exist per photo;
  surface them more prominently in the admin upload UI and keep them clearly
  **optional**. Consider an event-level "story"/long caption too.
- **Donation context fields (optional, per photo or per event):**
  - `recipient` — the church person / family the donation went to
  - `donation_note` / `purpose` — what was given (groceries, medical help, etc.)
  - `amount` — optional; **privacy-sensitive** (see open questions)
  - These can either be new columns on `event_photos` (e.g. `recipient TEXT`,
    `note TEXT`) or reuse the existing event-level `extra` JSON. A dedicated
    per-photo field reads better in a feed.
- **A "Donation" category/type** so donation events are filterable and can drive
  a dedicated "Donations" feed if desired.

**Files to touch (pattern references):**
- `migrations/0012_event_donation_fields.sql` (new) — add any new columns;
  mirror into `schema.sql`; add to the deploy-migrations workflow if used.
- `functions/api/events.js` — accept/return the new fields in POST/PUT and the
  single-event GET.
- `events.html` + `events.js` — add the feed view + caption-forward rendering.
- `admin.html` — add the new fields to the Events form and photo rows.
- `theme.css` — dark-mode styles for the feed cards.

**Open questions for the trustee to decide (before/while building):**
1. **Privacy:** should donation **amount** and **recipient name** be shown
   **publicly**, kept **private** (admin-only), or omitted? (The codebase already
   has an `is_private` pattern on `expenses` that can be reused.) Church-people
   recipients may not want their names/amounts public.
2. **Feed granularity:** one post **per photo**, or one post **per event** with a
   gallery? (Instagram-style usually = per photo/short-set.)
3. **Grid vs feed:** replace the grid with the feed, or offer a **toggle**?
4. Any need for likes/reactions or comments (probably out of scope — the site
   is view-only for the public)?

### 2. R2 storage setup (infra — trustee action)

Photos currently work via the **base64-in-D1 fallback**. To move to R2 (better
quality, no DB bloat, free tier):
- Create R2 bucket `ljm-event-photos` in the Cloudflare dashboard.
- Add the `EVENT_PHOTOS` binding under Pages → Settings → Functions for
  **Production and Preview**.
- Details in `EVENTS_SETUP.md`. No code change needed — the API auto-detects the
  binding. Existing base64 photos keep working; only new uploads go to R2.

### 3. Nice-to-haves (backlog)
- Per-photo/gallery **reordering** in admin (drag to set `sort_order`).
- **Migrate existing base64 photos to R2** after R2 is enabled (one-time script).
- Lazy-load / pagination if the number of events grows large.
- Share buttons / deep-link to a single event (e.g. `events.html?id=NN`).

---

## How to pick this up
1. Read `EVENTS_SETUP.md` and the "Already shipped" section above.
2. Confirm the four **open questions** under task 1 with the trustee.
3. Implement task 1 following the referenced files (clone the existing patterns).
4. Verify with `npm test`, then `npx wrangler pages dev .` + the browser (see the
   verification section in the repo's PR #11 for how the API + page were tested).
