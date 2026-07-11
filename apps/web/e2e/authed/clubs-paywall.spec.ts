import { expect, test } from "@playwright/test";

// The persistent e2e account is free tier. Creating a club is the one Plus club action,
// so a free user landing on /clubs/new must see the soft paywall, not a silent failure
// or a usable form. Joining/posting/polls stay free and are proven by the plus spec.
test.describe("clubs (signed in, free tier)", () => {
  test("creating a club opens the Plus paywall", async ({ page }) => {
    await page.goto("/clubs/new");
    // The dialog is labelled "Choose a Foxing Plus plan" (contains "Foxing Plus").
    const paywall = page.getByRole("dialog", { name: /foxing plus/i });
    await expect(paywall).toBeVisible();
    await expect(paywall.getByRole("button", { name: /start free 7-day trial/i })).toBeVisible();
  });

  test("the Clubs nav entry is present for signed-in users", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^clubs$/i }).first()).toBeVisible();
  });
});
