import { describe, expect, it } from "vitest";
import { BACKUP_EXCLUDE, type DumpSummary, dumpProblems } from "../app/lib/backup-checks";

const live = { books: 2237, journal_posts: 75 };
const good: DumpSummary = {
  tables: [
    { name: "user", rows: 3 },
    { name: "profiles", rows: 3 },
    { name: "books", rows: 2237 },
    { name: "annotations", rows: 1 },
    { name: "journal_posts", rows: 75 },
  ],
};

describe("nightly dump checks", () => {
  it("passes a dump that holds the content, matches the live counts and leaves credentials out", () => {
    expect(dumpProblems(good, live)).toEqual([]);
  });

  it("fails an empty dump", () => {
    const problems = dumpProblems({ tables: [] }, live);
    expect(problems).toContain("the dump holds no tables");
    expect(problems).toContain("journal_posts is missing from the dump");
    expect(problems).toContain("every counted table dumped empty");
  });

  it("fails a dump whose counted tables are all empty, even when the live counts agree", () => {
    const dump = { tables: good.tables.map((t) => ({ ...t, rows: 0 })) };
    expect(dumpProblems(dump, { books: 0, journal_posts: 0 })).toEqual([
      "every counted table dumped empty",
    ]);
  });

  it("fails a dump whose count differs from the live table", () => {
    const dump = {
      tables: good.tables.map((t) => (t.name === "journal_posts" ? { ...t, rows: 74 } : t)),
    };
    expect(dumpProblems(dump, live)).toEqual(["journal_posts dumped 74 rows but has 75"]);
  });

  it("fails a dump that carries any credential table", () => {
    expect(BACKUP_EXCLUDE.length).toBe(4);
    for (const name of BACKUP_EXCLUDE) {
      const dump = { tables: [...good.tables, { name, rows: 1 }] };
      expect(dumpProblems(dump, live)).toEqual([`${name} is in the dump but must be excluded`]);
    }
  });
});
