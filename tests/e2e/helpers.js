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

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};
