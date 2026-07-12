import { expect, test } from "@playwright/test";

// Find next book, driven with a REAL session (auth.setup.ts signed in through the form).
// The page reads recommendations in-process via core; here we only assert the visible
// result: the heading renders and the reader gets books, each with a reason line. A free
// account also sees the subtle upgrade affordance (data recs are free; AI reasons are Plus).

test.describe("find next book (signed in)", () => {
  test("renders recommended books, each with a reason", async ({ page }) => {
    await page.goto("/find-next-book", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /find your next book/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^refresh$/i })).toBeVisible();

    // The catalog has readable candidates, so the grid renders books with reason lines.
    const reasons = page.getByTestId("rec-reason");
    await expect(reasons.first()).toBeVisible();
    await expect(await reasons.first().innerText()).not.toHaveLength(0);

    // Each reason sits under a book that links into the catalog.
    await expect(page.getByRole("link", { name: /Title|by/i }).first()).toBeVisible();
  });
});
