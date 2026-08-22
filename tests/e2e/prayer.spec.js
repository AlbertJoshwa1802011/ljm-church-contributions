import { test, expect } from "./fixtures.js";

test.describe("Prayer", () => {
  test("page has a real intro, a working form, and reaches the rest of the site", async ({ page }) => {
    await page.goto("/v2/prayer.html");

    await expect(page.locator(".prayer-hero h1")).not.toHaveText("");
    await expect(page.locator("#prayerForm")).toBeVisible();
    await expect(page.locator("#pf_request")).toBeVisible();

    // Cross-navigable without typing a URL.
    await expect(page.locator("nav.primary-nav a[href='/v2/about.html']")).toHaveCount(1);
    await expect(page.locator("a[href='/v2/give-flow.html']").first()).toBeVisible();
  });

  test("submitting a prayer request shows a confirmation, without needing existing requests to look populated", async ({ page }) => {
    await page.goto("/v2/prayer.html");

    await page.fill("#pf_name", "E2E Test");
    await page.fill("#pf_request", "E2E test prayer request — please pray for wisdom.");
    await page.click("#pf_submitBtn");

    await expect(page.locator("#prayerSuccessCard")).toBeVisible({ timeout: 10000 });
  });
});
