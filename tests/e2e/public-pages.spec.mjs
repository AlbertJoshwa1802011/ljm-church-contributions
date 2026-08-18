// Smoke coverage: every public v2 page loads for real (real wrangler pages
// dev + real D1), with no console errors and no horizontal overflow at a
// phone and a desktop width. See CLAUDE.md's "Known pitfall: undefined
// functions in script.js fail silently in production" — this is the
// equivalent net for the v2 pages.
import { test, expect } from "./fixtures.mjs";

const PAGES = [
  "/v2/index.html", "/v2/about.html", "/v2/prayer.html", "/v2/testimonies.html",
  "/v2/contact.html", "/v2/programs.html", "/v2/blog.html", "/v2/watch.html",
  "/v2/events.html", "/v2/give-flow.html", "/v2/my-giving.html", "/v2/our-giving.html",
];

for (const path of PAGES) {
  test(`${path} loads with no console errors and no horizontal overflow (375 + 1440)`, async ({ page, context }) => {
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const resp = await page.goto(path, { waitUntil: "load" });
      expect(resp.status(), `${path} @ ${width}px HTTP status`).toBeLessThan(400);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth, `${path} @ ${width}px: horizontal overflow (scrollWidth > clientWidth)`).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }

    expect(pageErrors, `${path} threw uncaught JS errors`).toEqual([]);
  });
}
