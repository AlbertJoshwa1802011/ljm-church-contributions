// Playwright config for tests/e2e/*.spec.mjs — real-browser QA against a real
// `wrangler pages dev` + local D1 runtime (Cloudflare Pages Functions, not a
// mock). See TESTING.md's "Browser / e2e suite" section before running this.
//
// NOT part of `npm test` / CI (`.github/workflows/test.yml` runs only the
// offline node:test suite) — this is a separate, slower layer for real
// browser/navigation/responsive regressions the offline suite can't see.
// Run with `npm run test:e2e`.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8790;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 20000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // This sandbox's pre-installed Chromium build doesn't match the pinned
    // @playwright/test version's expected revision, so `npx playwright
    // install` can't be used here — point at the pre-installed binary
    // instead. On a normal machine with browsers installed via `npx
    // playwright install`, leave E2E_CHROMIUM_PATH unset and Playwright
    // resolves its own browser as usual.
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command:
      `npx wrangler d1 execute DB --local --file=./schema.sql && ` +
      `npx wrangler d1 execute DB --local --file=./tests/e2e/seed.sql && ` +
      `npx wrangler pages dev . --port ${PORT}`,
    url: `http://localhost:${PORT}/api/churches`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
