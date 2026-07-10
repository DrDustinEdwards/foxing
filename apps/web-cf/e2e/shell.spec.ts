import { expect, test } from "@playwright/test";

// The signed-in app shell (nav authed state, secondary bar, /home dashboard). The
// authed side (avatar instead of Sign in, "/" -> /home, /me in the shell) needs a
// verified session, which this e2e cannot forge; that is exercised in the dogfood
// gate. Here we lock the anonymous contracts, which are deterministic.
test.describe("app shell", () => {
  test('"/" stays the marketing page for anonymous visitors', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /read the classics/i })).toBeVisible();
  });

  test("anonymous nav shows Sign in and Join free, not an avatar menu", async ({ page }) => {
    await page.goto("/");
    // Scope to the header; "Sign in" also appears in the footer account column.
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /join free/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  });

  test("the Books nav dropdown opens Browse and era filters", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^books$/i }).click();
    await expect(page.getByRole("menuitem", { name: /all books/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /before 1800/i })).toBeVisible();
  });

  test("/home redirects anonymous visitors to sign in", async ({ page }) => {
    const res = await page.goto("/home");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });
});
