import { test, expect } from "./fixtures.js";
import { adminDevLogin } from "./helpers.js";

// Drives the real admin Settings > "Watch & Listen" form (not a raw API
// call) so this also exercises the admin round-trip: form -> PUT /api/settings
// -> D1 -> public GET /api/settings -> v2/watch.html render.
async function saveMediaLinks(page, { sunday = "", daily = "", podcast = "" }) {
  await adminDevLogin(page);
  await page.locator("#sideNav .nav-group[data-group='admin'] .nav-group-head").click();
  await page.locator("#sideNav [data-section='settings']").click();
  await expect(page.locator("#section-settings")).toHaveClass(/active/);
  await page.locator("#s_sundayLive").fill(sunday);
  await page.locator("#s_dailyPrayer").fill(daily);
  await page.locator("#s_podcastPlaylist").fill(podcast);
  await page.locator("#s_saveMedia").click();
  await expect(page.locator("#s_mediaMsg")).not.toHaveText("", { timeout: 10000 });
}

test.describe("Watch & Listen", () => {
  test.afterEach(async ({ page }) => {
    // Leave settings empty so this spec never leaks state into another
    // spec file's /api/settings-reading assertions.
    await saveMediaLinks(page, {});
  });

  test("shows an honest empty state when no livestream links are configured", async ({ page }) => {
    await saveMediaLinks(page, {});
    await page.goto("/v2/watch.html");
    await expect(page.locator("#watchGrid")).toContainText("haven't been set up yet", { timeout: 10000 });
    await expect(page.locator("#watchGrid iframe")).toHaveCount(0);
  });

  test("admin-configured links render as safe embeds/cards on the public page", async ({ page }) => {
    await saveMediaLinks(page, {
      sunday: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      daily: "https://www.youtube.com/live/abc123DEF45",
      podcast: "https://www.youtube.com/playlist?list=PLxyz123ABC"
    });

    await page.goto("/v2/watch.html");
    await expect(page.locator(".w-card")).toHaveCount(3, { timeout: 10000 });

    // Sunday + Daily are single-video URLs -> real YouTube embed iframes.
    const iframes = page.locator("#watchGrid iframe");
    await expect(iframes).toHaveCount(3);
    await expect(iframes.nth(0)).toHaveAttribute("src", /youtube\.com\/embed\/dQw4w9WgXcQ/);
    await expect(iframes.nth(1)).toHaveAttribute("src", /youtube\.com\/embed\/abc123DEF45/);
    // Podcast is a playlist URL -> the playlist embed form.
    await expect(iframes.nth(2)).toHaveAttribute("src", /youtube\.com\/embed\/videoseries\?list=PLxyz123ABC/);

    await expect(page.locator("#watchGrid")).toContainText("Sunday Live Worship");
    await expect(page.locator("#watchGrid")).toContainText("Daily Morning Prayer");
    await expect(page.locator("#watchGrid")).toContainText("Podcast Archive");
  });

  test("a non-http(s) URL (e.g. javascript:) is rejected server-side and never reaches the public page", async ({ page, request }) => {
    // functions/api/settings.js now validates media URL keys server-side
    // (defense in depth alongside v2/watch.html's client-side esc()/safeUrl()),
    // so the malicious value can never be persisted in the first place — the
    // admin save itself must fail, not merely render safely.
    await saveMediaLinks(page, { sunday: "javascript:alert(1)" });
    await expect(page.locator("#s_mediaMsg")).toHaveClass(/err/);
    await expect(page.locator("#s_mediaMsg")).toContainText(/http/i);

    const settingsRes = await request.get("/api/settings");
    const settingsBody = await settingsRes.json();
    expect(settingsBody.settings.sunday_live_url || "").not.toMatch(/^javascript:/i);

    await page.goto("/v2/watch.html");
    // Nothing was saved (afterEach of the prior test already cleared state),
    // so the honest empty state renders — no iframe, no anchor carrying the
    // raw scheme, regardless.
    await expect(page.locator("#watchGrid iframe")).toHaveCount(0);
    await expect(page.locator("#watchGrid a[href^='javascript:']")).toHaveCount(0);
  });

  test("page has consistent nav/footer and translates on language toggle", async ({ page }) => {
    await page.goto("/v2/watch.html");
    await expect(page.locator("nav.primary-nav a", { hasText: "Youth" })).toHaveCount(1);
    await expect(page.locator("footer.site-footer")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Join us — live, or whenever you can.");

    await page.locator(".lang-toggle").first().click();
    await expect(page.locator(".eyebrow").first()).not.toHaveText("📺 Watch & Listen");
  });
});
