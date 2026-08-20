import { test, expect } from "./fixtures.js";
import { VIEWPORTS, RESPONSIVE_MATRIX } from "./helpers.js";

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
  "/v2/our-giving.html",
  "/v2/my-giving.html"
];

test.describe("Responsive — no horizontal overflow at any breakpoint", () => {
  for (const path of PAGES) {
    for (const [name, size] of Object.entries(RESPONSIVE_MATRIX)) {
      test(`${path} @ ${name}px`, async ({ page }) => {
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

test.describe("Responsive — mobile header/hamburger shape at real narrow widths", () => {
  const MOBILE_WIDTHS = ["320", "360", "375", "390", "393", "430"];

  for (const name of MOBILE_WIDTHS) {
    const size = RESPONSIVE_MATRIX[name];
    test(`/v2/index.html @ ${name}px: hamburger is visible, brand stays inside the header, no element escapes the viewport`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/v2/index.html");
      await page.waitForTimeout(300);

      // The hamburger button must be visible (mobile nav entry point) below
      // the desktop-nav breakpoint, and the primary desktop nav must be hidden
      // -- a real bug this repo hit before was the reverse (both showing, or
      // neither), silently trapping mobile visitors with no way to navigate.
      await expect(page.locator("#hamburgerBtn")).toBeVisible();
      const primaryNavDisplay = await page.locator("nav.primary-nav").evaluate((el) => getComputedStyle(el).display);
      expect(primaryNavDisplay, "primary-nav must collapse below the mobile breakpoint").toBe("none");

      // The brand lockup (logo + name) must stay within the header — this
      // regression-tests the "hamburger button clipped off-screen" bug fixed
      // in this milestone (brand needs min-width:0/overflow:hidden to shrink).
      const [brandBox, hamburgerBox] = await Promise.all([
        page.locator(".site-header .brand").boundingBox(),
        page.locator("#hamburgerBtn").boundingBox()
      ]);
      expect(brandBox).not.toBeNull();
      expect(hamburgerBox).not.toBeNull();
      expect(brandBox.x + brandBox.width, "brand must not overlap/push the hamburger off-screen").toBeLessThanOrEqual(size.width);
      expect(hamburgerBox.x + hamburgerBox.width, "hamburger must be fully inside the viewport").toBeLessThanOrEqual(size.width + 1);

      // Tap target size — WCAG 2.5.5 / real-thumb usability floor.
      expect(hamburgerBox.width, "hamburger tap target too small").toBeGreaterThanOrEqual(32);
      expect(hamburgerBox.height, "hamburger tap target too small").toBeGreaterThanOrEqual(32);
    });
  }

  test("hamburger menu opens, covers content, and every nav link is reachable at 320px (smallest supported width)", async ({ page }) => {
    await page.setViewportSize(RESPONSIVE_MATRIX["320"]);
    await page.goto("/v2/index.html");
    await page.locator("#hamburgerBtn").click();
    await expect(page.locator("#navDrawer")).toHaveClass(/open/);
    await page.waitForTimeout(350); // let the .26s slide-in transition finish before measuring

    const drawerBox = await page.locator("#navDrawer").boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox.x + drawerBox.width, "drawer must not overflow the 320px viewport").toBeLessThanOrEqual(320 + 1);

    // A representative sample of nav links must be visible and clickable
    // inside the open drawer, not clipped or zero-size.
    for (const text of ["Youth", "Programs", "Testimonies", "Our Giving"]) {
      const link = page.locator("#navDrawer nav a", { hasText: text });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box.height, `${text} link tap target too small`).toBeGreaterThanOrEqual(20);
    }
  });
});

test.describe("No console/page errors on any v2 page", () => {
  // Hosts this suite's own fixtures.js (see BLOCKED_HOSTS there) deliberately
  // aborts — Google Sign-In / fonts / a CDN this suite never needs — which
  // Chromium always echoes to the console as a generic
  // "Failed to load resource: net::ERR_FAILED" line with no distinguishing
  // detail. That line is test-harness noise, not a page bug, so long as
  // every failed request it corresponds to actually targets one of these
  // hosts (checked below, not just assumed).
  const EXPECTED_BLOCKED_HOSTS = ["accounts.google.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

  for (const path of PAGES) {
    test(`${path} loads with zero console errors and zero uncaught page errors`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const unexpectedFailedRequests = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
      page.on("pageerror", (e) => pageErrors.push(e.message));
      page.on("requestfailed", (req) => {
        let host = "";
        try { host = new URL(req.url()).hostname; } catch (_) { /* ignore */ }
        if (!EXPECTED_BLOCKED_HOSTS.includes(host)) {
          unexpectedFailedRequests.push(`${req.url()} (${req.failure() && req.failure().errorText})`);
        }
      });

      await page.goto(path);
      await page.waitForTimeout(500); // let async fetch()/render callbacks settle

      const realConsoleErrors = consoleErrors.filter((m) => !/^Failed to load resource:/.test(m));
      expect(realConsoleErrors, `${path} logged console errors: ${realConsoleErrors.join(" | ")}`).toEqual([]);
      expect(pageErrors, `${path} threw uncaught errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect(unexpectedFailedRequests, `${path} had unexpected failed network requests: ${unexpectedFailedRequests.join(" | ")}`).toEqual([]);
    });
  }
});

test.describe("Responsive — cards never wider than the viewport", () => {
  const CASES = [
    { path: "/v2/blog.html", selector: ".blog-card, .card" },
    { path: "/v2/testimonies.html", selector: ".testimony-card, .card" },
    { path: "/v2/programs.html", selector: ".pg-item, .card" }
  ];

  for (const { path, selector } of CASES) {
    for (const name of ["320", "375", "390"]) {
      test(`${path} cards fit within ${name}px`, async ({ page }) => {
        const size = RESPONSIVE_MATRIX[name];
        await page.setViewportSize(size);
        await page.goto(path);
        await page.waitForTimeout(400);

        const widths = await page.locator(selector).evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().width)
        );
        for (const w of widths) {
          expect(w, `${path} @ ${name}px has a card wider than the viewport`).toBeLessThanOrEqual(size.width + 1);
        }
      });
    }
  }
});
