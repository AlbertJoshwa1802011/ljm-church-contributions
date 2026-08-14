// BROWSER E2E (Chromium): the public funds page renders both the two
// hardcoded system fund cards and dynamically admin-created funds (fetched
// from /api/funds, see funds.html's inline script), with no console errors
// that would indicate a release-breaking problem.
import { test, expect } from "./fixtures.mjs";

test("public funds page: renders system + dynamic funds with no release-breaking console errors", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/funds", { waitUntil: "domcontentloaded" });

  const grid = page.locator("#fundsGrid");
  await expect(grid).toBeVisible();

  // Static system fund cards.
  await expect(grid).toContainText("Tech Fund");
  await expect(grid).toContainText("Christmas Fund");

  // Dynamically appended admin-created funds (seeded in global-setup.mjs).
  await expect(grid).toContainText("E2E Building Fund", { timeout: 10000 });
  await expect(grid).toContainText("E2E Mission Fund");

  // Benign, expected failures from blocked third-party origins (Google
  // fonts/GIS — aborted by fixtures.mjs) are not "release-breaking"; anything
  // else thrown on the page is what this guards against.
  const benign = /googleapis|accounts\.google\.com|gis|net::ERR_/i;
  const realPageErrors = pageErrors.filter((m) => !benign.test(m));
  const realConsoleErrors = consoleErrors.filter((m) => !benign.test(m));
  expect(realPageErrors, `Unexpected page errors: ${JSON.stringify(realPageErrors)}`).toHaveLength(0);
  expect(realConsoleErrors, `Unexpected console errors: ${JSON.stringify(realConsoleErrors)}`).toHaveLength(0);
});
