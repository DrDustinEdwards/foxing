import { expect, test } from "@playwright/test";

// Onboarding is gated to signed-in, not-yet-onboarded users. The full two-step flow
// (profile then a starter-book handoff to /books/:slug) needs a FRESH verified account
// each run, so it is exercised in the dogfood gate rather than against the persistent
// e2e account (which is already onboarded and would be redirected to /me). Here we lock
// the anonymous contract, which is deterministic.
test.describe("onboarding", () => {
  test("sends anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });
});
