import { expect, test as setup } from "@playwright/test";

// Sign-in fixture for the PLUS e2e account (used by the live-layer club spec and, in the
// social gate, as club owner A). Clubs are free now, so Plus is not required to create
// one; this account simply provides a stable owner session. Same real-login approach as
// auth.setup.ts: type into the visible form, save the resulting session for the
// authed-plus project. Fails loudly if creds are missing; it never skips (a skipped
// signed-in suite is how a broken flow shipped last time).
const STORAGE = "e2e/.auth/plus.json";

setup("sign in the plus account through the visible login form", async ({ page }) => {
  const email = process.env.E2E_PLUS_EMAIL;
  const password = process.env.E2E_PLUS_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_PLUS_EMAIL and E2E_PLUS_PASSWORD are required for the club specs. They are the " +
        "persistent verified Plus e2e account (see scripts/seed-e2e-plus-user.mjs). Set them, " +
        "or run only the public/authed projects.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE });
});
