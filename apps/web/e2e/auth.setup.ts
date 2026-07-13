import { expect, test as setup } from "@playwright/test";

// The real sign-in fixture. Every signed-in spec depends on this: it signs in by
// TYPING INTO THE VISIBLE LOGIN FORM and clicking submit, exactly as a human does,
// then saves the resulting browser session (the cookie the app itself set) for the
// authed project to reuse. There is no cookie injection, no minted token, and no
// header session. The account is a persistent, verified, onboarded e2e user seeded
// once in the target D1 (see scripts/seed-e2e-user.mjs); its password is a secret.
//
// If the credentials are missing this FAILS LOUDLY. It never skips: a skipped
// signed-in suite is how a broken authed flow shipped last time.
const STORAGE = "e2e/.auth/user.json";

setup("sign in through the visible login form", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD are required for the signed-in specs. They are the " +
        "persistent verified e2e account (see scripts/seed-e2e-user.mjs). Set them, or run " +
        "only the public project: `playwright test --project=public`.",
    );
  }

  await page.goto("/login");
  // Password sign-in is collapsed behind a reveal link (Google + magic link lead). Open
  // it, then target the password form's Email (the last of the two email inputs).
  await page.getByRole("button", { name: /use a password instead/i }).click();
  await page.getByLabel("Email").last().fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // A real sign-in leaves /login for an authed page. The seeded account is onboarded,
  // so the header shows the account menu instead of the Sign in link. If sign-in
  // failed, the form stays on /login with a role=alert, and these assertions fail.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE });
});
