import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// API integration tests run in workerd (miniflare) against a local D1 with the real
// migrations applied, so the profiles round trip is exercised end to end in CI.
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
        // tsconfig's ~/ paths, for the real routes the stub build carries.
        { find: /^~\//, replacement: `${path.resolve(__dirname, "app")}/` },
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
          durableObjects: {
            CLUB_ROOM: "ClubRoom",
            RATE_LIMITER: { className: "RateLimiter", useSQLite: true },
          },
          compatibilityDate: "2026-07-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          kvNamespaces: ["APP_KV"],
          // The nightly backup's bucket (app/lib/backup.server.ts), empty and local.
          // MEDIA and COVERS: the reader assets and covers buckets the Worker entry binds (empty here).
          r2Buckets: ["BACKUPS", "MEDIA", "COVERS"],
          // The admin list (core isAdminAccount): the suites' admins are these test emails.
          bindings: {
            TEST_MIGRATIONS: migrations,
            ADMIN_EMAIL: "admin@example.com",
            CO_OWNER_EMAILS: "admin2@example.com",
            // site-runtime's admin idle key (withAdminIdle requires one); a fake test value.
            ADMIN_IDLE_SECRET: "sample-admin-idle-secret-for-tests-only",
            // Better Auth's settings, fake: the shared Worker's Renderer (reached as ctx.exports.Renderer) renders
            // with these bindings, not a suite's own env.
            BETTER_AUTH_URL: "https://foxing.test",
            BETTER_AUTH_SECRET: "test-secret-value-for-the-renderer-only",
            GOOGLE_CLIENT_ID: "test-google-client-id",
            GOOGLE_CLIENT_SECRET: "test-google-client-secret",
          },
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
