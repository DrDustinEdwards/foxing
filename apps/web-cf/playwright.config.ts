import { defineConfig, devices } from "@playwright/test";

// E2E runs against a deployed target (the workers.dev preview by default), which is
// backed by the real catalog D1. Override with PLAYWRIGHT_BASE_URL. In CI the e2e job
// runs after deploy against the live preview URL.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://foxing.dustin-edwards.workers.dev";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
