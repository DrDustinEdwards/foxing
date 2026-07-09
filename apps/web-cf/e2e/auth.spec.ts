import { expect, test } from "@playwright/test";

test.describe("auth flows", () => {
  test("forgot-password always shows neutral response", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot your password/i })).toBeVisible();

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    // Neutral message regardless of whether the address is registered.
    await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
    await expect(page.getByText(/back to sign in/i)).toBeVisible();
  });

  test("reset-password with no token shows expired message", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /expired or invalid/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /request a new reset link/i })).toBeVisible();
  });

  test("login page has forgot password link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /forgot your password/i })).toBeVisible();
  });
});
