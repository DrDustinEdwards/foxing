// One-time seed of the PERSISTENT verified e2e account that the signed-in Playwright
// specs sign in as. Run it once against the deployed preview whose D1 the e2e job
// targets. It creates the account through Better Auth (so the password is hashed
// correctly), force-verifies it in that same D1, then signs in and onboards it so
// authed pages do not bounce to /onboarding.
//
// Required env:
//   E2E_EMAIL           the account email (also a CI secret)
//   E2E_PASSWORD        the account password (also a CI secret)
//   E2E_SEED_BASE_URL   the deployed preview URL (or PLAYWRIGHT_BASE_URL)
// Optional:
//   E2E_USERNAME        profile username (default foxing_e2e)
//   E2E_D1_NAME         D1 database name for the verify step (default foxing)
//   E2E_D1_LOCAL=true   flip email_verified in the LOCAL D1 instead of --remote
//
// Usage (PowerShell):
//   $env:E2E_EMAIL="e2e@foxing.app"; $env:E2E_PASSWORD="..."; \
//   $env:E2E_SEED_BASE_URL="https://foxing.dustin-edwards.workers.dev"; \
//   node apps/web/scripts/seed-e2e-user.mjs
import { execSync } from "node:child_process";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const base = process.env.E2E_SEED_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;
const username = process.env.E2E_USERNAME ?? "foxing_e2e";
const dbName = process.env.E2E_D1_NAME ?? "foxing";
const scope = process.env.E2E_D1_LOCAL === "true" ? "--local" : "--remote";

if (!email || !password || !base) {
  console.error("Set E2E_EMAIL, E2E_PASSWORD, and E2E_SEED_BASE_URL first.");
  process.exit(1);
}

// Better Auth rejects state-changing requests without a trusted Origin (CSRF). A
// browser sends it automatically; a script must add it explicitly.
const origin = new URL(base).origin;

// 1. Create the account through the real Better Auth endpoint (correct hashing).
const signup = await fetch(new URL("/api/auth/sign-up/email", base), {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ name: "Foxing E2E", email, password }),
});
if (!signup.ok && signup.status !== 422) {
  console.warn(`Sign-up returned ${signup.status}; the account may already exist.`);
}

// 2. Force email_verified so the account can sign in without the email step. The '
//    in an email is unlikely; keep addresses simple to avoid SQL-quoting surprises.
execSync(
  `npx wrangler d1 execute ${dbName} ${scope} --command "UPDATE user SET email_verified = 1 WHERE email = '${email}';"`,
  { stdio: "inherit", shell: true },
);

// 3. Sign in and onboard so the account has a profile row (authed pages need one).
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

console.log(`E2E account ready: ${email} (username ${username}).`);
