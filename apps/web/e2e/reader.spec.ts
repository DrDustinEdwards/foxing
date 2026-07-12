import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Reader smoke. Against the live preview it needs the book's RWPM in R2; locally
// it runs against the one --local-exploded book seeded into miniflare R2 + D1.
// The authed annotation flow (highlight persists across reload, multi-occurrence
// re-anchor) is verified in the dogfood gate; here we cover open + render +
// paginate + TOC jump + AA on the reader chrome, all anonymous.
const SLUG = "sailing-alone-around-the-world-slocum";

// Readium renders each resource into a blob-URL iframe (a prev/current/next pool).
// Wait until at least one holds real prose (a comfortable amount of text).
async function waitForRenderedText(page: Page, minChars = 120): Promise<void> {
  await expect
    .poll(
      async () => {
        let max = 0;
        for (const f of page.frames()) {
          if (!f.url().startsWith("blob:")) continue;
          const len = await f.evaluate(() => document.body?.innerText?.trim().length ?? 0).catch(() => 0);
          max = Math.max(max, len);
        }
        return max;
      },
      { timeout: 30000, intervals: [500, 1000] },
    )
    .toBeGreaterThan(minChars);
}

test.describe("reader", () => {
  test("opens, renders, paginates, and jumps via the TOC", async ({ page }) => {
    await page.goto(`/read/${SLUG}`);

    // Engine mounts client-side; loading overlay clears and book text renders.
    await waitForRenderedText(page);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByLabel("Reading progress")).toBeVisible();

    // Paginate forward (smoke: no crash, text still present).
    await page.getByRole("button", { name: "Next page" }).click();
    await waitForRenderedText(page);

    // TOC drawer opens; a chapter jump closes it and renders that chapter's prose.
    await page.getByRole("button", { name: "Contents" }).click();
    const toc = page.getByRole("navigation", { name: /table of contents/i });
    await expect(toc).toBeVisible();
    const entries = toc.getByRole("button");
    const count = await entries.count();
    await entries.nth(Math.min(8, count - 1)).click();
    await expect(toc).toHaveCount(0);
    await waitForRenderedText(page, 300);
  });

  test("reader chrome has no serious/critical accessibility violations", async ({ page }) => {
    await page.goto(`/read/${SLUG}`);
    await waitForRenderedText(page);
    // Scan our chrome only; the book content iframe is publisher HTML we do not own.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude('[data-testid="reader-container"]')
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious).toEqual([]);
  });
});
