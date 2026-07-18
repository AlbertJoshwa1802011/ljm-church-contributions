# 10 · Contribution data detail views: contributor history modal + My Giving

| | |
|---|---|
| **Status** | 🚧 In progress — commit as each item lands |
| **Scope** | Same static-mockup rules as prior rounds — no backend/API/`script.js` changes, admin console untouched |
| **Requested by** | User: "how will be contribution pages data will be showing in our pages, if we don't design any app flow or UI/UX... please initiate and give me the images" |

## The gap

`our-giving.html`'s Recent Activity rows and Top Contributor tiles are
currently static — clicking them does nothing. That's a real gap: **this
feature already exists in production** (`script.js`'s
`openContributorDetailModal()`) — clicking any name on the live public
dashboard today opens a plain modal with that person's total given, gift
count, and a full date/amount/notes table. We simply hadn't carried it into
the redesign yet, so the new mockup was silently missing a real, working
piece of the current site.

There's a second, related gap: nothing anywhere (production or mockup) gives
a **signed-in member their own personal giving view** — a "my history" page
distinct from the public per-contributor lookup. That's not a gap in the
redesign, it's a feature that doesn't exist yet at all — worth proposing
given round 4 already built the sign-in-click demo.

## 1. Contributor Giving-History modal (real feature, redesigned)

Clicking a **Recent Activity** row or a **Top Contributor** tile on
`our-giving.html` now opens a modal: avatar + name, Total Given / Total
Gifts stat pair, then a scrollable date/amount/method list — same fields as
the real `openContributorDetailModal()`, restyled to match this design
system (card, accent tones, tabular numerals) instead of the bare inline-styled
modal it is today.

**Data honesty note:** the modal's **totals and gift counts are the real,
verified round-2 figures** (Hepsi ₹3,500/7 gifts, Muthukumar ₹3,500/7,
Allwin Prabhu ₹3,500/2, Albert Joshwa A ₹2,614/21, Adlin ₹2,500/5, Augustin
₹2,000/4). The **individual line-item dates/amounts inside each list are a
reconstruction**, not the literal ledger — I have the real aggregate per
contributor but not every individual gift's exact date from this round's
research, so the mockup splits each total into that many plausible entries
(and factors in the one real dated entry we do have per person, from Recent
Activity, where available). Every list sums exactly to the real total. This
is flagged in a small footer note inside the modal itself, same honesty
standard as the wishlist caveat in round 2.

**Flagging, not assuming — a privacy question worth your explicit call:**
this modal (old and new) means **anyone visiting the public site can see any
named contributor's complete individual giving history**, not just totals.
That's already true in production today, so the redesign isn't introducing
new exposure — but it's exactly the kind of thing worth pausing on now that
we're rebuilding it with fresh eyes. Options if you want to change it before
real implementation: (a) keep as-is (full history, public — today's
behavior), (b) show only the total + count publicly, gate the itemized list
behind being signed in, or (c) remove itemized public detail entirely and
only offer it on the member's own "My Giving" page (§2). Not changed here;
this round just redesigns what already exists.

## 2. My Giving — new personal dashboard (proposed, not in production today)

New page `my-giving.html`, reachable from the header's signed-in user-chip
via a new **"My Giving"** link (added next to the existing Admin Access
pill, shown whenever signed in — on all 4 existing pages). Shows:

- A personalized greeting ("Welcome back, Priya").
- All-time total + this-year total, side by side.
- Full personal gift history (same table pattern as the contributor modal,
  since it's the same underlying data, just scoped to "you").
- A receipt-download affordance per gift (demo only — no real PDF/export
  exists yet; would need new backend work).
- A "Give Again" CTA.

This is a **net-new proposed feature** — nothing like it exists in
production. (Separately, real production does have a per-member view for
**Subscriptions/Sandha dues**, `functions/api/subscriptions.js`'s
`?member=Name` — that's monthly membership dues, a different feature from
fund contributions, and out of scope here; noting it only so it isn't
confused with this page.) Building it for real means either a new
`?email=`/`?member=` filter on `/api/contributions` or client-side filtering
of the existing full fund response — small, low-risk backend surface, but
still new surface needing its own tests per `CONTRIBUTING.md` before it
ships.

## Task tracker

- [x] Research existing production behavior (`openContributorDetailModal`
      in `script.js`) before designing anything.
- [x] Write this doc, commit before building.
- [ ] Build the Giving-History modal on `our-giving.html`.
- [ ] Build `my-giving.html` + link it from the signed-in user-chip on all
      4 pages.
- [ ] Verify desktop (1440/1024px) fully unaffected on the 4 existing
      pages; verify the new modal/page work correctly at all 3 breakpoints.
- [ ] Screenshot (desktop priority, since the user asked to confirm laptop
      is finished) + a couple mobile shots, update tracker, commit, push.
- [ ] Send images + answer the "is laptop done?" question directly.
