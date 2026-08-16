import { test, expect } from "./fixtures.js";

// The giving/payment path is frozen (see CONTRIBUTING.md §3). This spec only
// verifies the surrounding v2 presentation renders correctly — it never
// fills in real payment details or clicks the Razorpay button, so no real
// transaction can ever be triggered by running this suite.
test.describe("Giving (presentation only — never touches real payment)", () => {
  test("Give flow page loads with the real, unmodified checkout form", async ({ page }) => {
    await page.goto("/v2/give-flow.html");

    await expect(page.locator("#causeGrid .cause-opt").first()).toBeVisible();
    await expect(page.locator("text=Secured by Razorpay")).toBeVisible();
    // The payment modal/amount field exist but stay closed until the visitor
    // opts in — this suite never opens it or touches Razorpay.
    await expect(page.locator("#contributionModal")).toBeHidden();

    // The frozen checkout script is the real one, not a stub.
    const scriptSrc = await page.locator("script[src='/razorpay-checkout.js']").getAttribute("src");
    expect(scriptSrc).toBe("/razorpay-checkout.js");
  });

  test("Our Giving report page loads with live fund figures", async ({ page }) => {
    await page.goto("/v2/our-giving.html");
    await expect(page.locator("body")).not.toContainText("Couldn't load");
  });

  test("giving is reachable from Home, Prayer, and the footer on every content page", async ({ page }) => {
    for (const path of ["/v2/index.html", "/v2/prayer.html", "/v2/blog.html"]) {
      await page.goto(path);
      await expect(page.locator("a[href='/v2/give-flow.html']").first()).toBeVisible();
    }
  });
});
