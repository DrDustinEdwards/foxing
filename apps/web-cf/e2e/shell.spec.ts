import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The signed-in app shell (nav authed state, secondary bar, /home dashboard). The
// authed side (avatar instead of Sign in, "/" -> /home, /me in the shell) needs a
// verified session, which this e2e cannot forge; that is exercised in the dogfood
// gate. Here we lock the anonymous contracts, which are deterministic.
test.describe("app shell", () => {
  test('"/" stays the marketing page for anonymous visitors', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /read the classics/i })).toBeVisible();
  });

  test("anonymous nav shows Sign in and Join free, not an avatar menu", async ({ page }) => {
    await page.goto("/");
    // Scope to the header; "Sign in" also appears in the footer account column.
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /join free/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0);
  });

  test("the Books nav dropdown opens Browse and era filters", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^books$/i }).click();
    await expect(page.getByRole("menuitem", { name: /all books/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /before 1800/i })).toBeVisible();
  });

  test("/home redirects anonymous visitors to sign in", async ({ page }) => {
    const res = await page.goto("/home");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("the Celebrity Picks nav dropdown opens featured clubs and View all picks", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /celebrity picks/i }).click();
    const menu = page.getByRole("menu", { name: /celebrity picks/i });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /view all picks/i })).toBeVisible();
  });

  test("every rendered nav link resolves (no dead links)", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");

    const hrefs = new Set<string>();
    async function collect(scope: ReturnType<typeof page.locator>) {
      for (const href of await scope.locator("a[href]").evaluateAll((els) =>
        els.map((e) => e.getAttribute("href") ?? ""),
      )) {
        // Internal paths only; skip anchors, mailto, and external URLs.
        if (href.startsWith("/") && !href.startsWith("//")) hrefs.add(href);
      }
    }

    await collect(header);
    await page.getByRole("button", { name: /^books$/i }).click();
    await collect(page.getByRole("menu", { name: /^books$/i }));
    await page.getByRole("button", { name: /celebrity picks/i }).click();
    await collect(page.getByRole("menu", { name: /celebrity picks/i }));

    expect(hrefs.size).toBeGreaterThan(0);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} returned ${res.status()}`).not.toBe(404);
    }
  });

  test("the open Books mega-menu has no serious accessibility violations (WCAG AA)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^books$/i }).click();
    await expect(page.getByRole("menu", { name: /^books$/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });

  test("the open Celebrity Picks mega-menu has no serious accessibility violations (WCAG AA)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /celebrity picks/i }).click();
    await expect(page.getByRole("menu", { name: /celebrity picks/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });

  test("the mobile drawer opens from the hamburger and closes on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    const drawer = page.getByRole("dialog", { name: /^menu$/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /^books$/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });
});
