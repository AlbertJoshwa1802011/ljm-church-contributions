// Shared Playwright harness for the real-browser E2E suite (tests/e2e/*.e2e.mjs).
//
// Not wired into `npm test` (see package.json's "test" script, which stays the
// dependency-free `node --test 'tests/**/*.test.mjs'` glob) — these specs use
// `*.e2e.mjs` so they're excluded from that glob, and need the `playwright`
// package + a Chromium binary, which aren't checked into this deliberately
// dependency-free repo (see CONTRIBUTING.md/TESTING.md). Run them with
// `npm run test:e2e` against a real `wrangler pages dev` + local D1 (see
// docs/testing/E2E.md for setup). `playwright` here resolves via NODE_PATH
// pointing at wherever it's installed (globally in this sandbox).
//
// HARD NETWORK GUARD (per the journey-breaker session's absolute rule #11/#12):
// every context created here aborts any request to a real external service —
// Razorpay, Google OAuth/Identity, Resend, R2/Cloudflare storage, and this
// project's own production Pages URL — so a page script that tries to redirect
// (see theme.js's "Global API Redirect for Local Preview to Live Production",
// which activates on `localhost`/`127.0.0.1` and would otherwise silently
// point every `/api/*` fetch at the real deployment) fails closed instead of
// ever reaching a real, live system.
import { chromium } from "playwright";

export const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:8788";

// Host substrings that must NEVER be contacted by this suite. Matched against
// the request URL's hostname — deliberately broad (substring, not exact) so a
// subdomain variant doesn't slip through.
const BLOCKED_HOST_SUBSTRINGS = [
  "razorpay.com",
  "googleapis.com",
  "accounts.google.com",
  "gstatic.com",
  "resend.com",
  "r2.cloudflarestorage.com",
  "cloudflarestorage.com",
  // This project's real production Pages deployment — theme.js's local->prod
  // redirect targets exactly this host.
  "light-of-jesus-ministry-contributions.pages.dev"
];

export const blockedRequests = [];

export async function launchGuardedBrowser() {
  const browser = await chromium.launch();
  return browser;
}

export async function newGuardedContext(browser, opts = {}) {
  const context = await browser.newContext(opts);
  await context.route("**/*", (route) => {
    let hostname = "";
    try { hostname = new URL(route.request().url()).hostname; } catch (_) { /* ignore */ }
    const blocked = BLOCKED_HOST_SUBSTRINGS.some((h) => hostname.includes(h));
    if (blocked) {
      blockedRequests.push({ url: route.request().url(), at: new Date().toISOString() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return context;
}

export function collectConsoleAndNetworkIssues(page) {
  const issues = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Our own network guard aborting a request logs a console.error the
    // browser generates itself (net::ERR_BLOCKED_BY_CLIENT) — that's the
    // guard working as designed, not an app bug.
    if (/ERR_BLOCKED_BY_CLIENT/.test(msg.text())) return;
    // Known, accepted content-pending gap (see the matching comment on the
    // `response` listener below) — the browser's own "failed to load
    // resource" console.error for the missing hero photo.
    const loc = msg.location && msg.location();
    if (loc && loc.url && /\/v2\/assets\/hero\//.test(loc.url)) return;
    issues.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    issues.pageErrors.push(err.message || String(err));
  });
  page.on("requestfailed", (req) => {
    // Our own network guard aborts are expected/by-design, not app bugs.
    // Chromium reports this as "net::ERR_BLOCKED_BY_CLIENT" or, from devtools/
    // the inspector protocol, "net::ERR_BLOCKED_BY_CLIENT.Inspector".
    const failureText = (req.failure() && req.failure().errorText) || "";
    if (failureText.startsWith("net::ERR_BLOCKED_BY_CLIENT")) return;
    issues.failedRequests.push({ url: req.url(), failure: failureText });
  });
  page.on("response", (res) => {
    // /v2/assets/hero/* is a known, accepted content-pending gap (see
    // docs/milestone-v2/12-phase-0-5-implementation-status.md — real hero
    // photos aren't uploaded yet) with a graceful onerror fallback to an
    // inline SVG illustration in v2/index.html; not an app bug.
    if (/\/v2\/assets\/hero\//.test(res.url())) return;
    if (res.status() >= 500 || (res.status() === 404 && res.request().resourceType() !== "document")) {
      issues.failedRequests.push({ url: res.url(), status: res.status() });
    }
  });
  return issues;
}
