import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Search depth: grouped results, the filter bar, pagination, and the Cmd+K command
// palette. Everything is driven through the visible controls a human clicks.
const query = process.env.E2E_SEARCH_QUERY ?? "fisherman";
// A common word that is near-certain to return more than one page of catalog books.
const broad = "the";

test.describe("search depth", () => {
  test("a query renders grouped book results", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /^books/i })).toBeVisible();
    await expect(page.locator('a[href^="/books/"]').first()).toBeVisible();
  });

  test("the filter bar narrows the query by era through the visible controls", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^filters$/i }).click();
    await page.getByRole("combobox", { name: /^era$/i }).selectOption({ label: "1900 to 1949" });
    await expect(page).toHaveURL(/[?&]era=1900-1949/);
    // The active filter is reflected as a removable chip.
    await expect(page.getByRole("button", { name: /1900 to 1949/i })).toBeVisible();
  });

  test("results paginate with crawlable prev/next links", async ({ page }) => {
    await page.goto(`/search?q=${broad}`, { waitUntil: "networkidle" });
    const next = page.getByRole("link", { name: /next/i });
    await expect(next).toBeVisible();
    await next.click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByRole("link", { name: /previous/i })).toBeVisible();
  });

  test("the command palette opens from the header, searches, and closes", async ({ page }) => {
    await page.goto("/books", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /search the catalog/i }).click();

    const dialog = page.getByRole("dialog", { name: /search foxing/i });
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder("Search titles and authors").fill(query);
    await expect(dialog.getByRole("option").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the command palette opens with the Ctrl+K shortcut", async ({ page }) => {
    await page.goto("/books", { waitUntil: "networkidle" });
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: /search foxing/i })).toBeVisible();
  });

  test("the search results page has no serious accessibility violations (WCAG AA)", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /^books/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });

  test("the open command palette has no serious accessibility violations (WCAG AA)", async ({
    page,
  }) => {
    await page.goto("/books", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /search the catalog/i }).click();
    await expect(page.getByRole("dialog", { name: /search foxing/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
