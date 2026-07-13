import { expect, test } from "@playwright/test";

// The persistent e2e account is free tier. Clubs are FREE: a free user on /clubs/new
// gets the usable create form, never a paywall. Plus gates the AI companion, never clubs.
test.describe("clubs (signed in, free tier)", () => {
  test("a free user gets the club create form, not a paywall", async ({ page }) => {
    await page.goto("/clubs/new");
    await expect(page.getByRole("heading", { name: /start a club/i })).toBeVisible();
    await expect(page.getByLabel("Club name")).toBeVisible();
    await expect(page.getByRole("button", { name: /^create club$/i })).toBeVisible();
    // No Plus paywall dialog is shown for a club action.
    await expect(page.getByRole("dialog", { name: /foxing plus/i })).toHaveCount(0);
  });

  test("the Clubs nav entry is present for signed-in users", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("link", { name: /^clubs$/i }).first()).toBeVisible();
  });
});
