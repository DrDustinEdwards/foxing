import { expect, test } from "@playwright/test";

// The library is auth-gated. Anonymous visitors are redirected to sign in. The
// signed-in flow (set status -> book moves shelf, create a shelf, set a goal, see
// the streak) is verified in the dogfood gate; the write paths + event emission
// are covered by test/library.integration.test.ts.
test.describe("library", () => {
  test("anonymous visitors are redirected to sign in", async ({ page }) => {
    await page.goto("/library");
    // The loader redirects with the return path in the `redirect` param; accept either
    // an encoded (%2F) or literal slash so the assertion tracks the actual redirect.
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)library/);
  });
});
