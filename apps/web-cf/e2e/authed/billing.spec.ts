import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The Plus paywall (Phase 4b), driven through the visible UI with the real login fixture.
// The e2e account is free tier, so /settings offers the upgrade and the paywall opens.
// Real Stripe checkout is not exercised here (no keys on the preview) -- that is the
// keyed Dustin gate; here we lock the paywall UI, the plan toggle, and the visible CTA
// state.
test.describe("Plus paywall (signed in, free tier)", () => {
  test("settings offers an upgrade that opens the paywall", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /upgrade to plus/i }).click();
    await expect(page.getByRole("dialog", { name: /foxing plus/i })).toBeVisible();
  });

  test("the plan toggle defaults to annual savings and switches to monthly", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /upgrade to plus/i }).click();
    const dialog = page.getByRole("dialog", { name: /foxing plus/i });

    const annual = dialog.getByRole("button", { name: /annual/i });
    const monthly = dialog.getByRole("button", { name: /monthly/i });
    await expect(annual).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText(/save \$26/i)).toBeVisible();

    await monthly.click();
    await expect(monthly).toHaveAttribute("aria-pressed", "true");
    await expect(annual).toHaveAttribute("aria-pressed", "false");
  });

  test("the trial CTA attempts checkout and surfaces a visible state", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /upgrade to plus/i }).click();
    const dialog = page.getByRole("dialog", { name: /foxing plus/i });
    await dialog.getByRole("button", { name: /start free 7-day trial/i }).click();
    // No Stripe keys on the preview: the endpoint answers 503 and the paywall shows a
    // visible message, never a silent no-op.
    await expect(dialog.getByRole("alert")).toBeVisible();
  });

  test("the open paywall has no serious accessibility violations (WCAG AA)", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /upgrade to plus/i }).click();
    await expect(page.getByRole("dialog", { name: /foxing plus/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
