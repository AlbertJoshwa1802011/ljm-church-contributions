// Shared helpers for the Playwright e2e suite (tests/e2e/*.spec.mjs).

// admin.html loads theme.js, which monkey-patches window.fetch so that on
// localhost/127.0.0.1 EVERY /api/* call is silently redirected to the real
// production site ("Global API Redirect for Local Preview to Live
// Production" — see theme.js). That's fine for a human previewing the
// static site without a local Functions runtime, but it means an
// unguarded admin e2e test would perform real mutations against live
// production data every time this suite runs. Any spec that opens
// admin.html MUST install this route first — it bounces those
// production-bound calls straight back to our own local dev server instead.
export async function guardAdminApiFromProduction(context, baseURL) {
  const PROD = "https://light-of-jesus-ministry-contributions.pages.dev";
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(baseURL)) return route.continue();
    if (url.startsWith(PROD + "/api/")) {
      const localUrl = baseURL + url.slice(PROD.length);
      try {
        const resp = await fetch(localUrl, {
          method: req.method(),
          headers: req.headers(),
          body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postData(),
        });
        const body = Buffer.from(await resp.arrayBuffer());
        return route.fulfill({ status: resp.status, headers: Object.fromEntries(resp.headers), body });
      } catch (_) {
        return route.abort();
      }
    }
    // Anything else external (Google fonts/GSI, chart.js CDN) is irrelevant
    // to functional/layout assertions and unreachable in CI sandboxes.
    return route.abort();
  });
}

// admin.html's "Admin login (dev)" button (visible only on localhost/127.0.0.1
// / file:) prompts for an email via window.prompt() and unlocks if that email
// holds a role server-side. schema.sql seeds albertjoshrock101@gmail.com as
// super_admin for exactly this purpose.
export async function devAdminLogin(page) {
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") await dialog.accept("albertjoshrock101@gmail.com");
    else await dialog.accept();
  });
  await page.goto("/admin.html", { waitUntil: "load" });
  await page.click("#devLoginBtn button");
  await page.waitForTimeout(1200);
}

export async function openMinistrySection(page, group, section) {
  await page.click(`.nav-group[data-group="${group}"] .nav-group-head`);
  await page.waitForTimeout(200);
  await page.click(`.nav-item[data-section="${section}"]`);
  await page.waitForTimeout(700);
}
