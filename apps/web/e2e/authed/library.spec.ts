import { expect, test } from "@playwright/test";

// Signed-in library writes, driven through ONLY the visible controls with a REAL
// session (auth.setup.ts signed in through the form). This is the coverage the
// deleted header-session integration test pretended to give: a real page, a
// hydrated control, a real click, and an assertion on what the user sees.
const slug = process.env.E2E_BOOK_SLUG ?? "said-the-fisherman-pickthall";

test.describe("library writes (signed in)", () => {
  test("choosing a status from the visible select issues the write and reflects it", async ({
    page,
  }) => {
    const writes: number[] = [];
    page.on("response", (r) => {
      if (/\/api\/v1\/library\//.test(r.url()) && r.request().method() === "PUT") {
        writes.push(r.status());
      }
    });

    await page.goto(`/books/${slug}`, { waitUntil: "networkidle" });

    // The control is the visible native <select>. A signed-out user would see a
    // "Sign in to track" link instead, so this also proves we are really signed in.
    const control = page.getByRole("combobox", { name: /reading status/i });
    await expect(control).toBeVisible();

    // Two selections guarantee a change event regardless of the starting status;
    // the flow must end on "Reading".
    await control.selectOption({ label: "Finished" });
    await control.selectOption({ label: "Reading" });
    await expect(control).toHaveValue("reading");

    expect(writes.length).toBeGreaterThan(0);
    for (const status of writes) expect(status).toBeLessThan(300);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a failed status write is surfaced, not silently swallowed", async ({ page }) => {
    await page.route(/\/api\/v1\/library\//, (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "server_error", message: "boom" } }),
          })
        : route.continue(),
    );

    await page.goto(`/books/${slug}`, { waitUntil: "networkidle" });
    const control = page.getByRole("combobox", { name: /reading status/i });
    await expect(control).toBeVisible();

    await control.selectOption({ label: "Paused" });
    await expect(page.getByRole("alert")).toContainText(/could not save/i);
  });

  test("creating then removing a shelf through the visible controls", async ({ page }) => {
    const name = `e2e-shelf-${Date.now()}`;
    await page.goto("/library", { waitUntil: "networkidle" });

    // ShelvesCard: type into the visible "New shelf" input and click Add.
    await page.getByPlaceholder("New shelf").fill(name);
    await page.getByRole("button", { name: /^add$/i }).click();

    const shelfLink = page.getByRole("link", { name });
    await expect(shelfLink).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Clean up so the shared e2e account stays tidy; this also exercises delete.
    await page
      .locator("li", { hasText: name })
      .getByRole("button", { name: /^remove$/i })
      .click();
    await expect(shelfLink).toHaveCount(0);
  });
});
