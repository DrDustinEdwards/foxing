import { expect, test as setup } from "@playwright/test";
import { signInThroughLogin } from "./passkey";

// The real sign-in fixture. Every signed-in spec depends on this: it signs in by CLICKING
// "Sign in with a passkey" on the visible login page, exactly as a human does (the passkey
// lives in Chromium's virtual authenticator), then saves the resulting browser session (the
// cookie the app itself set) for the authed project to reuse. There is no cookie injection,
// no minted token, and no header session. The account is a persistent, verified, onboarded
// e2e user seeded once in the target D1 (scripts/seed-e2e-user.mjs); its passkey's private
// key is a secret (scripts/seed-e2e-passkeys.mjs).
//
// If the email or key is missing this FAILS LOUDLY. It never skips: a skipped signed-in
// suite is how a broken authed flow shipped last time.
const STORAGE = "e2e/.auth/user.json";

setup("sign in through the visible login page", async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL;
  if (!email || !baseURL) {
    throw new Error(
      "E2E_EMAIL is required for the signed-in specs. It is the persistent verified e2e " +
        "account (see scripts/seed-e2e-user.mjs). Set it, or run only the public project: " +
        "`playwright test --project=public`.",
    );
  }

  await signInThroughLogin(page, email, baseURL);

  // A real sign-in leaves /login for an authed page. The seeded account is onboarded, so
  // the header shows the account button instead of the Sign in link. If sign-in failed,
  // the page stays on /login with a role=alert, and these assertions fail.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /your account/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE });
});
