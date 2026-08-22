import { test, expect } from "./fixtures.js";

// "No dead ends" — starting from any v2 page, every other major section must
// be reachable by clicking, never by typing a URL. Mirrors the overnight
// brief's explicit example routes.
test.describe("Cross-page navigation", () => {
  test("Prayer -> Giving -> Events -> Blog -> About -> Home, all by clicking", async ({ page }) => {
    await page.goto("/v2/prayer.html");
    await expect(page).toHaveURL(/prayer/);

    await page.locator("a[href='/v2/give-flow.html']").first().click();
    await expect(page).toHaveURL(/give-flow/);

    await page.locator("a[href='/v2/events.html']").first().click();
    await expect(page).toHaveURL(/events/);

    await page.locator("a[href='/v2/blog.html']").first().click();
    await expect(page).toHaveURL(/blog/);

    await page.locator("a[href='/v2/about.html']").first().click();
    await expect(page).toHaveURL(/about/);

    await page.locator(".site-header a.brand").first().click();
    await expect(page).toHaveURL(/\/v2\/(index\.html)?$|\/$/);
  });

  test("Blog -> Prayer -> Events -> Giving -> Home, all by clicking", async ({ page }) => {
    await page.goto("/v2/blog.html");

    await page.locator("a[href='/v2/prayer.html']").first().click();
    await expect(page).toHaveURL(/prayer/);

    await page.locator("a[href='/v2/events.html']").first().click();
    await expect(page).toHaveURL(/events/);

    await page.locator("a[href='/v2/give-flow.html']").first().click();
    await expect(page).toHaveURL(/give-flow/);

    await page.locator(".site-header a.brand").first().click();
    await expect(page).toHaveURL(/\/v2\/(index\.html)?$|\/$/);
  });

  test("Youth Ministry is reachable from every v2 page's nav", async ({ page }) => {
    for (const path of ["/v2/index.html", "/v2/prayer.html", "/v2/blog.html", "/v2/about.html", "/v2/programs.html"]) {
      await page.goto(path);
      await expect(page.locator("nav.primary-nav a[href='/v2/youth.html']")).toHaveCount(1);
    }
  });

  test("Give/Our Giving/My Giving links land on the real v2 page, not the old homepage", async ({ page }) => {
    // Regression test: v2/*.html used to link to the bare root paths
    // (/give-flow.html, /our-giving.html, /my-giving.html), which only exist
    // as real files under /v2/. Without a beta-tester cookie, the root path
    // isn't routed anywhere by functions/_middleware.js, so Cloudflare Pages'
    // "no match" fallback silently served the OLD site's homepage instead —
    // a real, reachable-but-wrong page, not a 404, so it was easy to miss.
    // Every v2 page now links straight to /v2/give-flow.html etc.
    await page.goto("/v2/index.html");
    await page.locator("a.btn-primary", { hasText: "Give Today" }).click();
    await expect(page).toHaveURL(/\/v2\/give-flow/);
    await expect(page).toHaveTitle(/Give — Light of Jesus Ministry/);

    await page.goto("/v2/index.html");
    await page.locator("footer a[href='/v2/our-giving.html']").click();
    await expect(page).toHaveURL(/\/v2\/our-giving/);
    await expect(page).toHaveTitle(/Our Giving/);
  });

  test("no v2 page links to the beta-gated root paths that fall through to the old homepage", async ({ page }) => {
    // Exhaustive regression check for the "root-relative link silently serves
    // the legacy site" class of bug (see the test above): every v2 page must
    // link to the /v2/ variant of give-flow/our-giving/my-giving/events, never
    // the bare root path.
    const V2_PAGES = ["/v2/index.html", "/v2/prayer.html", "/v2/testimonies.html", "/v2/programs.html", "/v2/youth.html", "/v2/blog.html", "/v2/about.html", "/v2/watch.html"];
    const BAD_HREFS = ["/give-flow.html", "/our-giving.html", "/my-giving.html", "/events.html"];

    for (const path of V2_PAGES) {
      await page.goto(path);
      for (const bad of BAD_HREFS) {
        const count = await page.locator(`a[href='${bad}']`).count();
        expect(count, `${path} must not link to root-relative ${bad}`).toBe(0);
      }
    }
  });

  test("admin console is reachable from the /v2/ URL pattern", async ({ page, request }) => {
    const res = await request.get("/v2/admin.html", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toMatch(/\/admin\.html$/);
  });
});
