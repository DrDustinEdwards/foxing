import { expect, test } from "@playwright/test";

// The signed-in app shell contracts that shell.spec.ts (anonymous) could only
// defer to the dogfood gate. With a real session they are automated: the account
// menu replaces Sign in, "/" hands off to /home, and the secondary bar is present.
test.describe("app shell (signed in)", () => {
  test('"/" redirects a signed-in visitor to /home', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/home/);
  });

  test("the header shows the account menu, not Sign in", async ({ page }) => {
    await page.goto("/home");
    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: /account menu/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^sign in$/i })).toHaveCount(0);
  });

  test("the account menu opens Settings and Your library", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /your library/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /settings/i })).toBeVisible();
  });
});
