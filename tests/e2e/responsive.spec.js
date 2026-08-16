import { test, expect } from "./fixtures.js";
import { VIEWPORTS } from "./helpers.js";

const PAGES = [
  "/v2/index.html",
  "/v2/prayer.html",
  "/v2/testimonies.html",
  "/v2/programs.html",
  "/v2/youth.html",
  "/v2/blog.html",
  "/v2/about.html",
  "/v2/contact.html",
  "/v2/watch.html",
  "/v2/events.html",
  "/v2/give-flow.html",
  "/v2/our-giving.html"
];

test.describe("Responsive — no horizontal overflow at any breakpoint", () => {
  for (const path of PAGES) {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      test(`${path} @ ${name} (${size.width}px)`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(path);
        await page.waitForTimeout(300); // let async content/layout settle

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${path} overflows by ${overflow}px at ${size.width}px width`).toBeLessThanOrEqual(2);
      });
    }
  }

  test("admin console has no horizontal overflow at mobile/tablet/desktop", async ({ page }) => {
    for (const [, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await page.goto("/admin.html");
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `admin.html overflows by ${overflow}px at ${size.width}px width`).toBeLessThanOrEqual(2);
    }
  });
});
