// Checks shared by the browser specs: the accessibility scan and the forced API failure.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
}

/** Makes every `method` request matching `url` answer 500, so a spec can prove the failure is shown. */
export async function failApiWrite(page: Page, url: RegExp, method: string) {
  await page.route(url, (route) =>
    route.request().method() === method
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ status: 500, code: "server_error", detail: "boom" }),
        })
      : route.continue(),
  );
}
