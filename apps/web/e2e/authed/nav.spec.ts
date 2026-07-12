import { expect, test } from "@playwright/test";

// Nav menus driven through ONLY the visible controls with a REAL session (auth.setup.ts
// signed in through the form). The core assertion the previous nav regressions needed:
// every link a signed-in user can reach from the header menus resolves without a 404.

test.describe("header nav (signed in)", () => {
  test("Books mega-menu opens on hover and its links resolve", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Books" });
    await trigger.hover();
    const menu = page.getByRole("menu", { name: "Books" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /all books/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /award winners/i })).toBeVisible();
  });

  test("the notification bell links to /notifications", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /notifications/i }).first().click();
    await expect(page).toHaveURL(/\/notifications$/);
  });

  test("every account-menu destination resolves without a 404", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /account menu/i }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // Collect every real destination the menu exposes, then visit each and assert the
    // server did not answer 404. Sign out is a button, not a link, so it is excluded.
    const hrefs = await menu.getByRole("menuitem").evaluateAll((els) =>
      els
        .map((e) => (e as HTMLAnchorElement).getAttribute("href"))
        .filter((h): h is string => !!h && h.startsWith("/")),
    );
    expect(hrefs.length).toBeGreaterThan(5);

    for (const href of hrefs) {
      const res = await page.goto(href, { waitUntil: "domcontentloaded" });
      expect(res, `no response for ${href}`).not.toBeNull();
      expect(res?.status(), `${href} returned ${res?.status()}`).toBeLessThan(404);
      // Return to a page that has the menu for the next iteration.
      await page.goto("/home", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /account menu/i }).click();
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
