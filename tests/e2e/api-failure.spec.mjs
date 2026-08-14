// BROWSER E2E (Chromium): validates the api() hardening in admin.html —
// when /api/funds is unreachable, the Funds section must show a visible
// error, not silently render an empty-looking ("No funds yet.") dashboard
// that's indistinguishable from a legitimately empty state.
//
// Note on how the failure is injected: admin.html's api() helper only
// rejects its promise on an HTTP 401; any other status (including 500) is
// still `.then(r => r.json())`-resolved, so a fulfilled 500 response with a
// JSON body doesn't reach the .catch() that shows an error — it falls
// through to the same "No funds yet." render as a genuinely empty funds
// list (a distinct, narrower gap from what this test guards, and out of
// scope for this hardening pass to fix — see docs/testing/COVERAGE-TRACKER.md
// FOLLOW-UP notes). This test instead aborts the connection outright
// (route.abort()), simulating the API being unreachable — the realistic
// "API is down" failure this hardening targets — which does surface as a
// visible, distinct error message today.
import { test, expect, loginAsAdmin } from "./fixtures.mjs";

const PROD_ORIGIN = "https://light-of-jesus-ministry-contributions.pages.dev";

test("API FAILURE: /api/funds unreachable shows a visible error, not a silent empty dashboard", async ({ page }) => {
  await loginAsAdmin(page);

  // Registered after fixtures.mjs's generic production-URL reroute, so it
  // takes priority (Playwright matches routes in reverse registration order).
  await page.route(`${PROD_ORIGIN}/api/funds`, (route) => route.abort("failed"));

  await page.locator('.nav-group[data-group="giving"] .nav-group-head').click();
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="funds"]').click();

  const fundList = page.locator("#fundList");
  await expect(fundList).not.toContainText("No funds yet.");
  await expect(fundList.locator(".fund-card")).toHaveCount(0);
  // A real, visible error surfaced instead of a blank/zero-looking state.
  await expect(fundList).toContainText(/fail/i, { timeout: 10000 });
});
