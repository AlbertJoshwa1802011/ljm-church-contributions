import { test, expect } from "./fixtures.js";

test.describe("Events", () => {
  test("VBS 2026 appears on the live events page (/events.html, what the nav actually links to)", async ({ page }) => {
    await page.goto("/events.html");
    await expect(page.locator("#eventsGrid")).toContainText("Vacation Bible School (VBS) 2026", { timeout: 10000 });
  });

  test("VBS 2026 is honest about unknown fields and shows a placeholder instead of a broken image", async ({ page }) => {
    await page.goto("/v2/events.html");

    const card = page.locator(".event-card", { hasText: "Vacation Bible School (VBS) 2026" });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card).toContainText("to be confirmed");

    // No <img> with a broken/missing src — the placeholder tile is a styled div.
    await expect(card.locator("img")).toHaveCount(0);
  });
});
