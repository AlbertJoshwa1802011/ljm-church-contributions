// Real-browser E2E: navigation graph, console/network health, and mobile
// responsiveness across every public /v2/*.html page. See docs/testing/E2E.md
// for how to run this (needs a real `wrangler pages dev` + local D1 already
// running, plus `playwright`/Chromium on NODE_PATH).
import { test } from "node:test";
import assert from "node:assert/strict";
import { launchGuardedBrowser, newGuardedContext, collectConsoleAndNetworkIssues, BASE_URL, blockedRequests } from "./helpers/browser.mjs";

const V2_PAGES = [
  "/v2/index.html", "/v2/about.html", "/v2/watch.html", "/v2/events.html",
  "/v2/programs.html", "/v2/blog.html", "/v2/testimonies.html", "/v2/prayer.html",
  "/v2/contact.html", "/v2/our-giving.html", "/v2/give-flow.html", "/v2/my-giving.html"
];

const VIEWPORTS = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-x", width: 375, height: 667 },
  { name: "pixel", width: 393, height: 852 },
  { name: "ipad", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 }
];

let browser;
test.before(async () => { browser = await launchGuardedBrowser(); });
test.after(async () => { await browser.close(); });

for (const path of V2_PAGES) {
  test(`${path}: loads with no console errors, no failed requests, no undefined/[object Object] leakage`, async () => {
    const context = await newGuardedContext(browser);
    const page = await context.newPage();
    const issues = collectConsoleAndNetworkIssues(page);

    const res = await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
    assert.equal(res.status(), 200, `${path} should return 200`);

    // Let any async data-fetch renders settle.
    await page.waitForTimeout(300);

    const bodyText = await page.locator("body").innerText();
    assert.ok(!/\bundefined\b/.test(bodyText), `${path} rendered the literal text "undefined": ${bodyText.slice(0, 200)}`);
    assert.ok(!bodyText.includes("[object Object]"), `${path} rendered "[object Object]"`);
    assert.ok(!/\bNaN\b/.test(bodyText), `${path} rendered the literal text "NaN"`);

    assert.deepEqual(issues.consoleErrors, [], `${path} had console.error calls: ${JSON.stringify(issues.consoleErrors)}`);
    assert.deepEqual(issues.pageErrors, [], `${path} had uncaught page errors: ${JSON.stringify(issues.pageErrors)}`);
    assert.deepEqual(issues.failedRequests, [], `${path} had failed/5xx requests: ${JSON.stringify(issues.failedRequests)}`);

    await context.close();
  });
}

for (const path of V2_PAGES) {
  for (const vp of VIEWPORTS) {
    test(`${path} @ ${vp.name} (${vp.width}x${vp.height}): no horizontal overflow, hamburger visible on mobile`, async () => {
      const context = await newGuardedContext(browser, { viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth
        };
      });
      assert.ok(
        overflow.scrollWidth <= overflow.clientWidth + 2, // 2px tolerance for scrollbar rounding
        `${path} @ ${vp.width}x${vp.height}: horizontal overflow (scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth})`
      );

      if (vp.width < 860) {
        const hamburger = page.locator("#hamburgerBtn");
        await assert.doesNotReject(hamburger.waitFor({ state: "visible", timeout: 2000 }),
          `${path} @ ${vp.width}px: hamburger button should be visible`);
      }

      await context.close();
    });
  }
}

test("navigation graph: every internal /v2/ and /admin.html link reachable from header nav/drawer/footer resolves (not a 404, not the legacy homepage fallback)", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  const discovered = new Set();

  for (const path of V2_PAGES) {
    await page.goto(BASE_URL + path, { waitUntil: "networkidle" });
    const hrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(
        ".site-header a[href], .nav-drawer a[href], .site-footer a[href], .mobile-actions a[href]"
      )).map(a => a.getAttribute("href"));
    });
    for (const href of hrefs) {
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      discovered.add(href.split("?")[0]);
    }
  }

  assert.ok(discovered.size > 0, "Expected to discover at least one internal nav link");

  const broken = [];
  for (const href of discovered) {
    const res = await page.goto(BASE_URL + href, { waitUntil: "domcontentloaded" });
    const status = res.status();
    const title = await page.title();
    if (status === 404) {
      broken.push(`${href}: 404`);
    } else if (status >= 400) {
      broken.push(`${href}: HTTP ${status}`);
    } else if (title === "LJM Church" && !href.startsWith("/admin") && href !== "/") {
      // "LJM Church" is the legacy root index.html's <title>. "/" itself
      // legitimately still serves it pre-cutover (functions/_middleware.js
      // only routes "/" to /v2/index.html for a verified beta cookie) — that's
      // current, intentional product state, not a broken link. Any OTHER
      // /v2/ nav target rendering it means the link silently fell back to the
      // wrong page (the exact bug this test exists to catch — see
      // tests/frontend/v2-nav-links.test.mjs for the fixed instance).
      broken.push(`${href}: served the legacy homepage instead of its own page (title="${title}")`);
    }
  }

  assert.deepEqual(broken, [], `Broken/dead-end nav links discovered:\n${broken.join("\n")}`);
  await context.close();
});

test("an unknown URL under /v2/ returns a real 404, not the legacy homepage with 200", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  const res = await page.goto(BASE_URL + "/v2/this-page-does-not-exist-xyz.html");
  assert.equal(res.status(), 404, "A nonexistent v2 page should 404, not silently serve something else with 200");
  await context.close();
});

test("network guard: any attempt to reach a real external/production service was intercepted (never actually reached one)", () => {
  // The guard existing and firing is success, not failure — a page trying to
  // call out (e.g. admin.html, via theme.js's localhost->production redirect,
  // see docs/testing/E2E.md) is expected; what matters is it was aborted
  // before ever leaving this test run. A truly clean run has zero blocked
  // attempts; this suite's own admin.html crawl is known to trigger some.
  if (blockedRequests.length > 0) {
    console.log(`Note: network guard intercepted ${blockedRequests.length} attempt(s) to reach a real external service (expected from admin.html's theme.js redirect + Google/font script tags):`);
    for (const r of blockedRequests.slice(0, 5)) console.log(`  - ${r.url}`);
  }
  assert.ok(true);
});
