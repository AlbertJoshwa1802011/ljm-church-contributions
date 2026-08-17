import { test, expect } from "./fixtures.js";

test.describe("Blog", () => {
  test("published posts render in the list; the draft post never appears publicly", async ({ page }) => {
    await page.goto("/v2/blog.html");

    await expect(page.locator("#blGrid .bl-card").first()).toBeVisible({ timeout: 10000 });
    const count = await page.locator("#blGrid .bl-card").count();
    expect(count).toBeGreaterThan(0);

    await expect(page.locator("#blGrid")).not.toContainText("Behind the Scenes: Sunday Worship Planning");
    await expect(page.locator("#blGrid")).toContainText("Welcome to the New Light of Jesus Ministry Website");
  });

  test("opening a post shows the full article via ?slug=", async ({ page }) => {
    await page.goto("/v2/blog.html");
    await page.locator("#blGrid .bl-card", { hasText: "Getting Ready for VBS 2026" }).click();

    await expect(page).toHaveURL(/slug=getting-ready-for-vbs-2026/);
    await expect(page.locator("#articleView")).toBeVisible();
    await expect(page.locator("#articleWrap h1")).toHaveText("Getting Ready for VBS 2026");
    await expect(page.locator("#articleWrap")).toContainText("Back to Blog");
  });
});
