import { expect, test } from "@playwright/test";

// The signed-in app shell with a real session: the account button replaces Sign in,
// "/" hands off to /home, and the account panel carries the tier badge.
test.describe("app shell (signed in)", () => {
  test('"/" redirects a signed-in visitor to /home', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/home/);
  });

  test("the header shows the account button, not Sign in", async ({ page }) => {
    await page.goto("/home");
    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: /your account/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^sign in$/i })).toHaveCount(0);
  });

  test("the account panel shows the subscription tier badge", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: /your account/i }).click();
    // The e2e account is free tier (billing is Phase 4b); the badge must still render.
    await expect(
      header.getByRole("group", { name: /your account/i }).getByText(/^(free|plus)$/i),
    ).toBeVisible();
  });
});
