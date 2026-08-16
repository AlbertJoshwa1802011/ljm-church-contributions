import { test, expect } from "./fixtures.js";

test.describe("Programs", () => {
  test("service times render, grouped by church, from the seeded data", async ({ page }) => {
    await page.goto("/v2/programs.html");

    await expect(page.locator("#programsWrap .pg-item").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#programsWrap")).toContainText("Church of Light");
    await expect(page.locator("#programsWrap")).toContainText("City Worship Center");
    await expect(page.locator("#programsWrap")).toContainText("Sunday Worship Service");

    const itemCount = await page.locator("#programsWrap .pg-item").count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
