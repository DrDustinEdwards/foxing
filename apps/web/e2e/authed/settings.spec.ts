import { expect, test } from "@playwright/test";

// The expanded settings surface (Phase integration): visibility, appearance, and close
// friends join the original profile/plan/sign-in/data/delete sections. Driven through a
// real session against the visible controls; the save round-trips to /api/v1/me/visibility.
test.describe("settings (signed in)", () => {
  test("saving visibility round-trips and confirms", async ({ page }) => {
    await page.goto("/settings");
    // Flip the public-profile switch, then save; the section confirms with a visible status.
    const publicProfile = page.getByRole("switch", { name: /public profile/i });
    const before = await publicProfile.getAttribute("aria-checked");
    const flipped = before === "true" ? "false" : "true";
    await publicProfile.click();
    await page.getByRole("button", { name: /save visibility/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
    // The saved value survives a reload.
    await page.reload();
    await expect(publicProfile).toHaveAttribute("aria-checked", flipped);
    // This account is the social-feed follower too, whose profile must stay as it was:
    // flip it back the same way.
    await publicProfile.click();
    await page.getByRole("button", { name: /save visibility/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
    await page.reload();
    await expect(publicProfile).toHaveAttribute("aria-checked", before ?? "false");
  });
});
