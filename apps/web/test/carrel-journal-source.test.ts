import { describe, expect, it } from "vitest";
import {
  type JournalFields,
  journalToSource,
  sourceToJournal,
} from "../app/lib/carrel/journal-source";

// The one mapping between a Journal row and Carrel's file. A save reads the file back, so the
// round trip must hold for every field. Reading and refusing a malformed file is site-api's
// jsonSource, tested there.
const full: JournalFields = {
  title: 'On "Middlemarch": a reread',
  excerpt: "Why the novel holds up.",
  coverImageUrl: "https://covers.foxing.app/journal/middlemarch.webp",
  coverImageAlt: "A worn copy of Middlemarch",
  tags: ["essays", "classics"],
  featured: true,
  ogTitle: "Middlemarch, reread",
  ogDescription: "Why the novel holds up, in one paragraph.",
  ogImageUrl: "https://foxing.app/media/journal/2026/10/middlemarch-0a1b2c3d.jpg",
  ogImageAlt: "A worn copy of Middlemarch on a desk",
  canonicalUrl: "https://example.com/middlemarch",
  noindex: true,
  content: "## Opening\n\n---\n\nA rule inside the body is body text.\n",
};

describe("journal source mapping", () => {
  it("round-trips every field, including a --- rule inside the body", () => {
    expect(sourceToJournal(journalToSource(full))).toEqual(full);
    const empty = {
      ...full,
      excerpt: null,
      coverImageUrl: null,
      coverImageAlt: null,
      tags: [],
      featured: false,
      ogTitle: null,
      ogDescription: null,
      ogImageUrl: null,
      ogImageAlt: null,
      canonicalUrl: null,
      noindex: false,
    };
    expect(sourceToJournal(journalToSource(empty))).toEqual(empty);
  });
});
