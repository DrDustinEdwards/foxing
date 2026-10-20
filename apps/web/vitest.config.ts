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
    // The Worker entry (workers/app.ts) reads a per-build cache id and the React Router build;
    // the security-headers test runs it against a stub build of the real root and server entry.
    define: { __CACHE_VERSION__: JSON.stringify("test") },
    resolve: {
      alias: [
        {
          find: "virtual:react-router/server-build",
          replacement: path.resolve(__dirname, "test/server-build.stub.ts"),
        },
      ],
    },
    plugins: [
      cloudflareTest({
        // A test-only entry that exports the ClubRoom class, so the CLUB_ROOM binding
        // below is a real Durable Object (the app entry pulls in the React Router build).
        main: "./test/club-room-entry.ts",
        miniflare: {
          durableObjects: { CLUB_ROOM: "ClubRoom" },
          compatibilityDate: "2026-07-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          kvNamespaces: ["APP_KV"],
          // The nightly backup's bucket (app/lib/backup.server.ts), empty and local.
          // MEDIA: the reader assets bucket the Worker entry binds (empty here).
          r2Buckets: ["BACKUPS", "MEDIA"],
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
