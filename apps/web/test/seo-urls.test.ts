import { describe, expect, it } from "vitest";
import { absoluteUrl, journalTagPath, xmlEscape } from "../app/lib/seo";

// Journal tags are free text from posts. One tag with "&" made the whole sitemap invalid XML,
// and a space made a broken link.
describe("journal tag URLs in the sitemap", () => {
  it("encode the tag as one path segment", () => {
    expect(journalTagPath("sci-fi")).toBe("/journal/tag/sci-fi");
    expect(journalTagPath("war & peace")).toBe("/journal/tag/war%20%26%20peace");
    expect(journalTagPath("a/b")).toBe("/journal/tag/a%2Fb");
  });

  it("a <loc> is valid XML whatever the tag", () => {
    const loc = xmlEscape(absoluteUrl("https://foxing.test", journalTagPath("<b>&")));
    expect(loc).toBe("https://foxing.test/journal/tag/%3Cb%3E%26");
    expect(xmlEscape(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
  });
});
