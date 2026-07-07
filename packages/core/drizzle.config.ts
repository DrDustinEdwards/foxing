import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from the schema; migrations are applied to D1 via
// `wrangler d1 migrations apply foxing` (local + remote), not by drizzle-kit push.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});
