import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { describe, expect, it } from "vitest";
import { absoluteUrl, journalTagPath } from "../app/lib/seo";

// Journal tags are free text from posts. One tag with "&" made the whole sitemap invalid XML,
// and a space made a broken link.
describe("journal tag URLs in the sitemap", () => {
  it("encode the tag as one path segment", () => {
    expect(journalTagPath("sci-fi")).toBe("/journal/tag/sci-fi");
    expect(journalTagPath("war & peace")).toBe("/journal/tag/war%20%26%20peace");
    expect(journalTagPath("a/b")).toBe("/journal/tag/a%2Fb");
  });

  it("a <loc> is valid XML whatever the tag", () => {
    const loc = escapeHtml(absoluteUrl("https://foxing.test", journalTagPath("<b>&")));
    expect(loc).toBe("https://foxing.test/journal/tag/%3Cb%3E%26");
  });
});
