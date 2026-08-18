import { test, expect } from "./fixtures.mjs";

test("draft posts never leak publicly (listing or direct slug)", async ({ page }) => {
  await page.goto("/v2/blog.html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const listing = await page.locator("body").innerText();
  expect(listing).not.toContain("E2E DRAFT Post Must Never Leak");
  expect(listing).toContain("E2E Published Post");

  await page.goto("/v2/blog.html?slug=e2e-draft-post", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const detail = await page.locator("body").innerText();
  expect(detail).not.toContain("Draft body content that must never be visible publicly.");
});

test("a published post is reachable by its slug", async ({ page }) => {
  await page.goto("/v2/blog.html?slug=e2e-published-post", { waitUntil: "load" });
  await page.waitForTimeout(500);
  await expect(page.locator("body")).toContainText("Published body content for the Playwright suite.");
});
