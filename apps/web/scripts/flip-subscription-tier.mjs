// Flip a user's profiles.subscription_tier for manual testing. There is no tier
// management UI or endpoint yet (Phase 4b billing sets this via Stripe webhooks);
// until then this is the only way to reach the Plus companion path.
//
// Usage (PowerShell):
//   node apps/web/scripts/flip-subscription-tier.mjs <username> plus
//   node apps/web/scripts/flip-subscription-tier.mjs <username> free
//
// Never run this against the persistent e2e account (foxing_e2e) -- other authed
// specs assume it stays free tier. Use a separate throwaway test account.
//
// Optional: E2E_D1_NAME (default "foxing"), D1_LOCAL=true to target local D1 instead
// of --remote.
import { execSync } from "node:child_process";

const [, , username, tier] = process.argv;

if (!username || !["plus", "free"].includes(tier ?? "")) {
  console.error("Usage: node flip-subscription-tier.mjs <username> <plus|free>");
  process.exit(1);
}

const dbName = process.env.E2E_D1_NAME ?? "foxing";
const scope = process.env.D1_LOCAL === "true" ? "--local" : "--remote";
const safeUsername = username.replace(/'/g, "''");

execSync(
  `npx wrangler d1 execute ${dbName} ${scope} --command "UPDATE profiles SET subscription_tier = '${tier}' WHERE username = '${safeUsername}';"`,
  { stdio: "inherit", shell: true },
);

console.log(`${username} is now ${tier}.`);
