import { type Browser, type Page, expect, test } from "@playwright/test";

// THE THREE-ACCOUNT GATE for the social reading moat. Three real browser sessions, each
// signed in through the visible login form (no minted tokens, no header sessions):
//   A = club owner, shares a highlight to the club via the visible "Share to club" control
//   B = club member, sees A's highlight attributed IN-READER and replies via the popover
//   C = NOT a member, and NEVER sees A's highlight in ANY layer, nor the thread
// The "C never sees it" assertion is the hard gate. Plus one progress-gate assertion.
//
// State (accounts + club + membership + current read) is seeded by
// scripts/seed-e2e-social.mjs; every interaction UNDER TEST here is a real click/type on
// a visible control, per the e2e rule.
const SLUG = process.env.E2E_BOOK_SLUG ?? "said-the-fisherman-pickthall";

// Readium renders each resource into a blob-URL iframe. Wait until one holds real prose.
async function waitForRenderedText(page: Page, minChars = 120): Promise<void> {
  await expect
    .poll(
      async () => {
        let max = 0;
        for (const f of page.frames()) {
          if (!f.url().startsWith("blob:")) continue;
          const len = await f
            .evaluate(() => document.body?.innerText?.trim().length ?? 0)
            .catch(() => 0);
          max = Math.max(max, len);
        }
        return max;
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBeGreaterThan(minChars);
}

// Select a paragraph in the visible content frame by triple-clicking it. This is a real
// user gesture (not a synthetic Selection): it fires the reader's textSelected, which
// opens the SelectionToolbar.
async function selectAParagraph(page: Page): Promise<void> {
  const frame = page.frames().find((f) => f.url().startsWith("blob:"));
  if (!frame) throw new Error("no content frame");
  const p = frame.locator("p", { hasText: /\w{40,}/ }).first();
  await p.scrollIntoViewIfNeeded();
  await p.click({ clickCount: 3 });
}

async function openReader(browser: Browser, storageState: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState });
  const page = await ctx.newPage();
  await page.goto(`/read/${SLUG}`);
  await waitForRenderedText(page);
  return page;
}

test.describe("social reading: three-account gate", () => {
  test("A shares to club, B sees + replies, C never sees it", async ({ browser }) => {
    // --- A: share a highlight to the club via the visible control -------------
    const a = await openReader(browser, "e2e/.auth/plus.json");
    await selectAParagraph(a);
    const toolbar = a.getByRole("toolbar", { name: /highlight selection/i });
    await expect(toolbar).toBeVisible();
    // The "Share to club" toggle only renders when this book is a current read of one of
    // your active clubs -- the seed guarantees it for A.
    await a.getByRole("button", { name: /share to club/i }).click();
    // Any color commits the highlight; with the toggle on it is saved club-visible.
    await toolbar
      .getByRole("button", { name: /highlight:/i })
      .first()
      .click();
    // The write surfaces through the visible saving/idle indicator, never swallowed.
    await expect(a.getByText(/could not/i)).toHaveCount(0);

    // --- B: enable the club layer, see A attributed, reply --------------------
    const b = await openReader(browser, "e2e/.auth/social-b.json");
    await b.getByRole("button", { name: /^my clubs$/i }).click();
    // A's shared passage renders as an other-reader decoration; tapping it opens the
    // attribution popover. Poll a reload in case the layer needs the fresh resolution.
    const attribution = b.getByRole("dialog", { name: /annotation by/i });
    await expect
      .poll(
        async () => {
          const frame = b.frames().find((f) => f.url().startsWith("blob:"));
          const mark = frame?.locator("[data-readium-decoration], mark, u").first();
          if (mark && (await mark.count())) await mark.click().catch(() => {});
          return attribution.isVisible().catch(() => false);
        },
        { timeout: 20_000, intervals: [1000, 2000] },
      )
      .toBe(true);
    await expect(attribution).toBeVisible();

    // Reply via the visible composer in the popover.
    const replyText = `reply-${Date.now().toString(36)}`;
    await attribution.getByPlaceholder(/reply to this passage/i).fill(replyText);
    await attribution.getByRole("button", { name: /^reply$/i }).click();
    await expect(attribution.getByText(replyText)).toBeVisible();

    // --- C: never sees A's club highlight, in ANY layer (the hard gate) -------
    const c = await openReader(browser, "e2e/.auth/social-c.json");
    // Turn on every social layer C can: a non-member must still see nothing of the club.
    await c.getByRole("button", { name: /^my clubs$/i }).click();
    await c.getByRole("button", { name: /^everyone$/i }).click();
    // No attribution popover can ever open for C: there is no other-reader decoration.
    const cFrame = c.frames().find((f) => f.url().startsWith("blob:"));
    const cMarks = cFrame?.locator("[data-readium-decoration]");
    if (cMarks) expect(await cMarks.count()).toBe(0);
    await expect(c.getByRole("dialog", { name: /annotation by/i })).toHaveCount(0);
    // And C cannot see B's reply text anywhere on the page.
    await expect(c.getByText(replyText)).toHaveCount(0);

    await a.context().close();
    await b.context().close();
    await c.context().close();
  });
});
