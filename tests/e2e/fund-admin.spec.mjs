// BROWSER E2E (Chromium): fund management create/edit/archive flow, logged
// in as a non-super-admin `manage_funds`-only role holder (seeded in
// tests/e2e/global-setup.mjs) — admin.html only shows the Archive button
// (as opposed to Delete, which is super-admin-only) to that kind of caller.
//
// DISCOVERED PRE-EXISTING BUG (not fixed here — out of this hardening
// pass's approved scope, and functions/api/funds.js is not one of the 8
// frozen files but also isn't one of the files this pass is authorized to
// change): admin.html's Archive button sends `PUT /api/funds` with
// `{ slug, action: "archive" }`, but functions/api/funds.js's PUT handler
// only ever reads `body.status` (never `body.action` — that field is read
// only by the POST handler's add_member/remove_member branch). Confirmed
// directly against the live local API: a real archive PUT with
// `action: "archive"` returns `{ success: false, message: "No editable
// fields provided" }` — the fund's status never actually changes. This test
// asserts the REAL current behavior (archive fails visibly) rather than the
// intended behavior, so it stays honest about what's shipped today. See
// docs/testing/COVERAGE-TRACKER.md for the tracked follow-up.
import { test, expect, loginAsAdmin } from "./fixtures.mjs";

const PROD_ORIGIN = "https://light-of-jesus-ministry-contributions.pages.dev";
const FUND_NAME = "E2E CRUD Test Fund";

async function openFundsSection(page) {
  await page.locator('.nav-group[data-group="giving"] .nav-group-head').click();
  await page.locator('.nav-group[data-group="giving"] .nav-item[data-section="funds"]').click();
}

test("fund admin: create and edit work; archive currently fails (documents a real, pre-existing bug)", async ({ page }) => {
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

  // Archive: sends the request shape admin.html actually sends...
  await card.locator('button[data-act="edit"]').click();
  await page.locator("#f_archiveBtn").click();
  await expect(page.locator("#f_msg")).not.toHaveText("", { timeout: 10000 });

  expect(archivePutBody).not.toBeNull();
  expect(archivePutBody.action).toBe("archive");

  // ...and the backend, as shipped today, rejects it instead of archiving —
  // the fund is NOT actually archived. This is the bug this test documents.
  expect(archivePutStatus).toBe(200);
  await expect(page.locator("#f_msg")).toContainText("No editable fields provided");
  await expect(fundList.locator(".fund-card", { hasText: FUND_NAME })).not.toContainText("archived");
});
