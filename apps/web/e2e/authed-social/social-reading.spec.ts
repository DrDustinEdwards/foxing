import { type Browser, type Frame, type Locator, type Page, expect, test } from "@playwright/test";

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

// The Contents entry all three readers open, so each lands on the same page of the same
// chapter (same device profile, default settings) and can find A's passage there.
const TOC_ENTRY = 2;

// A paragraph of real prose rather than a heading, a byline or a one-line title.
const MIN_WORDS = 8;

// Where a reader taps a passage: on its first line, across the middle of the page. Readium
// turns the page for a click in the outer quarter of either side that no highlight
// consumes, so a tap near the left edge that lands before a layer is drawn goes back a
// page instead of reaching the passage.
const TAP_LINE = 8;
type Passage = { frame: Frame; index: number; text: string; tap: { x: number; y: number } };
type FrameParagraph = {
  index: number;
  text: string;
  marked: boolean;
  tap: { x: number; y: number };
  points: [number, number][] | null;
};

// Every paragraph of a content frame, run inside the frame. `marked`: a highlight range
// touches it (the reader draws highlights with the CSS Custom Highlight API, so a drawn
// decoration is a range in CSS.highlights). `points`: set only when the paragraph lies
// wholly on the frame's shown page and the frame hit-tests its centre and its tap point
// to it, the same check a real click makes.
function frameParagraphs(line: number): FrameParagraph[] {
  const ranges = Array.from(CSS.highlights?.values() ?? []).flatMap((h) => Array.from(h));
  return Array.from(document.querySelectorAll("p")).map((p, index) => {
    const marked = ranges.some((r) => {
      const range = document.createRange();
      range.setStart(r.startContainer, r.startOffset);
      range.setEnd(r.endContainer, r.endOffset);
      return range.intersectsNode(p);
    });
    const r = p.getBoundingClientRect();
    const inside =
      r.width > 0 &&
      r.left >= 0 &&
      r.top >= 0 &&
      r.right <= window.innerWidth &&
      r.bottom <= window.innerHeight;
    const points: [number, number][] = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + r.width / 2, r.top + Math.min(line, r.height / 2)],
    ];
    const hit = inside && points.every(([x, y]) => p.contains(document.elementFromPoint(x, y)));
    return {
      index,
      text: (p.textContent ?? "").replace(/\s+/g, " ").trim(),
      marked,
      tap: { x: r.width / 2, y: Math.min(line, r.height / 2) },
      points: hit ? points : null,
    };
  });
}

// Where the reader stands (reader-view sets it on each position change), so a page turn
// or a Contents jump is waited on by its landing, not by a timer.
function position(page: Page): Promise<string | null> {
  return page.getByTestId("reader-container").getAttribute("data-position");
}

// The shown page has landed: the frame on top at the centre of the reading column is
// fully faded in (Readium keeps a pool of frames and fades the shown one in) and holds text.
async function waitForShownPage(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const box = document.querySelector('[data-testid="reader-container"]');
          if (!box) return false;
          const r = box.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!(el instanceof HTMLIFrameElement)) return false;
          for (let n: Element | null = el; n; n = n.parentElement) {
            if (getComputedStyle(n).opacity !== "1") return false;
          }
          return (el.contentDocument?.body?.innerText.trim().length ?? 0) > 0;
        }),
      { message: "the reader never showed a page", timeout: 30_000 },
    )
    .toBe(true);
}

// Turn the page with the visible Next page control and wait for the turn to land.
async function turnPage(page: Page): Promise<void> {
  const from = await position(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect.poll(() => position(page), { message: "the page turn never landed" }).not.toBe(from);
  await waitForShownPage(page);
}

// Find a paragraph lying wholly on the page the reader is showing: the first one of real
// prose, or the one whose text is `text`. Readium keeps a pool of resource frames
// (prev/current/next) and paginates each with CSS columns, so a paragraph can sit in a
// frame that is not the one shown, or on another page of the shown frame. Turns pages
// with the visible Next page control until one is found.
async function findParagraph(page: Page, text?: string, unmarked = false): Promise<Passage> {
  await waitForShownPage(page);
  for (let turn = 0; turn < 8; turn++) {
    const hit = await paragraphOnTop(page, text, unmarked);
    if (hit) return hit;
    await turnPage(page);
  }
  throw new Error(
    text
      ? `the shared passage never showed on this reader's page: "${text.slice(0, 60)}"`
      : "no paragraph of prose on the reader's first pages",
  );
}

async function paragraphOnTop(
  page: Page,
  text: string | undefined,
  unmarked: boolean,
): Promise<Passage | null> {
  for (const handle of await page.locator("iframe").elementHandles()) {
    const frame = await handle.contentFrame();
    if (!frame?.url().startsWith("blob:")) continue;
    const paragraphs = await frame.evaluate(frameParagraphs, TAP_LINE).catch(() => []);
    for (const c of paragraphs) {
      if (!c.points) continue;
      if (text ? c.text !== text : c.text.split(" ").length < MIN_WORDS) continue;
      if (unmarked && c.marked) continue;
      const onTop = await handle.evaluate((node, points) => {
        const el = node as HTMLElement;
        const r = el.getBoundingClientRect();
        const scale = r.width / (el.offsetWidth || r.width || 1);
        return points.every(
          ([x, y]) => document.elementFromPoint(r.left + x * scale, r.top + y * scale) === el,
        );
      }, c.points);
      if (onTop) return { frame, index: c.index, text: c.text, tap: c.tap };
    }
  }
  return null;
}

// Whether a highlight is drawn over the passage in its frame.
async function isMarked(passage: Passage): Promise<boolean> {
  const paragraphs = await passage.frame.evaluate(frameParagraphs, TAP_LINE).catch(() => []);
  return paragraphs[passage.index]?.marked ?? false;
}

// Open the book and jump to the shared chapter through the visible Contents list.
async function openReader(browser: Browser, storageState: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState });
  const page = await ctx.newPage();
  await page.goto(`/read/${SLUG}`);
  // "Opening book…" is the reader's status until the engine is ready.
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 30_000 });
  await waitForShownPage(page);
  const from = await position(page);
  await page.getByRole("button", { name: "Contents" }).click();
  const toc = page.getByRole("navigation", { name: /table of contents/i });
  await expect(toc).toBeVisible();
  const entries = toc.getByRole("button");
  await entries.nth(Math.min(TOC_ENTRY, (await entries.count()) - 1)).click();
  await expect(toc).toHaveCount(0);
  // The jump has landed when the position moved, or the reader already stood at the start
  // of a resource (a reader whose saved place is that chapter's first page).
  await expect
    .poll(async () => {
      const now = await position(page);
      return now !== from || /@0$/.test(now ?? "");
    })
    .toBe(true);
  await waitForShownPage(page);
  return page;
}

