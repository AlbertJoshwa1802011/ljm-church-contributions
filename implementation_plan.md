# Next-Gen Upgrade: Google-Level Material UI/UX & Super Admin Role Config

This plan details the visual redesign of the portal to a premium Google-Level Material Theme alongside a database-driven Super Admin Role Configuration system.

## User Review Required

> [!IMPORTANT]
> **Role Database Tables**: We will add `roles` and `member_roles` tables to the D1 schema, allowing you to dynamically assign custom permission scopes (e.g. `edit_purchases`, `view_members`, `manage_roles`) to any email directly from the admin panel.
> 
> **Premium Google-Level UI/UX**: The UI will transition from blocky cards to a modern, fluid material layout featuring:
> * **Google Fonts**: Outfit (headings) and Inter (body).
> * **Material Elevations**: Clean shadows, organic borders, and glassmorphic navigation bars.
> * **Bottom Tabs & Sheet Drawers**: Fluid sheets sliding up on mobile, providing an app-like feeling.

## Proposed Changes

---

### Database Layer (Cloudflare D1 SQL Schema additions)

#### [MODIFY] [schema.sql](file:///Users/albert-18677/Documents/church-contributions/schema.sql)
We will add tables to support dynamic role configuration:
* `roles`: Defines role names and their corresponding JSON permissions string (e.g., `admin`, `{"permissions": ["edit_purchases", "view_members"]}`).
* `member_roles`: Maps user emails to specific roles (e.g., `thinkmuthu@gmail.com` ➡️ `super_admin`).

---

### Backend API (Cloudflare Pages Functions)

#### [NEW] [/functions/api/roles.js](file:///Users/albert-18677/Documents/church-contributions/functions/api/roles.js)
Provides CRUD endpoints for managing custom roles, permissions, and email mappings:
* `GET /api/roles`: Returns all defined roles and email mappings.
* `POST /api/roles`: Configures a new custom role or links an email to a role.
* `DELETE /api/roles`: Deletes a role mapping.

---

### Frontend Layer (Google-Level Redesign)

#### [MODIFY] [style.css](file:///Users/albert-18677/Documents/church-contributions/style.css)
* Replace deep purple gradient with a sleek, clean Google-style Material Palette (adaptive Slate, Soft Blues, Premium Card Elevations).
* Transition all card shapes to smooth organic borders (`border-radius: 24px` / `28px`).
* Add fluid Micro-animations for hover states, tab switching, and modal slide-ups.

#### [MODIFY] [admin.html](file:///Users/albert-18677/Documents/church-contributions/admin.html)
* Add a **Super Admin Roles Panel** tab/section.
* Provide forms to:
  1. Add a customized role (e.g. `Wishlist Editor`) and select checkbox permissions.
  2. Map any member's email address to a role.

#### [MODIFY] [index.html](file:///Users/albert-18677/Documents/church-contributions/index.html)
* Restructure UI elements with material design guidelines.
* Render the dynamic Wishlist using Google Material cards.

## Verification Plan

### Automated Tests
* Verify local SQL execution:
  ```bash
  npx wrangler d1 execute ljm-contributions-db --local --command="SELECT * FROM roles;"
  ```

### Manual Verification
* Access the admin roles configuration panel, add a test email, log in with Google Sign-In, and verify that the corresponding administrative permissions are dynamically unlocked.
