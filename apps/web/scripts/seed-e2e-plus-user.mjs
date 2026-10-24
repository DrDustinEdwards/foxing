// One-time seed of a PERSISTENT verified + Plus e2e account, used only by the club
// specs. Mirrors seed-e2e-user.mjs, then flips the profile tier to plus in the same D1.
// Kept a SEPARATE account from the free e2e user so the free-tier specs (which prove the
// paywall) are never corrupted by a tier flip.
//
// Required env:
//   E2E_PLUS_EMAIL           the plus account email (also a CI secret)
//   E2E_PASSKEY_PRIVATE_KEY  the e2e passkey (also a CI secret)
//   E2E_SEED_BASE_URL        the deployed site URL (or PLAYWRIGHT_BASE_URL)
// Optional:
//   E2E_PLUS_USERNAME     profile username (default foxing_e2e_plus)
//   E2E_D1_NAME           D1 database name (default foxing)
//   E2E_D1_LOCAL=true     operate on the LOCAL D1 instead of --remote
import { d1, seedAccount } from "./e2e-account.mjs";

const email = process.env.E2E_PLUS_EMAIL;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const username = process.env.E2E_PLUS_USERNAME ?? "foxing_e2e_plus";

if (!email || !base) {
  console.error("Set E2E_PLUS_EMAIL, E2E_PASSKEY_PRIVATE_KEY and E2E_SEED_BASE_URL first.");
  process.exit(1);
}

await seedAccount({ base, email, name: "Foxing E2E Plus", username });

// Flip the profile to Plus so create-club (the one Plus club action) is allowed. The
// billing webhook is the tier writer in production; this is a test-only direct flip.
d1(
  `UPDATE profiles SET subscription_tier = 'plus' WHERE id = (SELECT id FROM user WHERE email = '${email}');`,
);

console.log(`E2E Plus account ready: ${email} (username ${username}, tier plus).`);
