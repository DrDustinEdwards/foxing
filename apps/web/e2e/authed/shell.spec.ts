import { expect, test } from "@playwright/test";

// The signed-in app shell with a real session: the account button replaces Sign in,
// and "/" hands off to /home.
test.describe("app shell (signed in)", () => {
  test('"/" redirects a signed-in visitor to /home', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/home/);
  });

  test("the header shows the account button, not Sign in", async ({ page }) => {
    await page.goto("/home");
    const header = page.getByRole("banner");
    await expect(header.getByRole("button", { name: /your account/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^sign in$/i })).toHaveCount(0);
  });

  // The rule that private pages carry no analytics (site-runtime PRIVATE_PAGE_HEADERS), checked on the live site:
  // signed-in pages with this session and the sign-in pages with none answer no-transform, so Cloudflare adds no
  // Web Analytics beacon, and the Worker still compresses them.
  test("signed-in and sign-in pages carry no Web Analytics and are still compressed", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    const pages = [
      ...["/home", "/library", "/settings"].map((path) => ({ path, request: page.request })),
      ...["/login", "/signup"].map((path) => ({ path, request: anonymous })),
    ];
    for (const { path, request } of pages) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["cache-control"], path).toContain("no-transform");
      expect(res.headers()["content-encoding"], path).toMatch(/^(br|gzip)$/);
      expect(await res.text(), path).not.toContain("beacon.min.js");
    }
    await anonymous.dispose();
  });
});
