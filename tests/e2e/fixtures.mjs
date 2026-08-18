// Shared Playwright fixtures for tests/e2e/*.spec.mjs. Every spec should
// import { test, expect } from "./fixtures.mjs" instead of "@playwright/test"
// directly, so this protection applies uniformly.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  context: async ({ context }, use) => {
    // Google Sign-In / Fonts / the Chart.js CDN are unreachable from most CI
    // sandboxes. Without blocking them, `waitUntil: "load"` can hang for the
    // full test timeout waiting on a request that never resolves — a flaky,
    // environment-dependent failure that has nothing to do with app
    // correctness. Every page under test is same-origin, so this only ever
    // blocks third-party requests.
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return route.continue();
      return route.abort();
    });
    await use(context);
  },
});

export { expect };
