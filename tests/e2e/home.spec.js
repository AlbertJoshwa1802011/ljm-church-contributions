import { test, expect } from "./fixtures.js";

test.describe("Home", () => {
  test("loads with header, hero, populated promise card, and footer", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/v2/index.html");

    await expect(page.locator(".site-header .brand")).toContainText("Light of Jesus Ministry");
    await expect(page.locator("nav.primary-nav a", { hasText: "Youth" })).toHaveCount(1);

    // The illustrated hero SVG renders (no dead <img> requests to missing photo files).
    await expect(page.locator(".hero-banner svg")).toBeVisible();
    await expect(page.locator(".hero-banner img")).toHaveCount(0);

    // Today's promise, sourced from the seed migration, actually renders text.
    await expect(page.locator("#promiseText")).not.toHaveText("", { timeout: 10000 });

    await expect(page.locator("footer.site-footer")).toBeVisible();
    await expect(page.locator("footer.site-footer a[href='/v2/youth.html']")).toHaveCount(1);

    expect(errors, `unexpected JS errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("Give / Pray CTAs are present and point at the right pages", async ({ page }) => {
    await page.goto("/v2/index.html");
    await expect(page.locator("a.btn-primary", { hasText: "Give Today" })).toHaveAttribute("href", "/v2/give-flow.html");
    await expect(page.locator(".action-card.pray")).toHaveAttribute("href", "/v2/prayer.html");
  });
});
