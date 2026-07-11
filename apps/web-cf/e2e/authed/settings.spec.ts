import { expect, test } from "@playwright/test";

// The expanded settings surface (Phase integration): visibility, appearance, and close
// friends join the original profile/plan/password/data/delete sections. Driven through a
// real session against the visible controls; the save round-trips to /api/v1/me/visibility.
test.describe("settings (signed in)", () => {
  test("renders the profile, visibility, appearance, and close-friends sections", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /^profile$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^visibility$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^appearance$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^close friends$/i })).toBeVisible();
  });

  test("the appearance section exposes a theme toggle", async ({ page }) => {
    await page.goto("/settings");
    const appearance = page
      .getByRole("heading", { name: /^appearance$/i })
      .locator("xpath=ancestor::section");
    await expect(
      appearance.getByRole("button", { name: /switch to (light|dark) mode/i }),
    ).toBeVisible();
  });

  test("saving visibility round-trips and confirms", async ({ page }) => {
    await page.goto("/settings");
    // Flip the public-profile switch, then save; the section confirms with a visible status.
    const publicProfile = page.getByRole("switch", { name: /public profile/i });
    await publicProfile.click();
    await page.getByRole("button", { name: /save visibility/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
  });
});
