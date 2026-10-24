import { expect, test as setup } from "@playwright/test";
import { signInThroughLogin } from "./passkey";

// Sign-in fixture for the PLUS e2e account (used by the live-layer club spec and, in the
// social gate, as club owner A). Clubs are free now, so Plus is not required to create
// one; this account simply provides a stable owner session. Same real-login approach as
// auth.setup.ts: click the visible passkey button, save the resulting session for the
// authed-plus project. Fails loudly if the email is missing; it never skips (a skipped
// signed-in suite is how a broken flow shipped last time).
const STORAGE = "e2e/.auth/plus.json";

setup("sign in the plus account through the visible login page", async ({ page, baseURL }) => {
  const email = process.env.E2E_PLUS_EMAIL;
  if (!email || !baseURL) {
    throw new Error(
      "E2E_PLUS_EMAIL is required for the club specs. It is the persistent verified Plus e2e " +
        "account (see scripts/seed-e2e-plus-user.mjs). Set it, or run only the public/authed " +
        "projects.",
    );
  }

  await signInThroughLogin(page, email, baseURL);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /your account/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE });
});
