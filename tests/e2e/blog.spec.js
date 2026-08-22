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

  test("the draft post is blocked even via a direct ?slug= URL, not just absent from the listing", async ({ request }) => {
    // Listing-only checks can miss an IDOR: the public API might still
    // resolve a draft by slug for anyone who guesses/shares the URL.
    const apiRes = await request.get("/api/blog?slug=behind-the-scenes-sunday-worship-planning");
    expect(apiRes.status(), "draft post must 404 by slug for an unauthenticated caller, not resolve").toBe(404);
    const body = await apiRes.json();
    expect(body.success).toBe(false);
  });
});
