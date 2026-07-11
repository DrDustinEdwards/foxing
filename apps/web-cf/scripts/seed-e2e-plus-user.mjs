// One-time seed of a PERSISTENT verified + Plus e2e account, used only by the club
// specs (creating a club is Plus). Mirrors seed-e2e-user.mjs, then flips the profile
// tier to plus in the same D1. Kept a SEPARATE account from the free e2e user so the
// free-tier specs (which prove the paywall) are never corrupted by a tier flip.
//
// Required env:
//   E2E_PLUS_EMAIL        the plus account email (also a CI secret)
//   E2E_PLUS_PASSWORD     the plus account password (also a CI secret)
//   E2E_SEED_BASE_URL     the deployed preview URL (or PLAYWRIGHT_BASE_URL)
// Optional:
//   E2E_PLUS_USERNAME     profile username (default foxing_e2e_plus)
//   E2E_D1_NAME           D1 database name (default foxing)
//   E2E_D1_LOCAL=true     operate on the LOCAL D1 instead of --remote
import { execSync } from "node:child_process";

const email = process.env.E2E_PLUS_EMAIL;
const password = process.env.E2E_PLUS_PASSWORD;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const username = process.env.E2E_PLUS_USERNAME ?? "foxing_e2e_plus";
const dbName = process.env.E2E_D1_NAME ?? "foxing";
const scope = process.env.E2E_D1_LOCAL === "true" ? "--local" : "--remote";

if (!email || !password || !base) {
  console.error("Set E2E_PLUS_EMAIL, E2E_PLUS_PASSWORD, and E2E_SEED_BASE_URL first.");
  process.exit(1);
}

const origin = new URL(base).origin;

const signup = await fetch(new URL("/api/auth/sign-up/email", base), {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ name: "Foxing E2E Plus", email, password }),
});
if (!signup.ok && signup.status !== 422) {
  console.warn(`Sign-up returned ${signup.status}; the account may already exist.`);
}

execSync(
  `npx wrangler d1 execute ${dbName} ${scope} --command "UPDATE user SET email_verified = 1 WHERE email = '${email}';"`,
  { stdio: "inherit", shell: true },
);

const signin = await fetch(new URL("/api/auth/sign-in/email", base), {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email, password }),
});
const setCookies =
  typeof signin.headers.getSetCookie === "function"
    ? signin.headers.getSetCookie()
    : [signin.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((c) => String(c).split(";")[0]).join("; ");

if (signin.ok && cookie) {
  const onboard = await fetch(new URL("/api/v1/me/onboard", base), {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin },
    body: JSON.stringify({ username }),
  });
  if (!onboard.ok && onboard.status !== 409) {
    console.warn(`Onboard returned ${onboard.status}. Complete it once in the UI if needed.`);
  }
} else {
  console.warn(`Sign-in returned ${signin.status}; verify + onboard the account manually.`);
}

// Flip the profile to Plus so create-club (the one Plus club action) is allowed. The
// billing webhook is the tier writer in production; this is a test-only direct flip.
execSync(
  `npx wrangler d1 execute ${dbName} ${scope} --command "UPDATE profiles SET subscription_tier = 'plus' WHERE id = (SELECT id FROM user WHERE email = '${email}');"`,
  { stdio: "inherit", shell: true },
);

console.log(`E2E Plus account ready: ${email} (username ${username}, tier plus).`);
