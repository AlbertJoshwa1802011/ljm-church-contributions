# Phase 2 Handoff Prompt for Higher Model (Sonnet/Opus)

This document contains the remaining complex features/fixes that require architectural planning and high-quality design decisions. **Use this prompt with Claude Sonnet or Opus when Phase 1 is merged.**

---

## Context
You're continuing work on the Light of Jesus Ministry Church Contributions web app. Phase 1 (straightforward bug fixes and simple features) has been completed and merged. This Phase 2 focuses on architectural/UX-heavy features.

**Key Background:**
- Static HTML/CSS/JS site (no build step)
- Cloudflare Pages + D1 SQLite backend
- Admin console at `/admin.html` (all Subscriptions/families/Bible management)
- Public site: home, members, funds, contributions, about, impact pages
- Dark mode: use `/admin-session.js` color palette as reference (warm dark palette: #16140f bg, #e2825f accent)
- Auth: Google ID tokens + legacy email tokens (dev mode)
- Test framework: Node 22 `node --test` with D1 mock harness

---

## PHASE 2: Complex Features Requiring Architecture Planning

### Bug Fixes (5 items)

#### 15) Family Creation - Autocomplete Lookup + Tree View
**Current State:** Family creation form has manual text inputs for member names. No lookup of existing people.

**Requirements:**
- When creating/editing families, admin types a name → autocomplete dropdown shows matching people from `members` table
- Admin can click to select existing person (reuse existing record)
- OR continue typing to create new person if no match
- **UI Change:** Replace current family form with:
  1. Family name input
  2. Add members section with autocomplete fields (name lookup)
  3. For each member: name (autocomplete) + relation dropdown + DOB input
  4. **Stretch goal:** Show family tree diagram (parent-child-spouse relationships visually)

**Design Considerations:**
- Autocomplete endpoint: New GET `/api/families?action=member_search&q=<name>` (public read)
- Or extend existing GET with query param
- How to handle: "Name partially typed, user waits for results vs. submits anyway"?
- Mobile: autocomplete dropdown must not overflow screen
- Tree visualization: Consider using SVG or CSS Grid (no D3 dependency, keep vanilla JS)

**Related Bugs (16-17):**
- **16) Family Categorization & Color Coding:** After families created, UI should group them (by status, alphabetically, by head person). Option: assign color tags for quick visual scanning. Consider card-based grid with color-coded headers.
- **17) Prevent Duplicate Member in Family:** Before adding member to family, check if `member.family_id IS NOT NULL` and reject with error "Person already in Family X".

**Estimate:** High (4-6 hours) — requires new component, DB query, frontend state management

---

#### 18) Families Tab - Add Common Header
**Current State:** Families section missing header row (like other admin tabs have).

**Requirement:** Add a sticky header row above family list showing column labels (Family Name, Members, Head, Contact, Actions).

**Note:** This is simple (CSS/HTML) but was grouped with harder fixes for context.

**Estimate:** Low (30 min)

---

### Feature Requests (7 items)

#### Feature 1) Wishlist - Image Upload Support
**Current State:** Wishlist items stored with name, cost, priority, notes. No image field.

**Requirements:**
- Add `image_url TEXT` column to `wishlist` table (migration needed)
- Admin form: file upload input for wishlist item image
- Store image on Cloudflare R2 (or as base64 blob in DB if small)
- Public wishlist display: show thumbnail image alongside item card
- Mobile: image scales responsively

**Upload Strategy Decision Needed:**
- Option A: Inline base64 in DB (simple, DB bloat risk)
- Option B: Cloudflare R2 (production-grade, requires creds in env)
- Option C: Data URL placeholder for MVP, upgrade later

**Estimate:** Medium (2-3 hours)

---

#### Feature 2) Admin Console - User Profile Shortcut (Top-Right)
**Current State:** Admin logged in, but no quick access to profile/logout in mobile UI.

**Requirements:**
- Top-right corner: show admin email/name as clickable shortcut (like Google account switcher)
- Click → dropdown with: Profile settings (future), Change password (future), Logout
- Mobile: compact icon (initial letter avatar) → tap → menu
- Desktop: show email, hover for menu
- Integrate with existing admin-session.js logout flow

**Current Code Reference:**
- `admin-session.js` has `destroySession()` and `LJMAdmin.createSession()`
- Admin bar already has logout button → reuse that logic

**Estimate:** Low (1-2 hours)

---

#### Feature 3) Login Email Mapping - User Identity
**Current State:** When user logs in via Google, we have their email. But no explicit link between login email and `members.email` or `members.id`.

**Requirements:**
- After Google login, query `members` table: find `email` match
- If match: set `current_user_id` in session (or sessionStorage)
- If no match: allow login but show "You're not in our member directory yet" message (allow read-only access)
- Future use: "My contributions" page can filter by `current_user_id`
- **New table option:** `login_mapping` table linking `google_email` → `member_id` (for cases where they differ)

**Design Decision:** Should login automatically map? Or require admin to create mapping?
- **Suggested:** Automatic on first match, then allow admin to override in settings

**Estimate:** Medium (2-3 hours) — DB schema + login flow modification

---

#### Feature 4) Delete Fund (Already in Phase 1)
**Note:** This was in Phase 1 plan. If not done, move to Phase 2 with safeguards:
- Tech & Christmas funds: NOT deletable (hardcoded check in API)
- Only `albertjoshrock101@gmail.com` can delete custom funds (add to permission check)
- Other admins: show "Archive fund" button instead (soft delete, set `status='archived'`)

**Estimate:** Low (1-2 hours if Phase 1 missed it)

---

#### Feature 5) Admin Top Header - Sticky + Menu Options
**Current State:** Admin console has sidebar nav on desktop, grouped buttons on mobile. No persistent top header bar.

