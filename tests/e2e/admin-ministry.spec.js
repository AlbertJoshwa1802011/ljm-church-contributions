import { test, expect } from "./fixtures.js";
import { adminDevLogin } from "./helpers.js";

test.describe("Admin console — Ministry section", () => {
  test("dev login unlocks the console and the Ministry sections show real seeded data", async ({ page }) => {
    await adminDevLogin(page);

    // Sidebar nav is grouped and collapsed by default — open "Ministry" first.
    await page.locator("#sideNav .nav-group[data-group='ministry'] .nav-group-head").click();
    await page.locator("#sideNav [data-section='promises']").click();
    await expect(page.locator("#section-promises")).toHaveClass(/active/);
    await expect(page.locator("#pr_table tbody tr").first()).toBeVisible({ timeout: 10000 });
    const promiseRows = await page.locator("#pr_table tbody tr").count();
    expect(promiseRows).toBeGreaterThan(0);

    await page.locator("#sideNav [data-section='testimonies']").click();
    await expect(page.locator("#ts_table tbody")).toContainText("(sample testimony)", { timeout: 10000 });
    // The admin queue shows every status, including the pending one hidden from the public.
    await expect(page.locator("#ts_table tbody")).toContainText("pending");

    await page.locator("#sideNav [data-section='programs']").click();
    await expect(page.locator("#pg_table tbody tr").first()).toBeVisible({ timeout: 10000 });

    await page.locator("#sideNav [data-section='blog']").click();
    await expect(page.locator("#bl_table tbody")).toContainText("draft", { timeout: 10000 });

    await page.locator("#sideNav [data-section='churches']").click();
    await expect(page.locator("#ch_table tbody tr")).toHaveCount(2, { timeout: 10000 });
  });

  test("admin CSS/layout is not collapsed on mobile — bottom nav shows, sidebar hides", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await adminDevLogin(page);

    const asideDisplay = await page.locator("aside").evaluate((el) => getComputedStyle(el).display);
    expect(asideDisplay).toBe("none");

    const mobileNavDisplay = await page.locator("#mobileNav").evaluate((el) => getComputedStyle(el).display);
    expect(mobileNavDisplay).toBe("flex");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("admin layout is a full sidebar shell on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await adminDevLogin(page);

    const asideDisplay = await page.locator("aside").evaluate((el) => getComputedStyle(el).display);
    expect(asideDisplay).not.toBe("none");

    const mobileNavDisplay = await page.locator("#mobileNav").evaluate((el) => getComputedStyle(el).display);
    expect(mobileNavDisplay).toBe("none");
  });
});
