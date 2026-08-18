// Admin console smoke coverage. Every case here MUST call
// guardAdminApiFromProduction first — see helpers.mjs for why: admin.html's
// theme.js otherwise silently redirects every /api/* call to the real
// production site, even in a local/CI test run.
import { test, expect } from "./fixtures.mjs";
import { guardAdminApiFromProduction, devAdminLogin, openMinistrySection } from "./helpers.mjs";

test("dev admin login unlocks the console and lists the seeded Ministry sections", async ({ page, context, baseURL }) => {
  await guardAdminApiFromProduction(context, baseURL);
  await devAdminLogin(page);
  await expect(page.locator("#authGate")).toBeHidden();
  await openMinistrySection(page, "ministry", "programs");
  await expect(page.locator("#section-programs")).toBeVisible();
});

test("adding a monthly-ordinal program through the admin form produces the correct public label", async ({ page, context, baseURL }) => {
  await guardAdminApiFromProduction(context, baseURL);
  await devAdminLogin(page);
  await openMinistrySection(page, "ministry", "programs");

  const title = "E2E Admin-created Monthly Program " + Date.now();
  await page.fill("#pg_titleEn", title);
  await page.selectOption("#pg_dayOfWeek", "3"); // Wednesday
  await page.selectOption("#pg_recurrence", "monthly");
  await expect(page.locator("#pg_weekOfMonthWrap")).toBeVisible();
  await page.selectOption("#pg_weekOfMonth", "3");
  await page.click("#pg_saveBtn");
  await expect(page.locator("#pg_msg")).toContainText("added");
  await expect(page.locator("#pg_table")).toContainText("3rd Wednesday of every month");

  await page.goto("/v2/programs.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  await expect(page.locator("#programsWrap")).toContainText("Meets the 3rd Wednesday of every month.");
});
