// BROWSER E2E config (Chromium only, headless) — see tests/e2e/fixtures.mjs
// for why every page navigation goes through a production-URL interceptor.
// Distinct from the STRUCTURAL (source/regex) and BEHAVIORAL (Node/vm/API)
// tests under tests/api and tests/frontend, which `npm test` runs.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // No `webServer` option here — see global-setup.mjs's header comment for
  // why the local wrangler dev server's lifecycle is owned by
  // global-setup.mjs/global-teardown.mjs instead.
  globalSetup: "./tests/e2e/global-setup.mjs",
  globalTeardown: "./tests/e2e/global-teardown.mjs",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://127.0.0.1:8788",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off"
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium"
        }
      }
    }
  ]
});
