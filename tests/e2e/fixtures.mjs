// Shared Playwright fixtures for the LJM E2E smoke suite.
//
// IMPORTANT — why the production-URL interception below exists:
// theme.js (loaded on every public/admin page) deliberately rewrites every
// same-origin `/api/*` fetch to the LIVE production Cloudflare Pages URL
// whenever `window.location.hostname` is "localhost" or "127.0.0.1" — a
// "static local preview shows live prod data" feature (see theme.js's
// "Global API Redirect for Local Preview to Live Production" block). That is
// exactly wrong for E2E tests, which must never talk to production. The
// `page` fixture below intercepts any request aimed at that production
// origin and fulfills it from this run's local `wrangler pages dev` server
// instead — Playwright intercepts the request before the browser ever
// dispatches it over the network, so no request reaches the real internet
// regardless of what the sandbox/CI network policy allows. This is required
// for every test that touches an admin/public HTML page, not an incidental
// nicety.
//
// admin.html's own dev-only login gate (`#devLoginBtn`, see
// admin.html's initGate()) is keyed off the SAME hostname check, so tests
// must keep navigating via 127.0.0.1 (not a different loopback alias) for
// that gate to stay visible — the production-URL interception above is what
// makes that safe.
import { test as base, expect } from "@playwright/test";

const PROD_ORIGIN = "https://light-of-jesus-ministry-contributions.pages.dev";

// Minimal same-shape stand-in for the real Chart.js UMD bundle admin.html
// loads from cdn.jsdelivr.net. This is NOT a Chart.js test double for visual
// correctness — it exists only so `new Chart(ctx, config)` doesn't throw
// (which would otherwise trip admin.html's own try/catch error banners) when
// the real CDN isn't reachable from a sandboxed/offline test runner. Chart
// rendering fidelity itself is out of scope for these smoke tests.
const CHART_JS_STUB = `
  window.Chart = class Chart {
    constructor(ctx, config) { this.ctx = ctx; this.config = config; this.data = config && config.data; }
    update() {}
    destroy() {}
  };
`;

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.route(`${PROD_ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const localUrl = new URL(url.pathname + url.search, baseURL).toString();
      const resp = await fetch(localUrl, {
        method: req.method(),
        headers: req.headers(),
        body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postData()
      });
      const body = Buffer.from(await resp.arrayBuffer());
      const headers = Object.fromEntries(resp.headers);
      delete headers["content-encoding"];
      delete headers["content-length"];
      await route.fulfill({ status: resp.status, headers, body });
    });

    await page.route("https://cdn.jsdelivr.net/npm/chart.js", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: CHART_JS_STUB })
    );
    // Google Fonts / Google Identity Services: irrelevant to these smoke
    // tests (dev login is used instead of real Google Sign-In) and slow to
    // fail against a restricted network — short-circuit them.
    await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.route("https://accounts.google.com/**", (route) => route.abort());

    await use(page);
  }
});

export { expect };

export const DEV_ADMIN_EMAIL = "albertjoshrock101@gmail.com";

// Drives admin.html's real, pre-existing dev-only login path (initGate()'s
// `#devLoginBtn`, visible only on localhost/127.0.0.1/file:) — this is the
// same code path the app uses once a real Google sign-in completes and
// calls window.LJMAdmin equivalent session logic; the only thing swapped out
// is the identity source (a window.prompt() instead of a Google OAuth
// popup), not the app's auth/permission enforcement itself.
export async function loginAsAdmin(page, email = DEV_ADMIN_EMAIL) {
  await page.goto("/admin");
  page.once("dialog", (dialog) => dialog.accept(email));
  await page.locator("#devLoginBtn button").click();
  await expect(page.getByText("Signed in as", { exact: false })).toBeVisible({ timeout: 15000 });
}
