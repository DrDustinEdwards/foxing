import { expect, test as setup } from "@playwright/test";
import { signInThroughLogin } from "./passkey";

// Sign-in fixtures for the two extra accounts the three-account social-reading gate
// needs (B, a club member; C, a non-member). Each signs in through the VISIBLE login
// page's passkey button and saves the browser's own session, exactly like auth.setup.ts.
// A (the club owner) reuses the Plus session from auth-plus.setup.ts. All three accounts
// + the club are prepared by scripts/seed-e2e-social.mjs.
//
// Fails loudly when an email is missing: a skipped social suite is how a broken moat ships.
for (const [key, label] of [
  ["B", "club member"],
  ["C", "non-member"],
] as const) {
  setup(
    `sign in account ${key} (${label}) through the visible login page`,
    async ({ page, baseURL }) => {
      const email = process.env[`E2E_${key}_EMAIL`];
      if (!email || !baseURL) {
        throw new Error(`E2E_${key}_EMAIL is required for the social-reading gate.`);
      }
      await signInThroughLogin(page, email, baseURL);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("button", { name: /your account/i })).toBeVisible();
      await page.context().storageState({ path: `e2e/.auth/social-${key.toLowerCase()}.json` });
    },
  );
}
