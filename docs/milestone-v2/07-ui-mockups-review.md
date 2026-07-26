# 07 · UI/UX Mockups for Review

| | |
|---|---|
| **Product** | Light of Jesus Ministry — Worldwide Ministry App |
| **Status** | 🔍 **Awaiting your review** — nothing here is implemented or wired to real data |
| **Scope** | User-facing pages only. Admin console is untouched, per your instruction. |
| **Files** | [`mockups/home.html`](../../mockups/home.html) · [`mockups/our-giving.html`](../../mockups/our-giving.html) · [`mockups/give-flow.html`](../../mockups/give-flow.html) · [`mockups/events.html`](../../mockups/events.html) — open any of them in a browser. Bottom-left toggle = Guest/Member/Admin (see §7); bottom-right = light/dark. |

> **These are static previews, not code changes.** No API, no `functions/api/*`, no `script.js`, no `webhook.js` — nothing that touches real data or the giving path was modified. This is purely "here's what the redesign could look like" for you to react to before we write a single line of production code.

---

## Round 2 — your follow-up feedback, addressed

- **§7: the real logo** — replaced the generic ✝ placeholder with the actual mark (red heart + open Bible).
- **§8: where's the admin console?** — a small, realistic "signed in" affordance in the header.
- **§9: the Tech Fund numbers are now verified against live production**, not estimated — and my original guesses were meaningfully wrong. Full accounting below.
- **Mobile and tablet** — fixed a real header-overflow bug and a mobile-only collision between the demo toggles and the real sticky Give/Pray/Contact bar. All 4 pages verified at 390px / 820px / 1440px with zero horizontal overflow.
- **New page: `events.html`** — a photo gallery ("sharing every moment, like a gift") with 8 example events, each with a placeholder photo strip, plus a full-gallery view. Production currently has **zero real events** (confirmed via the live `/api/events` endpoint), so these are clearly-labeled temporary placeholders.

---

## 1. What I did before designing anything

You asked me to fully understand the contribution flow end-to-end before touching UI — money is really moving through this app, so I treated that as non-negotiable. Two research passes:

1. **Every stat on the public dashboard**, traced to its exact formula and source field — KPI chips, goal donut/progress/milestones, giving pace, recent activity, top contributors, the contributors directory, the 5 giving-insight cards, 3 pie charts, the enhanced-stats mini dashboard (time series + contributor growth), and the Impact ("What We Bought") page totals.
2. **The complete Give-to-receipt path** — the contribution modal → Razorpay checkout → `webhook.js` (signature verify, idempotent insert, member upsert, Sheets sync) → the read models (`contributions.js`, `funds.js`) that feed everything back to the page.

Full detail lives in the research (available on request); this document distills what matters for your review.

## 2. What I found — two real gaps, flagged for a decision (not fixed yet)

These are pre-existing, live-production behaviors, surfaced so you can decide when/whether to fix them — I have **not** touched any code:

1. **The only "receipt" today is a browser `alert()`.** After paying, the user sees one JavaScript alert box with the payment ID, an 8-second countdown, then a blind page reload. If the webhook hasn't finished recording the payment by then (Sheets sync is async and can lag), the reload just shows old numbers — no error, no "still processing" state, nothing. A user who pays and doesn't see their gift has no idea if it worked. **This is the main thing the new Give-flow mockup proposes fixing** (see §4).
2. **Dynamic/custom funds get silently mis-filed.** `webhook.js`'s fund-name normalization only recognizes `tech-contributions` and `christmas-fund` — anything else (e.g. a new "Building Fund" created via the admin's dynamic-funds feature) falls back to Tech Fund. Since the new design proposes more giving causes (§3), this needs a real fix before custom funds go live for giving — flagging now so it's not a surprise later.

