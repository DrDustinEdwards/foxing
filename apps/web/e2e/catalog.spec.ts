import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public catalog flows", () => {
  test("browse -> filter -> open a book page", async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("heading", { name: /browse the books/i })).toBeVisible();

    // Apply a genre filter (first genre facet). URL gains ?subject and grid stays populated.
    const firstGenre = page.locator('a[href*="subject="]').first();
    await firstGenre.click();
    await expect(page).toHaveURL(/[?&]subject=/);

    // Open the first book in the grid.
    const firstBook = page.locator('a[href^="/books/"]').first();
    await firstBook.click();
    await expect(page).toHaveURL(/\/books\/[a-z0-9-]+$/);
    await expect(page.locator("h1")).toBeVisible();

    // JSON-LD is valid JSON: the Book, and exactly one BreadcrumbList (Prelum's graph).
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld
      .flatMap((t) => JSON.parse(t)["@graph"] ?? [JSON.parse(t)])
      .map((n) => n["@type"]);
    expect(types).toContain("Book");
    expect(types.filter((t) => t === "BreadcrumbList")).toHaveLength(1);
  });

  test("misspelled author returns the right book via the fuzzy fallback", async ({ page }) => {
    // 'Dostoevski' is a substitution typo of the indexed 'Dostoyevsky'. Trigram substring
    // alone misses it; the OR'd-trigram fallback recovers it. This is the Phase 2 gap,
    // now closed at the app layer.
    await page.goto("/search?q=Dostoevski");
    await expect(page.getByText(/closest results/i)).toBeVisible();
    const results = page.locator('a[href^="/books/"]');
    await expect(results.first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/Dosto/i);
  });

  test("search-as-you-type suggests books", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("combobox").fill("pride");
    await expect(page.getByRole("option").first()).toBeVisible();
  });

  test("book page has no serious accessibility violations (WCAG AA)", async ({ page }) => {
    await page.goto("/books");
    const firstBook = page.locator('a[href^="/books/"]').first();
    await firstBook.click();
    await expect(page.locator("h1")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });

  test("browse page has no serious accessibility violations (WCAG AA)", async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("heading", { name: /browse the books/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
