// One-time seed of the PERSISTENT verified e2e account that the signed-in Playwright
// specs sign in as. Run it once against the deployed site whose D1 the e2e job targets,
// after scripts/seed-e2e-passkeys.mjs has made the e2e passkey (scripts/e2e-account.mjs
// does the work).
//
// Required env:
//   E2E_EMAIL                the account email (also a CI secret)
//   E2E_PASSKEY_PRIVATE_KEY  the e2e passkey (also a CI secret)
//   E2E_SEED_BASE_URL        the deployed site URL (or PLAYWRIGHT_BASE_URL)
// Optional:
//   E2E_USERNAME        profile username (default foxing_e2e)
//   E2E_D1_NAME         D1 database name (default foxing)
//   E2E_D1_LOCAL=true   write the LOCAL D1 instead of --remote
import { seedAccount } from "./e2e-account.mjs";

const email = process.env.E2E_EMAIL;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const username = process.env.E2E_USERNAME ?? "foxing_e2e";

if (!email || !base) {
  console.error("Set E2E_EMAIL, E2E_PASSKEY_PRIVATE_KEY and E2E_SEED_BASE_URL first.");
  process.exit(1);
}

await seedAccount({ base, email, name: "Foxing E2E", username });
console.log(`E2E account ready: ${email} (username ${username}).`);
