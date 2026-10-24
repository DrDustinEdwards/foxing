// Local dev seed. Inserts a few fake books into the LOCAL D1. To sign in locally, ask for an
// email link on /login: wrangler's local email binding saves the message and logs where.
import { execSync } from "node:child_process";

execSync("npx wrangler d1 execute foxing --local --file ./scripts/seed.sql", {
  stdio: "inherit",
  shell: true,
});
console.log("Seeded books into local D1.");
