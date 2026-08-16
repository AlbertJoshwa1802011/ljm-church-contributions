// BROWSER E2E (Chromium): regression coverage for the api() error-masking
// bug — a real (fulfilled) non-2xx HTTP response with a valid JSON error
// body used to be silently resolved by admin.html's api() helper (it only
// ever rejected on HTTP 401), so callers that destructure fields off the
// response (e.g. loadOverview()'s `res[2].funds`) saw `undefined` and fell
// back to a fake empty/zero-looking successful render instead of a visible
// error. This is a narrower, more realistic case than
// tests/e2e/api-failure.spec.mjs's connection-abort scenario (a real backend
// failure, like "D1 database binding missing" or an unhandled exception,
// still returns a normal HTTP response with a JSON body — it doesn't drop
// the connection).
//
// Fixed in admin.html's api(): any non-2xx response (other than the
// existing 401 handling) now rejects with a message parsed from the JSON
// body, so callers' existing `.catch()` error-rendering runs instead of
// their `.then()` success path.
import { test, expect, loginAsAdmin } from "./fixtures.mjs";

const PROD_ORIGIN = "https://light-of-jesus-ministry-contributions.pages.dev";

test("API FAILURE: HTTP 500 + JSON error body on /api/funds shows a visible error, not a silent empty/zero dashboard", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // Registered after fixtures.mjs's generic production-URL reroute, so it
  // takes priority (Playwright matches routes in reverse registration
  // order) — this fulfills the request with a real HTTP 500 response
  // carrying a valid JSON error body, exactly the case api() used to miss.
  await page.route(`${PROD_ORIGIN}/api/funds*`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Simulated database failure" })
    })
  );

  await loginAsAdmin(page);

  // loadOverview() (admin.html) fetches funds via api("/api/funds") as part
  // of a Promise.all — a rejection there must surface through its .catch(),
  // not render fabricated zero-value KPI cards.
  const kpiGrid = page.locator("#kpiGrid");
  await expect(kpiGrid).toContainText(/fail/i, { timeout: 10000 });
  await expect(kpiGrid).not.toContainText("₹0");
  await expect(kpiGrid.locator(".kpi")).toHaveCount(0);

  // The Funds section (a direct api("/api/funds") caller) shows the same
  // real error rather than a "No funds yet." empty state indistinguishable
  // from a legitimately empty fund list.
  await page.locator('.nav-group[data-group="giving"] .nav-group-head').click();
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="funds"]').click();
  const fundList = page.locator("#fundList");
  await expect(fundList).not.toContainText("No funds yet.");
  await expect(fundList).toContainText("Simulated database failure", { timeout: 10000 });

  // Correctness doesn't depend on (and shouldn't produce) an uncaught
  // exception — the failure is handled gracefully via api()'s rejection and
  // each caller's existing .catch().
  expect(pageErrors).toEqual([]);
});
