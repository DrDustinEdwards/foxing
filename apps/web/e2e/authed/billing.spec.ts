import { expect, test } from "@playwright/test";
import { expectNoSeriousViolations } from "../helpers";

// The Plus offer on /settings, driven through the visible UI with the real login fixture. The
// e2e account is free tier. Plus is offered only once it can be bought (the Stripe settings are
// set, CLAUDE.md rule 6), so this spec reads which state the target is in from what the page
// shows and checks that state. It never starts a checkout: this suite runs against the live site
// after every deploy, and a checkout is the keyed Dustin gate (billing.integration.test.ts covers
// the route's answers).
test.describe("Plus offer (signed in, free tier)", () => {
  test("Plus is offered only when it can be bought, and its paywall is accessible", async ({
    page,
  }) => {
    await page.goto("/settings", { waitUntil: "networkidle" });
    const upgrade = page.getByRole("button", { name: /upgrade to plus/i });
    if ((await upgrade.count()) === 0) {
      await expect(page.getByText(/not open for sign-up yet/i)).toBeVisible();
      return;
    }
    await upgrade.click();
    await expect(page.getByRole("dialog", { name: /foxing plus/i })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
