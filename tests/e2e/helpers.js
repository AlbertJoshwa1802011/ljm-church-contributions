// Shared helpers for the v2 browser E2E suite.

// Logs into /admin.html using the dev-login bypass (functions/api/_lib.js
// only allows this because wrangler.jsonc sets ALLOW_LEGACY_EMAIL_TOKEN=true,
// and admin.html itself only shows the bypass button when hostname is
// localhost/127.0.0.1/file: — see admin.html's initGate()). The email must
// already hold a role in member_roles (schema.sql seeds
// albertjoshrock101@gmail.com as super_admin).
export async function adminDevLogin(page, email = "albertjoshrock101@gmail.com") {
  await page.goto("/admin.html");
  page.once("dialog", (dialog) => dialog.accept(email));
  await page.locator("#devLoginBtn button").click();
  await page.locator("#app.ready").waitFor({ state: "attached", timeout: 15000 });
}

// No horizontal scroll: content must never be wider than the viewport.
export async function assertNoHorizontalOverflow(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  return { scrollWidth, clientWidth, overflow: scrollWidth - clientWidth };
}

// Kept for anything that only needs one viewport per device class (admin
// mobile/desktop layout-shape assertions, etc.).
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

// Full breakpoint matrix the milestone brief asks for (§11/§12): real iPhone
// widths (320 SE, 375 8/X, 390 12/13/14, 393 Pixel/Android, 430 Pro Max),
// tablet, and common laptop/desktop widths.
export const RESPONSIVE_MATRIX = {
  "320": { width: 320, height: 690 },
  "360": { width: 360, height: 780 },
  "375": { width: 375, height: 812 },
  "390": { width: 390, height: 844 },
  "393": { width: 393, height: 851 },
  "430": { width: 430, height: 932 },
  "768": { width: 768, height: 1024 },
  "1024": { width: 1024, height: 768 },
  "1280": { width: 1280, height: 800 },
  "1440": { width: 1440, height: 900 }
};
