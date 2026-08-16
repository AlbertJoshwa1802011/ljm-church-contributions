// BROWSER E2E (Chromium): fund management create/edit/archive flow, logged
// in as a non-super-admin `manage_funds`-only role holder (seeded in
// tests/e2e/global-setup.mjs) — admin.html only shows the Archive button
// (as opposed to Delete, which is super-admin-only) to that kind of caller.
//
// REGRESSION COVERAGE for a real, previously-shipped bug: admin.html's
// Archive button used to send `PUT /api/funds` with
// `{ slug, action: "archive" }`, but functions/api/funds.js's PUT handler
// only ever reads `body.status` (never `body.action` — that field is read
// only by the POST handler's add_member/remove_member branch), so the
// archive request silently no-opped (`{ success: false, message: "No
// editable fields provided" }`) and the fund was never actually archived.
// Fixed by sending `{ slug, status: "archived" }`, which matches the
// existing PUT contract (see funds.js's `changes.status` handling) — no
// backend change was needed. This test asserts the CORRECT behavior end to
// end and will fail if the Archive button regresses back to sending
// `action: "archive"` instead of `status: "archived"`.
import { test, expect, loginAsAdmin } from "./fixtures.mjs";

const PROD_ORIGIN = "https://light-of-jesus-ministry-contributions.pages.dev";
const FUND_NAME = "E2E CRUD Test Fund";

async function openFundsSection(page) {
  await page.locator('.nav-group[data-group="giving"] .nav-group-head').click();
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="funds"]').click();
}

test("fund admin: create, edit, and archive all work end to end", async ({ page }) => {
  await loginAsAdmin(page, "e2e-fund-admin@example.com");
  page.on("dialog", (dialog) => dialog.accept());

// Mirrors fixtures.mjs's generic production-URL reroute, but registered
  // after it (so it takes priority) and capturing the PUT request/response
  // directly instead of falling through — needed to assert on both the
  // exact body admin.html sent and the resulting HTTP status.
  let archivePutBody = null;
  let archivePutStatus = null;
  await page.route(`${PROD_ORIGIN}/api/funds`, async (route, request) => {
    const url = new URL(request.url());
    const localUrl = new URL(url.pathname + url.search, "http://127.0.0.1:8788").toString();
    if (request.method() === "PUT") {
      try { archivePutBody = JSON.parse(request.postData() || "{}"); } catch (_) { archivePutBody = null; }
    }
    const resp = await fetch(localUrl, {
      method: request.method(),
      headers: request.headers(),
      body: ["GET", "HEAD"].includes(request.method()) ? undefined : request.postData()
    });
    if (request.method() === "PUT") archivePutStatus = resp.status;
    const body = Buffer.from(await resp.arrayBuffer());
    const headers = Object.fromEntries(resp.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    await route.fulfill({ status: resp.status, headers, body });
  });

  await openFundsSection(page);

  // Create.
  await page.locator("#f_name").fill(FUND_NAME);
  await page.locator("#f_goal").fill("25000");
  await page.locator("#f_saveBtn").click();
  await expect(page.locator("#f_msg")).toHaveText(/created/i, { timeout: 10000 });

  const fundList = page.locator("#fundList");
  await expect(fundList).toContainText(FUND_NAME, { timeout: 10000 });
  const card = fundList.locator(".fund-card", { hasText: FUND_NAME });
  await expect(card).toBeVisible();

  // Edit (opens the create/edit form pre-filled for this fund).
  await card.locator('button[data-act="edit"]').click();
  await expect(page.locator("#fundFormTitle")).toContainText(FUND_NAME);

  // Non-super-admin manage_funds holder: Archive is offered, Delete is not.
  await expect(page.locator("#f_archiveBtn")).toBeVisible();
  await expect(page.locator("#f_deleteBtn")).toBeHidden();

  // A real edit (goal amount change) still works correctly.
  await page.locator("#f_goal").fill("30000");
  await page.locator("#f_saveBtn").click();
  await expect(page.locator("#f_msg")).toHaveText(/updated/i, { timeout: 10000 });
  await expect(fundList.locator(".fund-card", { hasText: FUND_NAME })).toContainText("30,000");

  // Archive: verify the actual network request admin.html sends, that the
  // backend accepts it, and that the UI reflects the archived state.
  await card.locator('button[data-act="edit"]').click();
  await page.locator("#f_archiveBtn").click();
  await expect(page.locator("#f_msg")).not.toHaveText("", { timeout: 10000 });

  // This is the regression guard: fails if the button reverts to sending
  // `action: "archive"` (which funds.js's PUT handler never reads) instead
  // of the `status` field the backend actually understands.
  expect(archivePutBody).not.toBeNull();
  expect(typeof archivePutBody.slug).toBe("string");
  expect(archivePutBody.slug.length).toBeGreaterThan(0);
  expect(archivePutBody.status).toBe("archived");
  expect(archivePutBody.action).toBeUndefined();

  // Backend accepts the request and actually updates the fund's status.
  expect(archivePutStatus).toBe(200);
  await expect(page.locator("#f_msg")).toContainText("updated");
  await expect(page.locator("#f_msg")).not.toContainText("No editable fields provided");

  // UI reflects the archived state: the fund card shows the "archived" pill.
  await expect(fundList.locator(".fund-card", { hasText: FUND_NAME })).toContainText("archived");

  // The fund is no longer treated as active elsewhere in the admin UI: the
  // Purchases section's fund picker excludes archived funds.
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="purchases"]').click();
  await expect(page.locator("#p_fund")).not.toContainText(FUND_NAME);
});
