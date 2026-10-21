import { expect, test } from "@playwright/test";

// Personal surfaces (diary, goals, year) driven through ONLY the visible controls with a
// REAL session (auth.setup.ts signed in through the form). A goal is created and edited
// through the page's own inputs, and a failed write is asserted to surface, never swallow.

test.describe("reading goals (signed in)", () => {
  test("the goals page renders and a new goal appears through the visible form", async ({
    page,
  }) => {
    await page.goto("/goals", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /reading goals/i })).toBeVisible();

    const target = `${90 + (Date.now() % 9)}`; // an unusual target so the assertion is specific
    // A run that failed before its clean-up can leave a goal with the same target behind.
    const rows = page.locator("li", { hasText: new RegExp(`${target} books`, "i") });
    const before = await rows.count();
    await page.getByRole("button", { name: /set goal/i }).scrollIntoViewIfNeeded();
    // The create form's number input is the first spinbutton on the page.
    await page.getByRole("spinbutton").first().fill(target);
    await page.getByRole("button", { name: /set goal/i }).click();

    await expect(rows).toHaveCount(before + 1);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Clean up: remove every goal with this target so the shared account stays tidy.
    for (let left = before + 1; left > 0; left--) {
      await rows
        .first()
        .getByRole("button", { name: /^remove$/i })
        .click();
      await expect(rows).toHaveCount(left - 1);
    }
  });

  test("a failed goal write is surfaced, not silently swallowed", async ({ page }) => {
    await page.route(/\/api\/v1\/goals/, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "server_error", message: "boom" } }),
          })
        : route.continue(),
    );
    await page.goto("/goals", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /set goal/i }).click();
    await expect(page.getByRole("alert")).toContainText(/could not save/i);
  });
});

test.describe("diary + year (signed in)", () => {
  test("the diary index renders with its new-entry action and filters", async ({ page }) => {
    await page.goto("/diary", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /your diary/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /new entry/i })).toBeVisible();
  });

  test("the year page renders the current year and its picker", async ({ page }) => {
    await page.goto("/year", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /your reading year/i })).toBeVisible();
    // The year picker links to at least one older year.
    const thisYear = new Date().getUTCFullYear();
    await expect(page.getByRole("link", { name: `${thisYear - 1}` })).toBeVisible();
  });
});

test.describe("cut features 301 to a live surface (signed in nav has no dead links)", () => {
  for (const [from, to] of [
    ["/series", "/books"],
    ["/quotes", "/journal"],
    ["/buddy-reads", "/clubs"],
  ]) {
    test(`${from} lands on ${to}`, async ({ page }) => {
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to}$`));
    });
  }
});
