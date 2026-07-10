import { expect, test } from "@playwright/test";

// Signed-in library write flow, driven through ONLY the visible controls (see
// e2e/README.md). This is the coverage the header-session integration test never
// gave: a real page, a hydrated control, and a real user interaction that must
// issue the write. Gated on E2E_SESSION_TOKEN because CI cannot forge a verified
// Better Auth session; skips cleanly when absent.
const token = process.env.E2E_SESSION_TOKEN;
const slug = process.env.E2E_BOOK_SLUG ?? "said-the-fisherman-pickthall";

test.describe("library writes (signed in)", () => {
  test.skip(!token, "set E2E_SESSION_TOKEN to run the signed-in write specs");

  test.beforeEach(async ({ context, baseURL }) => {
    const host = new URL(baseURL ?? "https://foxing.dustin-edwards.workers.dev").hostname;
    await context.addCookies([
      {
        name: "__Secure-better-auth.session_token",
        value: token as string,
        domain: host,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  });

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

    // The control is the visible native <select>; a signed-out user would see a
    // "Sign in to track" link instead. Fail loudly if we are not actually signed in.
    const control = page.getByRole("combobox", { name: /reading status/i });
    await expect(control).toBeVisible();

    // Two real selections guarantee a change event regardless of the starting
    // status; the flow must end on "Reading".
    await control.selectOption({ label: "Finished" });
    await control.selectOption({ label: "Reading" });
    await expect(control).toHaveValue("reading");

    // Every write that fired must have succeeded, and no error must be shown.
    expect(writes.length).toBeGreaterThan(0);
    for (const status of writes) expect(status).toBeLessThan(300);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a failed write is surfaced, not silently swallowed", async ({ page }) => {
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

    // The failure must be visible to the user.
    await expect(page.getByRole("alert")).toContainText(/could not save/i);
  });
});
