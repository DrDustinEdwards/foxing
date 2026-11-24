import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { describe, expect, it } from "vitest";
import { absoluteUrl, articleLd, buildMeta, journalTagPath } from "../app/lib/seo";

// Journal tags are free text from posts. One tag with "&" made the whole sitemap invalid XML,
// and a space made a broken link.
describe("addresses in the sitemap and the head", () => {
  it("encode the tag as one path segment", () => {
    expect(journalTagPath("sci-fi")).toBe("/journal/tag/sci-fi");
    expect(journalTagPath("war & peace")).toBe("/journal/tag/war%20%26%20peace");
    expect(journalTagPath("a/b")).toBe("/journal/tag/a%2Fb");
    const canonical = (pathname: string) =>
      buildMeta({ title: "T", pathname }).find((m) => "tagName" in m && m.rel === "canonical");
    expect(canonical("/About")).toMatchObject({ href: "https://foxing.app/about" });
    expect(canonical("/Journal/Archive")).toMatchObject({
      href: "https://foxing.app/journal/archive",
    });
    expect(canonical("/Journal/tag/Gothic")).toMatchObject({
      href: "https://foxing.app/journal/tag/Gothic",
    });
    const post = {
      slug: "a",
      title: "A",
      excerpt: null,
      coverImageUrl: null,
      publishedAt: null,
      updatedAt: null,
    };
    expect(articleLd(post).image).toBe("https://foxing.app/og/site");
  });

  it("a <loc> is valid XML whatever the tag", () => {
    const loc = escapeHtml(absoluteUrl(journalTagPath("<b>&")));
    expect(loc).toBe("https://foxing.app/journal/tag/%3Cb%3E%26");
  });
});
