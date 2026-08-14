// BROWSER E2E (Chromium): admin console loads, the dev-only local auth path
// establishes a session, Overview renders, and dynamic (admin-created) fund
// data is represented. See tests/e2e/global-setup.mjs for the seeded funds/
// contribution this test depends on, and tests/e2e/fixtures.mjs for why
// every navigation goes through a production-URL interceptor.
import { test, expect, loginAsAdmin } from "./fixtures.mjs";

test("admin overview: loads, authenticates, and represents dynamic funds", async ({ page }) => {
  await loginAsAdmin(page);

  // Overview is the default section on login.
  await expect(page.locator("#section-overview")).toBeVisible();
  await expect(page.locator("#section-overview h2")).toHaveText("Overview");

  // KPI grid must resolve past its loading skeleton to real values, not get
  // stuck or show a load failure.
  const kpiGrid = page.locator("#kpiGrid");
  await expect(kpiGrid.locator(".kpi")).not.toHaveCount(0, { timeout: 15000 });
  await expect(kpiGrid).not.toContainText("Failed to load");
  await expect(kpiGrid).toContainText("Total collected");

  // The seeded E2E contribution (₹2,500 on the tech-contributions system
  // fund — see global-setup.mjs for why a system fund was used) is
  // reflected in "Total collected", proving the KPI is computed from real,
  // live data rather than being a static/hardcoded figure.
  await expect(kpiGrid).toContainText("2,500");
  await expect(page.locator("#recentTable")).toContainText("E2E Seed Donor");

  // Both chart canvases exist and are actually sized (see CLAUDE.md's known
  // pitfall: an unbounded/zero-height chart canvas is a symptom of a broken
  // render chain, even if nothing throws).
  for (const id of ["trendChart", "distChart"]) {
    const box = await page.locator("#" + id).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(20);
  }

  // "Dynamic funds are represented": the Overview KPIs above only ever cover
  // the two system funds (see global-setup.mjs's comment), so the concrete,
  // literal signal that admin-created funds flow through the console lives
  // in the Funds section — open it and confirm both seeded dynamic funds
  // (not just the two hardcoded system funds) render by name.
  await page.locator('.nav-group[data-group="giving"] .nav-group-head').click();
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="funds"]').click();
  const fundList = page.locator("#fundList");
  await expect(fundList).toContainText("E2E Building Fund", { timeout: 10000 });
  await expect(fundList).toContainText("E2E Mission Fund");
  await expect(fundList).toContainText("Tech Fund");
});
