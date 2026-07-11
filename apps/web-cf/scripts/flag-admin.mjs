// Flag a user as an operator (profiles.is_admin = 1) so they can reach /admin. Run once
// against the D1 the app targets. This is the single-admin allowlist: only rows flipped
// here pass the requireAdmin gate and the /api/v1/admin write checks.
//
// Required env:
//   ADMIN_USERNAME   the profile username to flag (e.g. the operator account)
// Optional:
//   ADMIN_D1_NAME    D1 database name (default foxing)
//   ADMIN_D1_LOCAL=true   flip in the LOCAL D1 instead of --remote
//   ADMIN_UNSET=true      clear the flag instead of setting it
//
// Usage (PowerShell):
//   $env:ADMIN_USERNAME="dustin"; node apps/web-cf/scripts/flag-admin.mjs
import { execSync } from "node:child_process";

const username = process.env.ADMIN_USERNAME;
const dbName = process.env.ADMIN_D1_NAME ?? "foxing";
const scope = process.env.ADMIN_D1_LOCAL === "true" ? "--local" : "--remote";
const value = process.env.ADMIN_UNSET === "true" ? 0 : 1;

if (!username) {
  console.error("Set ADMIN_USERNAME to the profile username to flag.");
  process.exit(1);
}
// Reject anything but a plain username so the value can be inlined safely.
if (!/^[a-zA-Z0-9_]+$/.test(username)) {
  console.error("ADMIN_USERNAME must be alphanumeric or underscore.");
  process.exit(1);
}

const sql = `UPDATE profiles SET is_admin = ${value} WHERE username = '${username}';`;
console.log(`Setting is_admin=${value} for @${username} in D1 "${dbName}" (${scope})...`);
execSync(`npx wrangler d1 execute ${dbName} ${scope} --command "${sql}"`, {
  stdio: "inherit",
});
console.log("Done. Sign out and back in for the account menu to show Admin dashboard.");
