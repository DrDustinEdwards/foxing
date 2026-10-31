import { type Page, type WebSocket, expect, test } from "@playwright/test";

// THE DURABLE OBJECT GATE. A Plus user creates a club, starts a thread, posts, and runs
// a poll -- then a SECOND browser context on the same club proves the live layer: a post
// made in context A appears in context B without a reload, and a vote in A updates the
// tally in B live. Both prove the ClubRoom fan-out (write -> D1 commit -> DO notify).
//
// Uses the plus storageState for both contexts (same account, two connections). That is
// enough to prove cross-connection fan-out; presence dedupes to one user by design.

// Navigate, then wait until the page's club socket is live. A page renders from the
// server before it hydrates and opens its socket, so a write made in that window commits
// before this page is listening and never reaches it. The ClubRoom sends a presence frame
// to every socket it accepts, so the first frame received means the room has this page.
async function gotoLive(page: Page, url: string): Promise<void> {
  let live = false;
  const onSocket = (ws: WebSocket) => {
    if (new URL(ws.url()).pathname.endsWith("/live")) {
      ws.once("framereceived", () => {
        live = true;
      });
    }
  };
  page.on("websocket", onSocket);
  await page.goto(url);
  await expect.poll(() => live, { message: "the club live socket never opened" }).toBe(true);
  page.off("websocket", onSocket);
}

test.describe("clubs live layer (signed in, plus)", () => {
  test("live posts and live poll tallies fan out across two contexts", async ({
    page,
    browser,
  }) => {
    // Two contexts against the live site, each waiting on its socket: past the default 30s.
    test.setTimeout(60_000);
    const suffix = Date.now().toString(36);

    // --- Context A: create a club -----------------------------------------
    await page.goto("/clubs/new");
    await page.getByLabel("Club name").fill(`Live Club ${suffix}`);
    await page.getByRole("button", { name: /^create club$/i }).click();
    // "/clubs/new" itself matches a club URL, so wait for the new club's own page before
    // keeping its address.
    await expect(
      page.getByRole("heading", { level: 1, name: `Live Club ${suffix}` }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/clubs\/[a-z0-9-]+$/);
    await expect(page).not.toHaveURL(/\/clubs\/new$/);
    const clubUrl = page.url();

    // Start a thread and open it.
    await page.getByRole("button", { name: /^new thread$/i }).click();
    await page.getByLabel("Thread title").fill("Opening chapter");
    await page.getByRole("button", { name: /^post thread$/i }).click();
    await page.getByRole("link", { name: /opening chapter/i }).click();
    await expect(page).toHaveURL(/\/t\//);
    const threadUrl = page.url();

    // --- Context B: second connection to the same thread ------------------
    const ctxB = await browser.newContext({ storageState: "e2e/.auth/plus.json" });
    const pageB = await ctxB.newPage();
    await gotoLive(pageB, threadUrl);
    await expect(pageB.getByRole("heading", { name: /opening chapter/i })).toBeVisible();

    // A posts; B, already listening, should see it arrive live (no manual reload).
    const postText = `live-post-${suffix}`;
    await page.getByLabel("Add a reply").fill(postText);
    await page.getByRole("button", { name: /^post reply$/i }).click();
    await expect(page.getByText(postText)).toBeVisible();
    await expect(pageB.getByText(postText)).toBeVisible();

    // --- Live poll tally across contexts ----------------------------------
    // Create the poll first so B's page loads it, THEN vote so B sees the live tally.
    // The live socket opens once the page has hydrated, so "New poll" is a working button
    // by then; a click on the server-rendered page before that opens no form.
    await gotoLive(page, clubUrl);
    await page.getByRole("button", { name: /^new poll$/i }).click();
    await page.getByLabel("Poll question").fill("Next book?");
    await page.getByLabel("Option 1").fill("Middlemarch");
    await page.getByLabel("Option 2").fill("Bleak House");
    await page.getByRole("button", { name: /^create poll$/i }).click();
    await expect(page.getByRole("button", { name: /^Middlemarch/ })).toBeVisible();

    await gotoLive(pageB, clubUrl);
    await expect(pageB.getByRole("button", { name: /^Middlemarch/ })).toBeVisible();

    // A votes; B's tally for that option should update live to 1. The name is anchored
    // because once a vote exists the poll chart adds its own "Option Middlemarch" bar button.
    await page.getByRole("button", { name: /^Middlemarch/ }).click();
    await expect(pageB.getByRole("button", { name: /^Middlemarch/ })).toContainText("1");

    await ctxB.close();
  });
});
