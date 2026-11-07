import { describe, expect, it } from "vitest";
import {
  auditCatalog,
  isbn10To13,
  isValidIsbn10,
  isValidIsbn13,
  type HealthBook,
} from "../src/domain/catalog-health";

const ORIGIN = "https://covers.example.com";

const book = (over: Partial<HealthBook>): HealthBook => ({
  id: "b",
  title: "Emma",
  author: "Jane Austen",
  slug: "emma",
  sourceType: "catalog",
  coverUrl: `${ORIGIN}/emma.jpg`,
  description: "A novel.",
  epubUrl: `${ORIGIN}/emma.epub`,
  isbn: null,
  isbn13: null,
  publicationYear: 1815,
  subjects: ["Fiction"],
  gutenbergId: null,
  amazonUrl: null,
  bookshopUrl: null,
  ...over,
});

const checksOf = (books: HealthBook[]) => auditCatalog(books, ORIGIN).map((f) => f.check);

describe("ISBN check digits", () => {
  it("accepts real ISBNs and rejects a changed digit", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("converts an ISBN-10 to its ISBN-13", () => {
    expect(isbn10To13("0306406152")).toBe("9780306406157");
    expect(isbn10To13("0306406153")).toBeNull();
  });
});

describe("auditCatalog", () => {
  it("holds catalog books to the page's fields and community books to fewer", () => {
    const bare = {
      coverUrl: null,
      description: null,
      epubUrl: null,
      publicationYear: null,
      subjects: [],
    };
    expect(checksOf([book(bare)]).sort()).toEqual([
      "missing_cover",
      "missing_description",
      "missing_epub",
      "missing_subjects",
      "missing_year",
    ]);
    expect(checksOf([book({ ...bare, sourceType: "community" })])).toEqual(["missing_cover"]);
  });

  it("flags a cover on another host, a bad ISBN, an ISBN-10 and ISBN-13 of different editions", () => {
    expect(checksOf([book({ coverUrl: "https://elsewhere.test/c.jpg" })])).toEqual([
      "cover_not_hosted",
    ]);
    expect(checksOf([book({ isbn: "0306406153" })])).toEqual(["invalid_isbn"]);
    expect(checksOf([book({ isbn: "0306406152", isbn13: "9780143105428" })])).toEqual([
      "isbn_mismatch",
    ]);
  });

  it("finds one edition under an ISBN-10 on one book and its ISBN-13 on another", () => {
    const found = auditCatalog(
      [
        book({ id: "a", title: "A", isbn: "0306406152" }),
        book({ id: "b", title: "B", isbn13: "9780306406157" }),
        book({ id: "c", title: "C", isbn13: "9780143105428" }),
      ],
      ORIGIN,
    );
    expect(
      found
        .filter((f) => f.check === "duplicate_isbn")
        .map((f) => f.bookId)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("finds a duplicate title and author through case, accents, an article and 'Last, First'", () => {
    const found = auditCatalog(
      [
        book({ id: "a", title: "The Café & the Sea", author: "Austen, Jane" }),
        book({ id: "b", title: "cafe and the sea", author: "Jane Austen" }),
        book({ id: "c", title: "Cafe and the Sea", author: "Someone Else" }),
      ],
      ORIGIN,
    );
    expect(
      found
        .filter((f) => f.check === "duplicate_title_author")
        .map((f) => f.bookId)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("flags a shared Gutenberg id and retailer links that are not https links to the retailer", () => {
    const found = checksOf([
      book({ id: "a", title: "A", gutenbergId: 158 }),
      book({ id: "b", title: "B", gutenbergId: 158, bookshopUrl: "http://bookshop.org/x" }),
      book({ id: "c", title: "C", amazonUrl: "https://evil.example/amazon.com" }),
      book({
        id: "d",
        title: "D",
        amazonUrl: "https://www.amazon.com/dp/X",
        bookshopUrl: "https://bookshop.org/a/1/2",
      }),
    ]);
    expect(found.filter((c) => c === "duplicate_gutenberg_id")).toHaveLength(2);
    expect(found.filter((c) => c === "bad_retailer_link")).toHaveLength(2);
  });
});
