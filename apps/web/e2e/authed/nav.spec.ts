import { expect, test } from "@playwright/test";

// The header driven through ONLY the visible controls with a REAL session (auth.setup.ts
// signed in through the form). The core assertion the previous nav regressions needed:
// every link a signed-in user can reach from the account panel resolves without a 404.

test.describe("header nav (signed in)", () => {
  test("every account-panel destination resolves without a 404", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: /your account/i }).click();
    const panel = header.getByRole("group", { name: /your account/i });
    await expect(panel).toBeVisible();

    // Collect every real destination the panel exposes, then visit each and assert the
    // server did not answer 404. Sign out is a button, not a link, so it is excluded.
    const hrefs = await panel
      .getByRole("link")
      .evaluateAll((els) =>
        els
          .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
          .filter((h): h is string => !!h && h.startsWith("/")),
      );
    expect(hrefs.length).toBeGreaterThan(5);

    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} returned ${res.status()}`).toBeLessThan(404);
    }
  });
});

test.describe("command palette (signed in)", () => {
  test("opens with the GO TO section and the keyboard-hint footer", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Search books, people, clubs...");
    await expect(input).toBeVisible();
    await expect(page.getByText("Go to", { exact: false })).toBeVisible();
    await expect(page.getByText(/esc/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });
});
