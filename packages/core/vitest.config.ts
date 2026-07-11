import { defineConfig } from "vitest/config";

// Core domain tests run in plain Node (pure functions, no D1). API integration
// tests against local D1 live in apps/web with @cloudflare/vitest-pool-workers.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
