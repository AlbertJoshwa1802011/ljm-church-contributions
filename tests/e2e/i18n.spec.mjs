import { test, expect } from "./fixtures.mjs";

const PAGES = ["/v2/index.html", "/v2/programs.html", "/v2/prayer.html", "/v2/testimonies.html"];

for (const path of PAGES) {
  test(`${path}: toggling to Tamil never leaks "undefined"/"null"/"[object Object]"`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(400);
    await page.click(".lang-toggle");
    await page.waitForTimeout(300);
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).not.toContain("[object Object]");
    // <html lang> should flip to "ta" so assistive tech reads it correctly.
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  });
}
