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

  // REGRESSION (2026-07-09): a real reset succeeded end to end, but the following
  // sign-in returned a 500 for the account. The root cause was a transient D1 read
  // fault in the sign-in SELECTs (now retried in @foxing/core createDb; see
  // packages/core/test/d1-retry.test.ts). These flows previously stopped at the
  // reset form and never exercised sign-in, so the crash slipped through.
  //
  // A full reset -> sign-in round trip needs the emailed token, which this e2e cannot
  // read (no in-test D1 access). Until a test-email hook exists, sign-in is guarded
  // here at the UI contract level: a failed sign-in must render a handled error, never
  // a raw 500 / "Something went wrong" screen.
  test("failed sign-in renders a handled error, not a 500", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody-regression@example.com");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // The login form surfaces the error in an alert and stays on the page.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test("login shows the post-reset banner on ?reset=1", async ({ page }) => {
    await page.goto("/login?reset=1");
    await expect(page.getByText(/password updated/i)).toBeVisible();
  });

  // REGRESSION (2026-07-09): /me crashed into a raw 500 for a signed-in user with no
  // profile row (account predating onboarding). Profile-gated loaders now redirect:
  // anonymous -> /login, signed-in-without-profile -> /onboarding. The authed
  // no-profile -> /onboarding path is covered deterministically in
  // test/profile-gate.test.ts (e2e cannot forge a verified session here).
  test("anonymous /me redirects to login, never 500", async ({ page }) => {
    const res = await page.goto("/me");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
