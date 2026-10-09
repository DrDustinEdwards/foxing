import { describe, expect, it } from "vitest";
import {
  type JournalFields,
  JournalSourceError,
  journalToSource,
  sourceToJournal,
} from "../app/lib/carrel/journal-source";

// The one mapping between a Journal row and Carrel's file. A save reads the file back, so the
// round trip must hold for every field, and a file the mapping cannot read must be refused with
// each problem named rather than saved with a field quietly dropped.
const full: JournalFields = {
  title: 'On "Middlemarch": a reread',
  excerpt: "Why the novel holds up.",
  coverImageUrl: "https://covers.foxing.app/journal/middlemarch.webp",
  coverImageAlt: "A worn copy of Middlemarch",
  tags: ["essays", "classics"],
  featured: true,
  content: "## Opening\n\n---\n\nA rule inside the body is body text.\n",
};

describe("journal source mapping", () => {
  it("round-trips every field, including a --- rule inside the body", () => {
    expect(sourceToJournal(journalToSource(full))).toEqual(full);
    const empty = { ...full, excerpt: null, coverImageUrl: null, coverImageAlt: null, tags: [], featured: false };
    expect(sourceToJournal(journalToSource(empty))).toEqual(empty);
  });

  it("reads unquoted text, CRLF line endings and absent keys as cleared", () => {
    const source = "---\r\ntitle: A plain title\r\nexcerpt: plain words\r\n---\r\n\r\nBody\r\n";
    expect(sourceToJournal(source)).toEqual({
      title: "A plain title",
      excerpt: "plain words",
      coverImageUrl: null,
      coverImageAlt: null,
      tags: [],
      featured: false,
      content: "Body\r\n",
    });
  });

  it("refuses a file it cannot read, naming each problem", () => {
    const cases: Array<[string, string]> = [
      ["# No front matter\n", "front matter block"],
      ["---\nexcerpt: x\n---\n\nBody", "title is required"],
      ['---\ntitle: "T"\nslug: other\n---\n\nBody', "slug is not a Journal field"],
      ['---\ntitle: "T"\ntitle: "U"\n---\n\nBody', "title appears twice"],
      ['---\ntitle: "T"\ntags: essays\n---\n\nBody', "tags: write a list"],
      ['---\ntitle: "T"\nfeatured: yes\n---\n\nBody', "featured: write true or false"],
      ['---\ntitle: "unterminated\n---\n\nBody', "title: the quoted value is not valid"],
    ];
    for (const [source, problem] of cases) {
      let caught: unknown;
      try {
        sourceToJournal(source);
      } catch (error) {
        caught = error;
      }
      expect(caught, source).toBeInstanceOf(JournalSourceError);
      expect((caught as Error).message, source).toContain(problem);
    }
    expect(cases).toHaveLength(7);
  });
});
