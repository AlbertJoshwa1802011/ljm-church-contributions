// Regression coverage for a real bug found by browser-based QA: the default
// "All" filter view built its fetch URL as
// '/api/testimonies' + '' + '&_t=' + Date.now() -> '/api/testimonies&_t=...'
// (missing '?') whenever no kind filter was active. That path doesn't match
// the Pages Function route at all, so Cloudflare's static-asset fallback
// served the OLD homepage's HTML back, r.json() rejected, and the whole
// public Testimonies page showed "Couldn't load testimonies right now" for
// every first-time visitor — the page's entire purpose, broken by default.
import { test, expect } from "./fixtures.mjs";
import { guardAdminApiFromProduction, devAdminLogin, openMinistrySection } from "./helpers.mjs";

test("testimonies.html default view loads real published testimonies, not the error state", async ({ page }) => {
  await page.goto("/v2/testimonies.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  const listing = await page.locator("#tsGrid").innerText();
  expect(listing).not.toContain("Couldn't load testimonies");
  expect(listing).toContain("E2E Seeded Testimony");
});

test("submit -> pending -> admin publish -> visible on public page (full moderation round trip)", async ({ page, context, baseURL }) => {
  const title = "E2E Playwright Submission " + Date.now();

  await page.goto("/v2/testimonies.html", { waitUntil: "load" });
  await page.click("#openSubmitBtn");
  await page.fill("#ts_title", title);
  await page.fill("#ts_body", "Automated e2e submission.");
  await page.fill("#ts_author", "E2E Bot");
  await page.click("#ts_submitBtn");
  await expect(page.locator("#submitSuccess")).toBeVisible({ timeout: 5000 });

  await guardAdminApiFromProduction(context, baseURL);
  await devAdminLogin(page);
  await openMinistrySection(page, "ministry", "testimonies");
  const row = page.locator("#ts_table tbody tr", { hasText: title });
  await expect(row, "new submission should appear pending in the admin moderation queue").toHaveCount(1);
  await row.locator("button", { hasText: "Publish" }).click();
  await page.waitForTimeout(800);

  await page.goto("/v2/testimonies.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  await expect(page.locator("#tsGrid")).toContainText(title);
});
