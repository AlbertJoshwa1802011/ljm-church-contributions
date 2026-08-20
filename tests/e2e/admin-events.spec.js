import { test, expect } from "./fixtures.js";
import { adminDevLogin } from "./helpers.js";

// A real, tiny, valid 1x1 PNG (same fixture used by tests/api/events.test.mjs)
// so file-input uploads exercise the actual MIME-sniffing/decode path, not a
// fake buffer that happens to have a .png name.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function openEventsSection(page) {
  await adminDevLogin(page);
  await page.locator("#sideNav .nav-group[data-group='ministry'] .nav-group-head").click();
  await page.locator("#sideNav [data-section='events']").click();
  await expect(page.locator("#section-events")).toHaveClass(/active/);
}

test.describe("Admin console — Events & VBS (full round trip: admin create -> API -> D1 -> public page)", () => {
  let createdTitle;

  test.afterEach(async ({ page }) => {
    // Best-effort cleanup so this spec never leaves test events behind for
    // other spec files (events.spec.js asserts specific counts/content).
    if (!createdTitle) return;
    await openEventsSection(page);
    const row = page.locator("#ev_table tbody tr", { hasText: createdTitle });
    if (await row.count()) {
      page.once("dialog", (d) => d.accept());
      await row.locator("[data-del]").click();
      await page.waitForTimeout(500);
    }
    createdTitle = null;
  });

  test("create an event with a cover photo, publish it, and see it on the public Events page", async ({ page }) => {
    createdTitle = "E2E Test Gathering " + Date.now();
    await openEventsSection(page);

    await page.locator("#ev_title").fill(createdTitle);
    await page.locator("#ev_category").fill("E2E");
    await page.locator("#ev_eventDate").fill("Some day");
    await page.locator("#ev_status").selectOption("draft");
    await page.locator("#ev_coverFile").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.locator("#ev_coverPreviewContainer")).toBeVisible();

    await page.locator("#ev_saveBtn").click();
    await expect(page.locator("#ev_msg")).toContainText("added", { timeout: 10000 });

    const row = page.locator("#ev_table tbody tr", { hasText: createdTitle });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText("draft");
    await expect(row).toContainText("1"); // cover photo counted

    // Not published yet -> must not appear on the public events page.
    await page.goto("/v2/events.html");
    await expect(page.locator("#eventsRoot")).not.toContainText(createdTitle);

    // Publish from the admin table.
    await openEventsSection(page);
    await page.locator("#ev_table tbody tr", { hasText: createdTitle }).locator("[data-pub]").click();
    await expect(page.locator("#ev_msg")).toContainText("updated", { timeout: 10000 });
    await expect(page.locator("#ev_table tbody tr", { hasText: createdTitle })).toContainText("published");

    // Now it must appear on the real public page, with its cover photo rendered.
    await page.goto("/v2/events.html");
    await expect(page.locator("#eventsRoot")).toContainText(createdTitle, { timeout: 10000 });
    const card = page.locator(".event-card", { hasText: createdTitle });
    await expect(card.locator(".event-cover")).toHaveCount(1);
  });

  test("edit an event: add a gallery photo, remove it again, and change fields", async ({ page }) => {
    createdTitle = "E2E Edit Flow " + Date.now();
    await openEventsSection(page);

    await page.locator("#ev_title").fill(createdTitle);
    await page.locator("#ev_status").selectOption("published");
    await page.locator("#ev_saveBtn").click();
    await expect(page.locator("#ev_msg")).toContainText("added", { timeout: 10000 });

    // Open it for edit and add two gallery photos.
    await page.locator("#ev_table tbody tr", { hasText: createdTitle }).locator("[data-edit]").click();
    await expect(page.locator("#ev_formTitle")).toContainText("Edit " + createdTitle);
    await page.locator("#ev_galleryFiles").setInputFiles([
      { name: "g1.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "g2.png", mimeType: "image/png", buffer: TINY_PNG }
    ]);
    await expect(page.locator("#ev_galleryPreview img")).toHaveCount(2);

    // Remove one from the staged (not-yet-saved) preview before submitting.
    await page.locator("#ev_galleryPreview [data-remove-new]").first().click();
    await expect(page.locator("#ev_galleryPreview img")).toHaveCount(1);

    await page.locator("#ev_saveBtn").click();
    await expect(page.locator("#ev_msg")).toContainText("updated", { timeout: 10000 });

    // Public gallery now shows exactly one photo for this event.
    await page.goto("/v2/events.html");
    await expect(page.locator("#eventsRoot")).toContainText(createdTitle, { timeout: 10000 });
    const card = page.locator(".event-card", { hasText: createdTitle });
    await expect(card).toContainText("1 photo");

    // Re-open in admin, mark the existing photo for removal, save, confirm gone.
    await openEventsSection(page);
    await page.locator("#ev_table tbody tr", { hasText: createdTitle }).locator("[data-edit]").click();
    await expect(page.locator("#ev_existingPhotos")).toBeVisible();
    await page.locator("#ev_existingPhotosGrid [data-photo-id]").first().click();
    await page.locator("#ev_saveBtn").click();
    await expect(page.locator("#ev_msg")).toContainText("updated", { timeout: 10000 });

    await page.goto("/v2/events.html");
    const cardAfter = page.locator(".event-card", { hasText: createdTitle });
    await expect(cardAfter).toBeVisible({ timeout: 10000 });
    await expect(cardAfter.locator(".event-link")).toHaveCount(0); // no photos left -> no "View full gallery" button
  });

  test("delete removes the event from both admin and the public page", async ({ page }) => {
    const title = "E2E Delete Me " + Date.now();
    await openEventsSection(page);
    await page.locator("#ev_title").fill(title);
    await page.locator("#ev_status").selectOption("published");
    await page.locator("#ev_saveBtn").click();
    await expect(page.locator("#ev_msg")).toContainText("added", { timeout: 10000 });

    await page.goto("/v2/events.html");
    await expect(page.locator("#eventsRoot")).toContainText(title, { timeout: 10000 });

    await openEventsSection(page);
    const row = page.locator("#ev_table tbody tr", { hasText: title });
    page.once("dialog", (d) => d.accept());
    await row.locator("[data-del]").click();
    await expect(page.locator("#ev_msg")).toContainText("deleted", { timeout: 10000 });
    await expect(page.locator("#ev_table tbody tr", { hasText: title })).toHaveCount(0);

    await page.goto("/v2/events.html");
    await expect(page.locator("#eventsRoot")).not.toContainText(title);
  });
});
