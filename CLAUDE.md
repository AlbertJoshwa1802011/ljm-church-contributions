# CLAUDE.md

Guidance for coding agents working in this repo.

## Required reading before you touch code

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first — it's the mandatory process
for this repo (tests required for every endpoint change, the giving/money path
is frozen, CI blocks a red suite from deploying, additive-only migrations). This
file covers pitfalls and the milestone-planning ritual; `CONTRIBUTING.md` covers
the engineering process. Both apply, together.

## Project shape

- Static site (no build step, no bundler, no TypeScript, no linter) deployed
  to Cloudflare Pages. `index.html` + `script.js` + `style.css`/`theme.css`
  are served as-is — nothing transpiles or type-checks them before they hit
  production.
- Backend is Cloudflare Pages Functions under `functions/api/*.js`, backed by
  D1 (`schema.sql`). Deploys on every push to `main` via
  `.github/workflows/deploy.yml`.
- Tests: `npm test` runs `node --test 'tests/**/*.test.mjs'`. `tests/api/*`
  exercise the Functions handlers directly against a real in-memory SQLite
  (via `tests/helpers/mock-d1.mjs`) standing in for D1. `tests/frontend/*`
  statically parses `script.js`/`index.html` source — there is no jsdom or
  browser harness in this suite, so frontend tests check structural
  invariants (a called function is defined, a chain has the try/catch it's
  supposed to) rather than actually executing the DOM code.

## Known pitfall: undefined functions in script.js fail silently in production

Because there is no build step, a typo'd or removed function name in
`script.js` (e.g. calling `renderCategoryPie()` when no such function is
defined) is **never caught until a user's browser throws a ReferenceError**.
This happened for real: the Analytics tab's lazy chart-render callback called
an undefined `renderCategoryPie`, which threw and silently aborted every
chart queued after it in the same synchronous callback — so the whole
Analytics tab looked broken/empty with no error visible to the user, just
oversized blank chart cards.

When touching `script.js`:
- If you add a function call, grep the file to confirm the function is
  actually defined (`function renderX(` or `const renderX = `) before
  assuming it exists.
- When chaining multiple independent render/init calls in one callback
  (especially inside `setTimeout`), wrap each call in its own `try/catch` so
  one failure can't cascade and silently block the others. See
  `initTabs()`'s Analytics lazy-render block for the pattern.
- `tests/frontend/analytics-charts.test.mjs` regression-tests this specific
  chain (all renderer functions it calls must be defined, and each call must
  be individually try/catch-wrapped). If you add a new chart to that chain,
  the test picks it up automatically — no test changes needed unless you
  rename the pattern it parses.
- Chart.js canvases using `maintainAspectRatio: false` need a parent element
  with an explicit bounded height (see `#categoryChartCard` /
  `#distributionChartCard` / `#sourceChartCard` in `style.css`) — otherwise
  the canvas can render at an unstable/unbounded size.

## Milestone workflow (vibe-coding process) — follow strictly

For any **major milestone / feature**, plan through these **six documents in
order, one at a time** — each builds on the previous — and **do not begin
implementation until all six exist and are approved**:

1. **Product Requirement Document (PRD)** — what we build, why we build it, and
   what it solves.
2. **Technical Requirement Document (TRD)** — the tech stack, tools, and APIs.
3. **App Flow** — every screen and the navigation between the screens the user
   takes across the app.
4. **UI/UX Design & Spec Sheet** — look, color, and feel; component styles and
   the design language.
5. **Backend Schema** — the database, the relationships between tables, and the
   API calls.
6. **Implementation Plan** — broken into phases, executed one phase at a time.

The current milestone's documents and live status tracker live in
`docs/milestone-v2/` — start at `docs/milestone-v2/README.md`.
