import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build with the demo seed (`pnpm db:seed`).
 * Run `pnpm build` first, then `pnpm test:e2e`. Set E2E_BASE_URL to test a server that is
 * already running instead of starting one.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/demo.json" },
      dependencies: ["setup"],
      testIgnore: /public\.spec\.ts/,
    },
    { name: "signed-out", use: { ...devices["Desktop Chrome"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec dotenv -e ../../.env -- next start --port 3000",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
