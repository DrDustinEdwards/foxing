import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// API integration tests run in workerd (miniflare) against a local D1 with the real
// migrations applied, so the profiles round trip is exercised end to end in CI.
// pool-workers v0.18 (vitest 4) exposes the runtime as a Vite plugin, not a pool.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(__dirname, "../../packages/core/migrations"),
  );

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2026-07-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          kvNamespaces: ["APP_KV"],
          // The nightly backup's bucket (app/lib/backup.server.ts), empty and local.
          r2Buckets: ["BACKUPS"],
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      // Only the workerd integration tests under test/. The Playwright specs in e2e/
      // are a separate runner (default vitest globs would otherwise grab e2e/*.spec.ts).
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