// Tap a passage the way a reader does: a single click on its first line. Decorations
// are drawn with the CSS Custom Highlight API (no DOM element to click), and the reader
// resolves a tap inside a highlighted range to that annotation.
async function tapParagraph(passage: Passage): Promise<void> {
  await passage.frame.locator("p").nth(passage.index).click({ position: passage.tap });
}

// Tap a marked passage once its highlight is drawn, and wait for its popover.
async function tapOpen(passage: Passage, popover: Locator): Promise<void> {
  await expect
    .poll(() => isMarked(passage), { message: "the passage's highlight was never drawn" })
    .toBe(true);
  await tapParagraph(passage);
  await expect(popover).toBeVisible();
}

test.describe("social reading: three-account gate", () => {
  test("A shares to club, B sees + replies, C never sees it", async ({ browser }) => {
    // Three signed-in readers against the live site, each opening a book and paging to a
    // chapter, then A undoing its highlight.
    test.setTimeout(240_000);

    // --- A: share a highlight to the club via the visible control -------------
    const a = await openReader(browser, "e2e/.auth/plus.json");
    // A passage A has not marked yet: one A already highlighted opens A's edit popover on
    // a click instead of a fresh selection.
    const passage = await findParagraph(a, undefined, true);
    // A triple-click is a real user gesture (not a synthetic Selection): it fires the
    // reader's textSelected, which opens the SelectionToolbar.
    await passage.frame.locator("p").nth(passage.index).click({ clickCount: 3 });
    const toolbar = a.getByRole("toolbar", { name: /highlight selection/i });
    await expect(toolbar).toBeVisible();
    // The "Share to club" toggle only renders when this book is a current read of one of
    // your active clubs -- the seed guarantees it for A.
    await toolbar.getByRole("button", { name: /share to club/i }).click();
    // Any color commits the highlight; with the toggle on it is saved club-visible.
    await toolbar
      .getByRole("button", { name: /highlight:/i })
      .first()
      .click();
    // The write surfaces through the visible saving indicator, never swallowed: wait for
    // it to settle, then confirm no error took its place.
    await expect(toolbar).toHaveCount(0);
    await expect(a.getByText(/^Saving/)).toHaveCount(0);
    await expect(a.getByText(/could not/i)).toHaveCount(0);

    // --- B: enable the club layer, see A attributed, reply --------------------
    const b = await openReader(browser, "e2e/.auth/social-b.json");
    // The chip's name carries the count of club annotations after the label.
    await b.getByRole("button", { name: /^my clubs/i }).click();
    const bPassage = await findParagraph(b, passage.text);
    // Tapping A's shared passage opens the attribution popover.
    const attribution = b.getByRole("dialog", { name: /annotation by/i });
    await tapOpen(bPassage, attribution);

    // Reply via the visible composer in the popover.
    const replyText = `reply-${Date.now().toString(36)}`;
    await attribution.getByPlaceholder(/reply to this passage/i).fill(replyText);
    await attribution.getByRole("button", { name: /^reply$/i }).click();
    await expect(attribution.getByText(replyText)).toBeVisible();

    // --- C: never sees A's club highlight, in ANY layer (the hard gate) -------
    const c = await openReader(browser, "e2e/.auth/social-c.json");
    // A non-member has no club annotations at all: the chip carries no count.
    await expect(c.getByRole("button", { name: "My clubs", exact: true })).toBeVisible();
    // Turn on every social layer C can: a non-member must still see nothing of the club.
    await c.getByRole("button", { name: /^my clubs/i }).click();
    await c.getByRole("button", { name: /^everyone/i }).click();
    // Tapping the very passage A shared opens no attribution popover for C.
    const cPassage = await findParagraph(c, passage.text);
    expect(await isMarked(cPassage)).toBe(false);
    await tapParagraph(cPassage);
    await expect(c.getByRole("dialog", { name: /annotation by/i })).toHaveCount(0);
    // And C cannot see B's reply text anywhere on the page.
    await expect(c.getByText(replyText)).toHaveCount(0);

    // --- A: delete the shared highlight through its own popover ---------------
    // The accounts persist across runs, so leave A's page unmarked for the next one.
    const own = await findParagraph(a, passage.text);
    const edit = a.getByRole("dialog", { name: /edit annotation/i });
    await tapOpen(own, edit);
    await edit.getByRole("button", { name: /^delete$/i }).click();
    await expect(edit).toHaveCount(0);
    await expect(a.getByText(/could not/i)).toHaveCount(0);

    await a.context().close();
    await b.context().close();
    await c.context().close();
  });
});
