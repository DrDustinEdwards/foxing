import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The anonymous app shell on Capsomer's site header. The signed-in side is
// e2e/authed/shell.spec.ts. The header's own behaviour (panels, the phone sheet,
// Escape) is Capsomer's and tested there; these lock what Foxing puts in it.
test.describe("app shell", () => {
  test('"/" stays the marketing page for anonymous visitors', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /read the classics/i })).toBeVisible();
  });

  test("anonymous header shows Sign in and Join free, not the account button", async ({ page }) => {
    await page.goto("/");
    // Scope to the header; "Sign in" also appears in the footer account column.
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /join free/i })).toBeVisible();
    await expect(header.getByRole("button", { name: /your account/i })).toHaveCount(0);
  });

  test("/home redirects anonymous visitors to sign in", async ({ page }) => {
    const res = await page.goto("/home");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("the Books and Celebrity Picks panels open, and every header link resolves", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const header = page.getByRole("banner");

    const hrefs = new Set<string>();
    async function collect(scope: ReturnType<typeof page.locator>) {
      for (const href of await scope
        .locator("a[href]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""))) {
        // Internal paths only; skip anchors, mailto, and external URLs.
        if (href.startsWith("/") && !href.startsWith("//")) hrefs.add(href);
      }
    }

    await collect(header);
    await header.getByRole("button", { name: /^books$/i }).click();
    const books = header.getByRole("group", { name: /^books$/i });
    await expect(books.getByRole("link", { name: /all books/i })).toBeVisible();
    await expect(books.getByRole("link", { name: /before 1800/i })).toBeVisible();
    await collect(books);
    await header.getByRole("button", { name: /celebrity picks/i }).click();
    const picks = header.getByRole("group", { name: /celebrity picks/i });
    await expect(picks.getByRole("link", { name: /view all picks/i })).toBeVisible();
    await collect(picks);

    expect(hrefs.size).toBeGreaterThan(0);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} returned ${res.status()}`).not.toBe(404);
    }
  });

  test("the open Books panel has no serious accessibility violations (WCAG AA)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: /^books$/i }).click();
    await expect(header.getByRole("group", { name: /^books$/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
