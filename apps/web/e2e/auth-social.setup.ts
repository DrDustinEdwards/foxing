import { expect, test as setup } from "@playwright/test";

// Sign-in fixtures for the two extra accounts the three-account social-reading gate
// needs (B, a club member; C, a non-member). Each signs in through the VISIBLE login
// form and saves the browser's own session, exactly like auth.setup.ts. A (the club
// owner) reuses the Plus session from auth-plus.setup.ts. All three accounts + the club
// are prepared by scripts/seed-e2e-social.mjs.
//
// Fails loudly when creds are missing: a skipped social suite is how a broken moat ships.
async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  // Reveal the collapsed password form, then target its Email (the last of two inputs).
  await page.getByRole("button", { name: /use a password instead/i }).click();
  await page.getByLabel("Email").last().fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
}

setup("sign in account B (club member) through the visible form", async ({ page }) => {
  const email = process.env.E2E_B_EMAIL;
  const password = process.env.E2E_B_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_B_EMAIL and E2E_B_PASSWORD are required for the social-reading gate.");
  }
  await signIn(page, email, password);
  await page.context().storageState({ path: "e2e/.auth/social-b.json" });
});

setup("sign in account C (non-member) through the visible form", async ({ page }) => {
  const email = process.env.E2E_C_EMAIL;
  const password = process.env.E2E_C_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_C_EMAIL and E2E_C_PASSWORD are required for the social-reading gate.");
  }
  await signIn(page, email, password);
  await page.context().storageState({ path: "e2e/.auth/social-c.json" });
});
