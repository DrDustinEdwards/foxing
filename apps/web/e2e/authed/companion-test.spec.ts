import { expect, test } from "@playwright/test";

// The Phase 4a companion test harness (/companion-test), driven through the visible
// UI with the real login fixture. The persistent e2e account is free tier (everyone
// is, until Phase 4b billing ships), so this proves the tier gate for real against the
// live Worker: picking an action and running it must surface a visible 403, never a
// silent failure. The Plus success path is proven manually (dogfood + the D10 eval),
// since flipping the shared e2e account's tier would corrupt every other authed spec.
test.describe("companion test harness (signed in, free tier)", () => {
  test("running a Plus action opens the paywall, not a silent failure", async ({ page }) => {
    await page.goto("/companion-test", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /companion test/i })).toBeVisible();

    await page.getByRole("button", { name: /^run$/i }).click();

    // Phase 4b: a free user hitting a Plus action now sees the soft paywall (the intended
    // surface), instead of only an inline error string.
    const paywall = page.getByRole("dialog", { name: /foxing plus/i });
    await expect(paywall).toBeVisible();
    await expect(paywall.getByRole("button", { name: /start free 7-day trial/i })).toBeVisible();
  });

  test("the admin-only cache batch control is not shown to a non-admin user", async ({ page }) => {
    await page.goto("/companion-test", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /cache batch/i })).toHaveCount(0);
  });
});
