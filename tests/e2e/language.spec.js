import { test, expect } from "./fixtures.js";

test.describe("Language (EN / Tamil)", () => {
  test("toggling language switches nav labels to Tamil and back, and persists across a reload", async ({ page }) => {
    await page.goto("/v2/index.html");

    const homeLink = page.locator("nav.primary-nav a[data-i18n='nav.home']");
    await expect(homeLink).toHaveText("Home");

    await page.locator(".lang-toggle").first().click();
    await expect(homeLink).toHaveText("முகப்பு");
    await expect(page.locator("nav.primary-nav a[data-i18n='nav.youth']")).toHaveText("இளையோர்");
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");

    await page.reload();
    await expect(homeLink).toHaveText("முகப்பு");

    await page.locator(".lang-toggle").first().click();
    await expect(homeLink).toHaveText("Home");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("language selector is present on every v2 page", async ({ page }) => {
    for (const path of ["/v2/prayer.html", "/v2/testimonies.html", "/v2/programs.html", "/v2/youth.html", "/v2/blog.html", "/v2/about.html"]) {
      await page.goto(path);
      await expect(page.locator(".lang-toggle").first()).toBeVisible();
    }
  });
});