(A third, minor one: Impact's "Funds Active" stat is dead code — always shows 0 due to a missing API field. Not urgent, noted for the backlog.)

## 3. The one structural decision I made — please react to this specifically

Today, **every stat lives on one page** (`index.html`) — KPI strip, goal chart, activity feed, top contributors, 5 insight cards, 3 charts, and 2 more charts, all stacked on the page you land on. It reads like a finance dashboard, not a ministry homepage.

**Proposal:** split it in two, matching the App Flow doc we already agreed on:

- **Home** — inspiration first (Today's Promise), then Give/Pray/Connect, then a **condensed 4-number teaser** ("Giving at a Glance": Collected, Available, Contributors, Goal — with a link out), then a testimony and what's-happening. Calm, welcoming, not a wall of numbers.
- **Our Giving** (new page) — the **entire** stats report, every single number from the research, none dropped — just reorganized as a transparency report: KPI row → goal story (donut + pace) → activity + top givers → insights → charts → wishlist.

This directly answers your "we're showing some stats, we need it in our new page too, but more professional" — nothing is cut, it just gets a page worthy of it instead of competing with the homepage's job of making a first-time visitor feel welcome. **If you'd rather keep a fuller stats summary directly on Home, tell me — this is the easiest thing to change before we build for real.**

## 4. The Give flow — same backend, better confirmation

`give-flow.html` has two things to look at (toggle at the top of the page):

- **"Give Form"** — the same fields as today's modal (fund choice, existing/new member, month, payment-status pills, amount chips, email/phone), just restyled and given room to breathe. **Calls the exact same Razorpay checkout — no backend change.**
- **"After You Pay"** — a **proposed** replacement for the bare `alert()`: a real confirmation screen with three states (Processing → Confirmed with a proper receipt → a graceful "taking longer than usual" state instead of silent failure). This is a UX proposal, not built — implementing it means adding a lightweight status check after payment (poll or short-lived confirmation endpoint), which is new backend surface and would need its own tests per our safety process before it ships.

## 5. Design system — inherited, not invented

Per your "professional, like Jesus Calls" ask, I leaned on the design language your team already approved in `04-uiux-design-spec.md`, corrected against the **real** `theme.css` (the spec doc had stale dark-mode values — actual dark mode is true black `#000000`, which the mockups use correctly). Same fonts (Lora + Inter), same accent (`#3D6079` Wedgwood, swappable), same light/dark system — nothing new invented except the `--gold` accent for sacred content, which was already proposed and approved in that same spec doc.

## 6. Events & Photos — a new page (`events.html`)

You asked for event photos to be added now — "like sharing a gift" — so people can see what's happened across both churches. Production has **zero events in the database today** (the live `/api/events` endpoint returns `{"events":[],"categories":[]}`), so there's nothing real to show yet. I built:

- **8 example events** spanning both churches and a few categories (Worship, Youth, Outreach) — Christmas Carol Night, a Youth Camp retreat, Baptism Sunday, a food-distribution outreach, and others — each with a cover image, date, church/category tags, and a 3-photo preview strip with a "+N more" count.
- A **featured full-gallery view** at the bottom of the page (12 photos in a grid) demonstrating what browsing one event's complete gallery looks like.
- Every photo is a **clearly-systematic gradient placeholder** (not a fabricated "real-looking" photo) — the mock banner and footer both say so explicitly. When this ships for real, these become actual event photos through the (already-built) events admin feature.

## 7. The real logo

I'd used a generic ✝ as a placeholder. I checked the live site and your actual mark is a **red heart with an open Bible** — now an inline SVG (not an emoji, so it looks the same everywhere) replacing the placeholder on every page, header and footer.

## 8. Where's the admin console?

Nowhere new — exactly as you asked, **the admin console itself isn't touched.** What I added is the *entry point*: a small "signed in" state in the header. Use the **Guest / Member / Admin** toggle (bottom-left on every page) to see it:

- **Guest** (default) — a "Sign in" button, matching today's anonymous-visitor experience.
- **Member** — an avatar + name, no admin link.
- **Admin** — the same avatar + name, plus a subtle gold **"⚡ Admin Access"** pill that links to the existing, unchanged `/admin.html`. No explicit "you are an admin" banner — exactly the quiet affordance you described.

## 9. Verifying the numbers — what I found

You asked me to make sure the Tech Fund values were 100% right. They weren't — my first pass used illustrative placeholder numbers, and when I checked them against the real, live production data (the public `/api/contributions`, `/api/funds`, and `/api/wishlist` endpoints on `light-of-jesus-ministry-contributions.pages.dev`), several were meaningfully wrong:

| Figure | My placeholder | **Real (live, 17 Jul 2026)** |
|---|---|---|
| Collected | ₹38,450 | **₹31,015** |
| Available | ₹14,200 | **₹2,016** |
| Goal progress | 77% | **62%** |
| Unique givers | 58 | **18** |
| Gifts/entries | 96 | **90** |
| Avg. contribution | ₹401 | **₹345** |
| Given online | 82% | **43%** |
| Largest single gift | ₹5,000 | **₹3,000** |
| Most active month | July | **May** (₹8,100) |

Every number across `our-giving.html` and Home's "Giving at a Glance" teaser is now the **real, verified figure** — KPI row, goal donut (now 62%), giving pace (recomputed: ~5 months to goal at the real ₹4,431/month pace, not 2), recent activity, top contributors (now real names — Hepsi, Muthukumar, and Allwin Prabhu are genuinely tied for #1 at ₹3,500 each), and every chart's percentages.

Two things I could **not** verify and want to flag rather than guess at:
- **The wishlist** — `/api/wishlist` returned a `D1_ERROR` when I checked, so I couldn't confirm the current live items. I know from the schema that "In-Ear Monitors" and "HD PTZ Camera" were seeded originally, but the purchase records show in-ear monitors were **already bought** — so that wishlist entry may be stale. I swapped it for a different plausible item and labeled the whole section "illustrative — live wishlist unavailable" rather than assert numbers I couldn't confirm.
- **Dynamic/custom funds** (Building Fund, General Offering, shown in the Give flow's cause picker) **don't exist in production** — only Tech Fund and Christmas Fund are real today. I labeled those two options "Coming soon*" with a footnote rather than imply they're live.

## 10. How to review

1. Open each HTML file directly in a browser (or use the files I sent you). Toggle light/dark bottom-right; Guest/Member/Admin bottom-left.
2. React to **§3's structural split** first — that's the one decision that reshapes everything downstream.
3. React to the Give-flow confirmation proposal (§4) — worth doing even if it's a later phase, since it's the biggest trust gap I found.
4. Check the new **Events** page (§6) and the **real numbers** (§9) — tell me if anything still looks off.
5. Anything you want moved, cut, or restyled — tell me directly; nothing here is final.

Once you sign off, next step is the real implementation plan (updating `03-app-flow.md`/`06-implementation-plan.md` if the structure above changes anything), still following the zero-breakage process in `CONTRIBUTING.md` and `SAFETY-AND-TESTS.md`.
