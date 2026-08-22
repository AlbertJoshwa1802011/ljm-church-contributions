# Real-browser E2E suite (`tests/e2e/`)

Added in the LJM V2 "journey-breaker" QA session (see the session's final
report for what it found). This is a **separate, optional layer** from the
`node --test` suite (`npm test`) described in [`TESTING.md`](../../TESTING.md) —
it exercises real Chromium against a real `wrangler pages dev` + local D1,
which the offline suite structurally cannot (no DOM, no real HTTP routing).

**Not wired into `npm test` or CI.** `package.json`'s `test` script stays the
dependency-free `node --test 'tests/**/*.test.mjs'` glob — e2e specs use the
`*.e2e.mjs` suffix specifically so that glob skips them, and this repo has no
`node_modules`/`package-lock.json` checked in by design (see `TESTING.md`).
Adding a Chromium install step to `.github/workflows/deploy.yml` is a real
infra/cost decision (Playwright + a browser binary is tens to hundreds of MB
and adds real CI minutes) that deserves an explicit call, not something a QA
session should silently wire into the deploy gate.

## Prerequisites

1. **`playwright`** (the library, not the `@playwright/test` runner — this
   suite uses plain `node:test`, same as the rest of the repo) resolvable on
   `NODE_PATH`, plus a Chromium binary. In this session's sandbox both are
   already present globally:
   ```bash
   export NODE_PATH=/opt/node22/lib/node_modules
   export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
   ```
   Elsewhere: `npm install -D playwright && npx playwright install chromium`.
2. **A real local backend** — `wrangler pages dev` against a local D1 with
   `schema.sql` applied, so the pages under test have real data to fetch, not
   just static HTML:
   ```bash
   npx wrangler d1 execute ljm-contributions-db --local --file=schema.sql --persist-to=.wrangler/state
   # .dev.vars: ADMIN_API_TOKEN=<any test value>, ALLOW_LEGACY_EMAIL_TOKEN=true
   npx wrangler pages dev . --local --persist-to=.wrangler/state --port=8788 --ip=127.0.0.1 --compatibility-date=2026-06-01
   ```
3. Run: `E2E_BASE_URL=http://127.0.0.1:8788 npm run test:e2e:legacy`

## Hard network guard

`tests/e2e/helpers/browser.mjs` installs a Playwright route handler on every
context that **aborts** any request to Razorpay, Google OAuth/Identity,
Resend, R2/Cloudflare storage, or this project's own real production Pages
URL. This matters more than it might look: `theme.js` contains a "Global API
Redirect for Local Preview to Live Production" block that silently rewrites
every `/api/*` fetch to the real production deployment whenever the page's
hostname is `localhost`/`127.0.0.1` — and `theme.js` is loaded by `admin.html`
among other pages. Without the guard, a browser-driven admin-console test
running against `wrangler pages dev` on localhost would silently read/write
**real production data** instead of the local D1 the test set up. See the
journey-breaker session's final report for the full writeup and a
recommendation on `theme.js` itself.
