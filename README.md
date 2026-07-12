# LJM Church Contributions

The Light of Jesus Ministry (LJM) contributions portal — a public-facing fund/giving dashboard plus an admin console for the church's pastor and volunteers.

## Stack

This is a **static site with no build step** — plain HTML/CSS/vanilla JavaScript, no framework, no bundler, no `package.json`-driven build. `package.json` in this repo exists only to run the test suite (see [TESTING.md](TESTING.md)); it plays no part in the deployed site.

| Layer | What it is |
|---|---|
| Frontend | Multi-page site (`index.html`, `admin.html`, `members.html`, `funds.html`, `impact.html`, `sandha.html`, `about.html`, `member.html`), shared logic in root-level `.js`/`.css` files |
| Backend | [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) — one file per route under `functions/api/*.js` |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite), binding name `DB` — schema in `schema.sql`, incremental changes in `migrations/*.sql` |
| Payments | [Razorpay](https://razorpay.com/) checkout, verified server-side in `functions/api/webhook.js` |
| Auth | Google Identity Services on the client, verified server-side against Google's `tokeninfo` endpoint — see `functions/api/_lib.js` |
| Deploy | GitHub Actions → Cloudflare Pages (`.github/workflows/deploy.yml`), on every push to `main` |
| Tests | `node --test` + Node's built-in `node:sqlite`, no external dependencies — see [TESTING.md](TESTING.md) |

## Local development

There's no dev server for the frontend — open the HTML files directly, or serve the repo root with any static file server. For the API layer, use [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npx wrangler pages dev . --d1=DB
```

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for creating and binding the D1 database, and applying `schema.sql` for a fresh install.

## Running tests

```bash
npm test
```

See [TESTING.md](TESTING.md) for how the test harness works and the conventions for adding new tests.

## Feature documentation

- **[ADMIN_CONSOLE_GUIDE.md](ADMIN_CONSOLE_GUIDE.md)** — the admin console's navigation structure (grouped sections) and what each one does.
- **[THEME_AND_DESIGN_SYSTEM.md](THEME_AND_DESIGN_SYSTEM.md)** — the light/dark design token system, how dark mode works, and the color palette.
- **[FAMILIES_AND_SANDHA.md](FAMILIES_AND_SANDHA.md)** — grouping believers into families/households, and how Sandha (monthly dues) billing works per-family vs. per-individual.
- **[BIBLE_VERSES.md](BIBLE_VERSES.md)** — the Bible verse data dictionary, the King James Version starter seed, and how to import a complete translation (including Tamil O.V.).
- **[TESTING.md](TESTING.md)** — the test suite, and the project's other (non-automated) verification tools.
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** — creating and binding the D1 database.

## Data model

Every table lives in `schema.sql` (the full baseline, for a fresh install) with incremental `migrations/000N_*.sql` files for applying changes to an already-running database (`npx wrangler d1 execute <db-name> --remote --file=migrations/000N_....sql`). Key tables:

| Table | Purpose |
|---|---|
| `members` | Individual believers — name, contact info, optional `family_id`/`relation`/`date_of_birth` |
| `families` | Households — name, address, contact, `head_member_id` |
| `contributions` | Giving ledger, linked to a member by name and a fund by slug |
| `funds` | Dynamic fund registry (goal, visibility, system vs. custom funds) |
| `purchases` | "What We Bought" — public purchase ledger, attributed to the admin who logged it |
| `expenses` | General church spending, admin-attributed, can be marked private |
| `wishlist` | Planned purchases shown on the public homepage |
| `sandha_payments` / `sandha_family_payments` | Monthly dues, per-individual (legacy/ungrouped) and per-family |
| `roles` / `member_roles` | Permission scopes and email→role mapping |
| `config` | Generic key/value settings (goals, pastor contact info, verse-of-the-month/year, About page content) |
| `bible_versions` / `bible_verses` | Bible verse data dictionary (see BIBLE_VERSES.md) |
| `activity_logs` | Audit log of every admin mutation and visitor view event |

## A note on the repo's other markdown files

Most of the `.md` files at the repo root (`APPS_SCRIPT_*`, `TECH_FUND_*`, `QUICK_*`, `STEP_BY_STEP_SETUP.md`, `SHEET_FORMULAS.md`, `URL_REPLACEMENT_GUIDE.md`, `UPDATES_COMPLETE.md`, `GOAL_AMOUNT_SETUP.md`, `README_RECURRING.md`) document the **pre-migration Google Sheets + Apps Script backend** this project used before moving to Cloudflare D1, and are kept for historical reference only — they don't describe the current system. `task.md`, `walkthrough.md`, `POST_MIGRATION_SAFETY_REPORT.md`, and `UI_REDESIGN_REPORT.md` are living/current project history.
