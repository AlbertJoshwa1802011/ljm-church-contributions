import { test, expect } from "./fixtures.js";

test.describe("Programs", () => {
  test("the real ministry prayer/service schedule renders with human-readable recurrence", async ({ page }) => {
    await page.goto("/v2/programs.html");

    await expect(page.locator("#programsWrap .pg-item").first()).toBeVisible({ timeout: 10000 });
    // Real ministry schedule (migrations/0024_seed_prayer_programs.sql) — not
    // fictional placeholder programs.
    await expect(page.locator("#programsWrap")).toContainText("Daily Morning Prayer");
    await expect(page.locator("#programsWrap")).toContainText("Sunday First Service");
    await expect(page.locator("#programsWrap")).toContainText("Sunday Second Service");
    await expect(page.locator("#programsWrap")).toContainText("Full Night Prayer");
    await expect(page.locator("#programsWrap")).toContainText("Youth Prayer");
    // Recurrence is rendered in human language, not raw db terms like
    // "monthly"/"day_of_week=5"/"month_ordinal=2".
    await expect(page.locator("#programsWrap")).toContainText("Every day");
    await expect(page.locator("#programsWrap")).toContainText("Every Sunday");
    await expect(page.locator("#programsWrap")).toContainText("Second Friday of every month");
    await expect(page.locator("#programsWrap")).toContainText("Second Sunday of every month");

    const itemCount = await page.locator("#programsWrap .pg-item").count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