**Requirements:**
- Fixed header bar at top of admin.html (above sidebar on desktop, above mobile tabs)
- Show: LJM logo/title, search box (future), admin user profile, quick links
- **Sticky behavior:** Header stays visible while scrolling down long pages
- Menu items: Quick access to Overview, Funds, Members, Subscriptions, Settings
- Mobile: Header collapses/adapts gracefully

**Coordinate with Feature 2:** User profile in top header could be the same shortcut.

**Estimate:** Medium (2-3 hours)

---

#### Feature 6) Fund Archival System
**Current State:** Funds can only be deleted (hard delete). Tech & Christmas are system funds.

**Requirements:**
- Add `status TEXT DEFAULT 'active'` to funds table (if not present from migrations)
- Values: 'active', 'archived', 'deleted'
- Tech & Christmas funds: `status` always 'active', cannot be changed
- Only `albertjoshrock101@gmail.com`: can permanently delete (set `status='deleted'`)
- Other admins: can only archive (set `status='archived'`)
- Archived funds: hidden from public UI, visible to admin (mark as "[Archived]")
- API: /api/funds GET should filter `WHERE status != 'deleted'` by default

**New Migration:** Add `status` column if not present

**Estimate:** Medium (2-3 hours)

---

#### Feature 7) Event Management System - Major Feature
**Current State:** No event support. Need full CRUD + photo gallery.

**Requirements:**

**Database Schema:**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,          -- YYYY-MM-DD
  location TEXT,
  cover_photo_url TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_photos (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

**Admin Features:**
- New "Events" section in admin console
- Create event: title, description, date, location, cover photo
- Upload multiple photos to event
- Edit event details
- Delete event (soft or hard)
- Reorder photos in gallery

**Public Features:**
- New "Events" page showing upcoming events + past events
- Click event → full event detail page with photo gallery
- Gallery: lightbox/modal view with prev/next navigation
- Mobile: responsive gallery grid (2-3 columns)

**Photo Upload Strategy:**
- Use Cloudflare R2 for production
- For MVP: support base64 data URLs or external image links
- Store `photo_url` as full URL in DB

**API Endpoints Needed:**
- GET `/api/events` — list all (public)
- GET `/api/events/:id` — event detail + photos (public)
- POST `/api/events` — create (requires `manage_content` permission)
- PUT `/api/events/:id` — edit
- DELETE `/api/events/:id` — delete
- POST `/api/events/:id/photos` — upload photo
- DELETE `/api/events/:id/photos/:photoId` — remove photo

**Frontend:**
- New admin tab: "Events" with create/edit/upload UI
- New public page: `/events.html`
- Event detail page: `/events/:id.html` or modal overlay

**Estimate:** High (8-12 hours) — largest feature, requires full CRUD + upload + public display

---

## Summary of Phase 2 Complexity

| Task | Complexity | Est. Hours | Priority |
|------|-----------|-----------|----------|
| Bug 15 (Family lookup + tree) | High | 4-6 | P0 - Core feature |
| Bug 16 (Family categorization) | Medium | 2-3 | P1 - UX improvement |
| Bug 17 (Duplicate member check) | Low | 0.5 | P0 - Data integrity |
| Bug 18 (Family header) | Low | 0.5 | P1 - Polish |
| Feature 1 (Wishlist images) | Medium | 2-3 | P1 - Nice-to-have |
| Feature 2 (User profile shortcut) | Low | 1-2 | P1 - UX improvement |
| Feature 3 (Email mapping) | Medium | 2-3 | P2 - Future feature |
| Feature 4 (Delete fund) | Low | 1-2 | P1 - Admin feature |
| Feature 5 (Admin top header) | Medium | 2-3 | P1 - UX improvement |
| Feature 6 (Fund archival) | Medium | 2-3 | P1 - Admin feature |
| Feature 7 (Events system) | High | 8-12 | P0 - Major feature |

**Total Phase 2: ~30-42 hours of careful work**

---

## Recommendations for Next Agent

1. **Start with bugs 15-18 + features 1-6** — these are manageable in one session
2. **Reserve Feature 7 (Events) for separate session** — it's substantial enough to warrant its own focused sprint
3. **Coordinate with user on photo upload strategy** before implementing Feature 7
4. **Test thoroughly:** Each feature should have unit tests + E2E verification
5. **Migrate as you go:** Any schema changes → new migration file in `migrations/0010_*.sql` format
6. **Commit incrementally:** Each feature/fix = separate commit
7. **Document:** Update relevant .md files (ADMIN_CONSOLE_GUIDE.md, etc.)

---

## Key Context for Next Agent

- **Auth:** Admins identified by `HARDCODED_SUPER_ADMINS` in `_lib.js` or `member_roles` table
- **Permissions:** Check `manage_content`, `manage_members`, `manage_funds`, `manage_roles`
- **Styling:** Dark mode palette in `theme.css` — use `[data-theme="dark"]` selector
- **Mobile:** Always test at 375px width (iPhone SE)
- **Database:** D1 is SQLite; use `db.prepare(sql).bind(...).first()/.all()/.run()`
- **Testing:** Mock D1 in `tests/helpers/mock-d1.mjs`; run `npm test`

---

## Handoff Checklist for Next Session

- [ ] Phase 1 fully merged into main
- [ ] All Phase 1 tests passing
- [ ] Production migrated (if schema changes)
- [ ] Phase 2 priorities clarified with user
- [ ] Photo upload strategy decided (R2 vs. base64)
- [ ] Start with bug 15 (family lookup)
- [ ] Commit + test incrementally
- [ ] Flag any blockers early

**Contact:** If stuck on design decision, ask user for clarification before implementing.

---

**Next Agent: You inherit excellent context + full Phase 1 complete. Good luck! 🚀**
