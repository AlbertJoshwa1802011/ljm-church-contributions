// Playwright config for the v2 browser E2E suite (tests/e2e/*.spec.js).
//
// Chromium only — this repo's sandbox ships a pre-installed Chromium under
// PLAYWRIGHT_BROWSERS_PATH and deliberately skips Firefox/WebKit downloads
// (see CLAUDE.md / the overnight brief). `webServer` boots a real local
// Cloudflare Pages Functions runtime (`wrangler pages dev`) against a local
// D1 SQLite seeded from schema.sql + the v2 launch content migration, so
// these tests exercise the actual handlers, not a mock.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: ["--no-sandbox"]
    }
  },
  webServer: {
    command: "npm run e2e:server",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});
