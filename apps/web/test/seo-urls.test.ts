import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { describe, expect, it } from "vitest";
import { absoluteUrl, articleLd, buildMeta, journalTagPath } from "../app/lib/seo";

// Journal tags are free text from posts. One tag with "&" made the whole sitemap invalid XML,
// and a space made a broken link.
describe("journal tag URLs in the sitemap", () => {
  it("encode the tag as one path segment", () => {
    expect(journalTagPath("sci-fi")).toBe("/journal/tag/sci-fi");
    expect(journalTagPath("war & peace")).toBe("/journal/tag/war%20%26%20peace");
    expect(journalTagPath("a/b")).toBe("/journal/tag/a%2Fb");
  });

  it("a <loc> is valid XML whatever the tag", () => {
    const loc = escapeHtml(absoluteUrl(journalTagPath("<b>&")));
    expect(loc).toBe("https://foxing.app/journal/tag/%3Cb%3E%26");
  });
});

// The router matches /About to the About page; the page's canonical is the lowercase route, and a username or id keeps its case.
describe("canonical addresses", () => {
  const canonical = (pathname: string) =>
    buildMeta({ title: "T", pathname }).find((m) => "tagName" in m && m.rel === "canonical");
  it("lowercase the route's own words only", () => {
    expect(canonical("/About")).toMatchObject({ href: "https://foxing.app/about" });
    expect(canonical("/Journal/Archive")).toMatchObject({
      href: "https://foxing.app/journal/archive",
    });
    expect(canonical("/Journal/tag/Gothic")).toMatchObject({
      href: "https://foxing.app/journal/tag/Gothic",
    });
  });

  it("a Journal post with no picture of its own still has an Article image", () => {
    const ld = articleLd({
      slug: "a",
      title: "A",
      excerpt: null,
      coverImageUrl: null,
      publishedAt: null,
      updatedAt: null,
    });
    expect(ld.image).toBe("https://foxing.app/og/site");
  });
});
