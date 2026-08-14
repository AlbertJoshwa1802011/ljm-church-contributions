// BROWSER E2E (Chromium): the giving/checkout UI can be opened and is wired
// up — WITHOUT executing a real payment or contacting Razorpay in any way.
//
// razorpay-checkout.js is one of the 8 frozen money-path files (see
// .github/workflows/frozen-payment-paths.yml) — this test only drives the
// existing UI, it does not touch that file. Opening the modal
// (openModal() in razorpay-checkout.js) only loads the member picker from
// the local /api/members endpoint; the real Razorpay SDK is only ever
// contacted after "Proceed to Pay" is clicked, which this test deliberately
// never does. As a second layer of protection (not just "the test doesn't
// click it"), any request to Razorpay's real domains is hard-blocked below.
import { test, expect } from "./fixtures.mjs";

test("RAZORPAY UI ONLY: the give/checkout modal opens without contacting Razorpay", async ({ page }) => {
  const razorpayRequests = [];
  await page.route("https://checkout.razorpay.com/**", (route) => {
    razorpayRequests.push(route.request().url());
    route.abort();
  });
  await page.route("https://api.razorpay.com/**", (route) => {
    razorpayRequests.push(route.request().url());
    route.abort();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Drive the real button + real click handler wired up by
  // razorpay-checkout.js (functions/api not modified, UI not modified) —
  // dispatched directly since the button is intentionally hidden until other
  // page state resolves, which this smoke test isn't trying to reproduce.
  const opened = await page.evaluate(() => {
    const btn = document.getElementById("rzp-button1");
    if (!btn) return false;
    btn.click();
    return true;
  });
  expect(opened, "rzp-button1 (give/checkout trigger) must exist in the DOM").toBe(true);

  const modal = page.locator("#contributionModal");
  await expect(modal).toHaveClass(/insight-modal-visible/, { timeout: 10000 });
  await expect(modal).toBeVisible();

  // Never reached "Proceed to Pay" → never contacted Razorpay.
  expect(razorpayRequests, `Unexpected Razorpay network activity: ${JSON.stringify(razorpayRequests)}`).toHaveLength(0);
});
