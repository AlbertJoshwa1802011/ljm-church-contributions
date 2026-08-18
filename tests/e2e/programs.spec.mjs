// Regression coverage for a real bug found by browser-based QA: a
// recurrence='monthly' program (e.g. "Full Night Prayer", the 2nd Friday of
// every month) rendered its day badge exactly like a genuinely weekly
// program — just "FRI" — with no visual indication it wasn't weekly. A
// visitor scanning the page had no way to tell the two apart. Fixed by
// adding programs.week_of_month (migration 0023) and rendering an explicit
// "Meets the 2nd Friday of every month." sentence for ordinal-monthly rows.
import { test, expect } from "./fixtures.mjs";

test("a monthly-ordinal program states its recurrence explicitly, not just a bare weekday code", async ({ page }) => {
  await page.goto("/v2/programs.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  const listing = await page.locator("#programsWrap").innerText();
  expect(listing).toContain("E2E Full Night Prayer");
  expect(listing).toContain("Meets the 2nd Friday of every month.");
});

test("a plain weekly program still renders its short weekday badge", async ({ page }) => {
  await page.goto("/v2/programs.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  const listing = await page.locator("#programsWrap").innerText();
  expect(listing).toContain("E2E Sunday Service");
  expect(listing).toMatch(/sun[\s\S]{0,40}E2E Sunday Service/i);
});
