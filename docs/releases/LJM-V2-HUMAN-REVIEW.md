# LJM V2 — Human Review Sequence

| | |
|---|---|
| **Purpose** | The exact manual sequence for the owner to review V2 as a real user. |
| **Reviewer identity** | `albertjoshrock101@gmail.com` — real Google account, already a hardcoded super-admin and already seeded into the V2 beta allowlist. No code changes were made or needed for login (see verification below). |
| **Production URL** | `https://light-of-jesus-ministry-contributions.pages.dev/` (as documented in `WEBSITE_SHARING_MESSAGE.md` / `MEMORY_UPDATE.md`, and matches `deploy.yml`'s `projectName`). |

## Verification behind this document (evidence, not assumption)

- **`origin/main`** is at commit `7772abc` (*"Close a CONTRIBUTING.md coverage gap..."*), which is the **same commit** as `origin/claude/ljm-v2-production-impl-amrdbz` — that branch is already fully merged into `main`. There is no separate "final V2 branch" waiting to be merged; `main` already **is** the full V2 build.
- **Deploy workflow** (`.github/workflows/deploy.yml`, triggers on push to `main`): its most recent run, [#31956239567](https://github.com/AlbertJoshwa1802011/ljm-church-contributions/actions/runs/31956239567), ran `npm test` then published to Cloudflare Pages for head commit `7772abc` — **status: success**, 2026-08-16T15:38 UTC. The current code, including V2 and the beta-login mechanism, **is live in production.**
- **Migration workflow** (`.github/workflows/apply-d1-migration.yml`, manual `workflow_dispatch`, free-text `file` input — not the older `deploy-migrations.yml`, whose dropdown only lists 0005–0011 and does not include 0013): run [#30197714229](https://github.com/AlbertJoshwa1802011/ljm-church-contributions/actions/runs/30197714229) applied `migrations/0013_beta_access.sql` against the real remote D1 (`ljm-contributions-db`) on 2026-07-26T10:08 UTC — job log shows `Applying file: migrations/0013_beta_access.sql`, `Processed 2 queries`, `success: true`. **The `beta_testers` table and its seed row for `albertjoshrock101@gmail.com` are confirmed present in production D1, not just in `schema.sql`.**
- Later runs (`#22`–`#25`, 2026-08-16T15:34–15:36) applied the Phase 0–5 ministry migrations (0015–0022) against the same production D1, immediately before the `deploy.yml` run that published the matching code — a complete, already-executed rollout.
- **Order actually run, for the record:** migrations applied first (`apply-d1-migration.yml`, workflow_dispatch, several runs) → then code deployed (`deploy.yml`, triggered automatically by the push that already happened). Both steps are done; there is nothing pending in that sequence.
- **No production migration was run by this session.** All evidence above is read from existing GitHub Actions run history, not re-triggered.

**Conclusion:** login, the beta allowlist, and the full V2 code path are already live in production, right now, with no further action required to make review possible.

---

## A. Login

1. Open `https://light-of-jesus-ministry-contributions.pages.dev/beta-login.html`.
2. Click **Sign in with Google**.
3. Choose the `albertjoshrock101@gmail.com` account (this is a real Google OAuth prompt — no email can be typed or substituted).
4. Confirm you're redirected to `/` and it shows the **V2 Home** page, not the old dashboard.
5. Browse to a couple of the V2 pages below and confirm they load without a further sign-in prompt.
6. On the V2 Home page, use its own "Sign in with Google" control (same account) — this is the separate, unrelated `/api/auth` identity check that resolves your member/admin status inside the app. Confirm the UI recognizes you as an admin (e.g. a link to `/admin.html` or an admin-only affordance is visible).

## B. V2 public review

Visit each and confirm it renders real (not placeholder) content and no console errors:

- [ ] Home — `/` (after beta-login) or `/v2/index.html`
- [ ] Our Giving — `/our-giving.html` or `/v2/our-giving.html`
- [ ] Events — `/events.html` or `/v2/events.html`
- [ ] Give Flow — `/give-flow.html` or `/v2/give-flow.html` (do not complete a real payment — see §D)
- [ ] My Giving — `/my-giving.html` or `/v2/my-giving.html`
- [ ] Churches — `/v2/about.html` (Our Churches section)
- [ ] Programs — `/v2/programs.html`
- [ ] Blog — `/v2/blog.html`
- [ ] Promises — shown on V2 Home's promise card, sourced from `/api/promises`
- [ ] Testimonies — `/v2/testimonies.html`
- [ ] Prayer — `/v2/prayer.html`
- [ ] Contact — `/v2/contact.html`

## C. Admin review

In `/admin.html` (signed in as `albertjoshrock101@gmail.com`):

- [ ] Login gate resolves correctly (no ReferenceError, sign-in button renders).
- [ ] Create/edit an Event; confirm it appears on the public `/v2/events.html` (or delete it after).
- [ ] Exercise one content-management panel: Testimonies, Prayer inbox, or Contact inbox (moderate/change status).
- [ ] Churches / Programs / Blog: add or edit one item where available; confirm the public V2 page reflects the change.
- [ ] **Beta Access panel**: confirm `albertjoshrock101@gmail.com` is listed (it should already be, from migration 0013).

## D. V1 regression sanity

Confirm the frozen, pre-V2 experience is untouched for a browser **without** the beta cookie (e.g. an incognito window that never visits `/beta-login.html`):

- [ ] Existing homepage (`/`) shows the original dashboard, not V2.
- [ ] Giving flow: the Razorpay checkout modal opens correctly from the original `index.html` CTA.
- [ ] **Do NOT complete a real Razorpay payment** — open the checkout, confirm it loads with the right amount/fund, then close it without submitting.
- [ ] Existing admin console (`/admin.html`) still works exactly as before.
- [ ] Existing contribution views (`member.html`, `members.html`, `/api/contributions`) show real, correct numbers.

## E. Mobile/desktop

- [ ] Desktop browser, full width.
- [ ] Phone (or a narrow/responsive browser view) — check the hamburger nav, Give Flow modal, and admin console don't break or overflow.

---

## OWNER ACTION NOW

**Everything is already deployed. No merge, migration, or deploy action is needed from you before reviewing.**

1. Go to `https://light-of-jesus-ministry-contributions.pages.dev/beta-login.html` right now.
2. Sign in with `albertjoshrock101@gmail.com`.
3. Work through sections **A–E** above on your phone and your desktop.

The only branch with no counterpart in `main` is `claude/ljm-v2-test-email-login-jr34im` — it contains **documentation only** (an investigation write-up), nothing your login flow depends on. It does not need to be merged for you to review V2 today; merge it later, at your convenience, only if you want that write-up kept in `main`'s history.
