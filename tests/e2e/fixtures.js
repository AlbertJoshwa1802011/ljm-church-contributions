// Shared Playwright fixture for the v2 E2E suite.
import { test as base, expect } from "@playwright/test";

// theme.js (loaded by every OLD-flow page — root index.html, events.html,
// admin.html — NOT any /v2/*.html page) deliberately rewrites every
// `/api/*` fetch to the REAL PRODUCTION origin whenever
// `location.hostname` is "localhost"/"127.0.0.1" — a "preview the static
// files against live prod" convenience for opening them without a local API
// running. That is exactly this suite's hostname when it drives a local
// `wrangler pages dev` server, so without this rewrite, tests for
// admin.html/events.html would silently read (and, if ever extended to a
// write action, could mutate) the REAL live production database instead of
// the local seeded one.
//
// This is a hard safety boundary, not a convenience: rewrite any request
// aimed at the production host back to this test run's own baseURL *before*
// it ever leaves the browser context, so a real network call to production
// is never made, full stop — regardless of what any page's JS tries to do.
const PRODUCTION_HOST = "light-of-jesus-ministry-contributions.pages.dev";

// External hosts these pages optionally load (Google Sign-In, Google Fonts,
// the Chart.js CDN on /admin.html) that aren't needed for anything this
// suite asserts, and just make `page.goto` slow/flaky waiting on a resource
// that will never arrive in a network-restricted environment.
const BLOCKED_HOSTS = ["accounts.google.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.route(
      (url) => url.hostname === PRODUCTION_HOST,
      async (route) => {
        // route.continue({url}) refuses a protocol change (https -> http),
        // so the swap is done as a real fetch to the local server from here
        // (the Node test process, not the browser) and the route is
        // fulfilled with that response — the production origin is never
        // actually contacted from anywhere.
        const local = new URL(route.request().url());
        const target = new URL(baseURL);
        local.protocol = target.protocol;
        local.host = target.host;
        const res = await fetch(local.toString(), {
          method: route.request().method(),
          headers: route.request().headers(),
          body: route.request().postDataBuffer() || undefined
        });
        const body = Buffer.from(await res.arrayBuffer());
        route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body });
      }
    );
    await page.route((url) => BLOCKED_HOSTS.includes(url.hostname), (route) => route.abort());
    await use(page);
  }
});

export { expect };
