import { test, expect } from "./fixtures.js";

test.describe("Testimonies", () => {
  test("published, sample-marked testimonies render on load — the default 'All' filter actually loads data", async ({ page }) => {
    // Regression test: the "All" tab's currentKind is "", and the fetch used
    // to build the URL as `/api/testimonies` + `&_t=...` with no leading `?`
    // whenever no kind filter was set — a malformed URL that silently 404s
    // into Cloudflare Pages' catch-all fallback (HTML, not JSON), so
    // `.json()` threw and the page always showed "Couldn't load testimonies
    // right now" on first load, regardless of how much real data existed.
    await page.goto("/v2/testimonies.html");

    const grid = page.locator("#tsGrid");
    await expect(grid.locator(".ts-card").first()).toBeVisible({ timeout: 10000 });
    await expect(grid).not.toContainText("Couldn't load testimonies");

    const cardCount = await grid.locator(".ts-card").count();
    expect(cardCount).toBeGreaterThan(0);

    // Sample content is honestly labeled, never presented as a real person's story.
    await expect(grid).toContainText("(sample testimony)");
  });

  test("only published testimonies are public — the pending moderation-queue sample never appears", async ({ page }) => {
    await page.goto("/v2/testimonies.html");
    await expect(page.locator("#tsGrid .ts-card").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#tsGrid")).not.toContainText("Our Family, Restored");
  });

  test("kind filter chips (Testimonies / Miracles) still work", async ({ page }) => {
    await page.goto("/v2/testimonies.html");
    await expect(page.locator("#tsGrid .ts-card").first()).toBeVisible({ timeout: 10000 });

    await page.locator("#kindFilter button[data-kind='testimony']").click();
    await expect(page.locator("#kindFilter button.active")).toHaveAttribute("data-kind", "testimony");
    await expect(page.locator("#tsGrid")).not.toContainText("Loading…", { timeout: 10000 });
  });
});
