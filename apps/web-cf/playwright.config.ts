import { defineConfig, devices } from "@playwright/test";

// E2E runs against a deployed target (the workers.dev preview by default), which is
// backed by the real catalog D1. Override with PLAYWRIGHT_BASE_URL. In CI the e2e job
// runs after deploy against the live preview URL.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://foxing.dustin-edwards.workers.dev";

// Signed-in specs live in e2e/authed and reuse a session captured by auth.setup.ts,
// which signs in through the real login form. Public specs live in e2e/ and run
// anonymously. Splitting them keeps the public suite independent of the e2e account.
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
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "public",
      testIgnore: ["**/auth.setup.ts", "**/authed/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testDir: "./e2e/authed",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
