import { type Page, expect, test } from "@playwright/test";

// THE FEED VISIBILITY GATE, driven by two real signed-in users through visible controls
// only (e2e rule). User B is the Plus e2e account (this project's default session) and
// authors reviews. User A is the free e2e account (a second real browser context). A
// follows B, then:
//   - B's PUBLIC review reaches A (feed + profile).
//   - B's FRIENDS-only review is hidden from A until B adds A as a close friend.
//   - B's PRIVATE review never appears to A.
// The fine-grained public/friends/private matrix is asserted on B's profile, which
// renders review TEXT (the feed intentionally shows only "reviewed <title>", never the
// review body). The feed's own resolution is proven exhaustively at the API level in
// test/social.integration.test.ts; here we confirm the real UI drives the same contract.

async function handleFromMe(page: Page): Promise<string> {
  await page.goto("/me");
  const handle = await page
    .getByText(/^@[a-z0-9_.-]+$/i)
    .first()
    .innerText();
  return handle.replace(/^@/, "").trim();
}

// Log a book with a review + visibility, entirely through the visible diary form.
async function logReview(page: Page, reviewText: string, visibility: string) {
  await page.goto("/diary/new");
  await page.getByLabel(/find the book to log/i).fill("the");
  // The suggestion list renders result buttons; click the first real one.
  const firstResult = page.getByRole("button").filter({ hasText: /\w/ }).first();
  await firstResult.click();
  await expect(page.getByText(/^Logging/)).toBeVisible();

  await page.getByLabel(/^Review$/i).fill(reviewText);
  await page.getByLabel(/who can see this/i).selectOption(visibility);
  await page.getByRole("button", { name: /^save entry$/i }).click();
  await expect(page).toHaveURL(/\/u\//);
}

test.describe("social feed visibility (two real users)", () => {
  test("public visible, friends gated on close-friend, private never", async ({
    page,
    browser,
  }) => {
    const stamp = Date.now().toString(36);
    const publicReview = `public review ${stamp}`;
    const friendsReview = `friends review ${stamp}`;
    const privateReview = `private review ${stamp}`;

    // Identify both accounts.
    const bUsername = await handleFromMe(page); // Plus author

    const ctxA = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const pageA = await ctxA.newPage();
    const aUsername = await handleFromMe(pageA); // free follower
    expect(aUsername).not.toBe(bUsername);

    // A follows B from B's profile.
    await pageA.goto(`/u/${bUsername}`);
    await pageA.getByRole("button", { name: /^follow$/i }).click();
    await expect(pageA.getByRole("button", { name: /^following$/i })).toBeVisible();

    // B authors three reviews at three visibilities.
    await logReview(page, publicReview, "public");
    await logReview(page, friendsReview, "friends");
    await logReview(page, privateReview, "private");

    // --- A views B's profile: only the public review is visible so far ---------
    await pageA.goto(`/u/${bUsername}`);
    await expect(pageA.getByText(publicReview)).toBeVisible();
    await expect(pageA.getByText(friendsReview)).toHaveCount(0);
    await expect(pageA.getByText(privateReview)).toHaveCount(0);

    // --- A's feed surfaces B's public activity --------------------------------
    await pageA.goto("/feed");
    await expect(
      pageA.getByRole("link", { name: new RegExp(bUsername, "i") }).first(),
    ).toBeVisible();

    // --- B adds A as a close friend (Plus) from A's profile -------------------
    await page.goto(`/u/${aUsername}`);
    await page.getByRole("button", { name: /^add close friend$/i }).click();
    await expect(page.getByRole("button", { name: /^close friend$/i })).toBeVisible();

    // --- A now sees the friends-only review; private stays hidden -------------
    await pageA.goto(`/u/${bUsername}`);
    await expect(pageA.getByText(publicReview)).toBeVisible();
    await expect(pageA.getByText(friendsReview)).toBeVisible();
    await expect(pageA.getByText(privateReview)).toHaveCount(0);

    await ctxA.close();
  });
});
