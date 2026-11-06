import { defineConfig } from "oxfmt";
import { format } from "@dustinedwards/devkit/oxfmt";

export default defineConfig({
  ...format,
  ignorePatterns: [
    ...(format.ignorePatterns ?? []),
    // Generated SQL migrations and their drizzle-kit metadata, kept byte for byte.
    "packages/core/migrations/",
    // Waits on Dustin (CLAUDE.md hard rule 9).
    "apps/discord/",
  ],
});
