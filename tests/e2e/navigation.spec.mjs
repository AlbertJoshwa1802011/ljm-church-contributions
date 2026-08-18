// Regression coverage for a real bug found by browser-based QA: every v2
// page's header/footer/mobile-drawer nav linked to root-level paths
// (/give-flow.html, /our-giving.html, /my-giving.html, /events.html)
// instead of their /v2/ equivalents. Those root paths are only rewritten to
// the matching /v2/ page for visitors carrying a signed beta cookie
// (functions/_middleware.js's ROUTE_MAP) — everyone else silently gets
// Cloudflare Pages' default fallback: the OLD pre-v2 homepage, HTTP 200,
// with zero indication anything went wrong. See CLAUDE.md's "no legacy-page
// fallback" rule. Fixed by pointing every v2 nav href at /v2/*.html directly.
import { test, expect } from "./fixtures.mjs";

const V2_PAGES = [
  "/v2/index.html", "/v2/about.html", "/v2/prayer.html", "/v2/testimonies.html",
  "/v2/contact.html", "/v2/programs.html", "/v2/blog.html", "/v2/watch.html",
];

for (const path of V2_PAGES) {
  test(`${path}: give/our-giving/my-giving/events links point at /v2/*, not the beta-gated root paths`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    for (const bad of ["/give-flow.html", "/our-giving.html", "/my-giving.html", "/events.html"]) {
      expect(hrefs, `${path} must not link to the beta-gated root path ${bad}`).not.toContain(bad);
    }
  });
}

test("mobile nav drawer opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/v2/index.html", { waitUntil: "load" });
  await page.click("#hamburgerBtn");
  await expect(page.locator("#navDrawer")).toHaveClass(/open/);
  await page.click("#navDrawerClose");
  await expect(page.locator("#navDrawer")).not.toHaveClass(/open/);
});
