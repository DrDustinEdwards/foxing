import { env } from "cloudflare:test";
import { catalogRepo, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// Catalog reads against a real local D1 (miniflare), so the FTS5 triggers and the
// trigram-OR fuzzy fallback are exercised for real, not mocked.

const db = () => createDb(env.DB);

async function seed() {
  const d = db();
  await d.insert(schema.books).values([
    {
      slug: "the-brothers-karamazov-dostoyevsky",
      title: "The Brothers Karamazov",
      author: "Fyodor Dostoyevsky",
      authorSlug: "fyodor-dostoyevsky",
      source: "gutenberg",
      sourceType: "catalog",
      language: "en",
      epubUrl: "https://epubs.foxing.app/karamazov.epub",
      coverUrl: "https://covers.foxing.app/karamazov.jpg",
      subjects: ["fiction", "russian literature", "philosophy"],
      publicationYear: 1880,
      wordCount: 364000,
    },
    {
      slug: "pride-and-prejudice-austen",
      title: "Pride and Prejudice",
      author: "Jane Austen",
      authorSlug: "jane-austen",
      source: "gutenberg",
      sourceType: "catalog",
      language: "en",
      epubUrl: "https://epubs.foxing.app/pride.epub",
      subjects: ["fiction", "romance"],
      publicationYear: 1813,
      wordCount: 122000,
    },
    {
      // Community book: must never surface in browse or search.
      slug: "a-modern-community-title",
      title: "A Modern Community Title",
      author: "Some Author",
      authorSlug: "some-author",
      source: "google_books",
      sourceType: "community",
      language: "en",
      subjects: ["fiction"],
    },
  ]);
  // Award only the (cover-bearing) Karamazov, so the starter set has one true row.
  const [karamazov] = await d
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(eq(schema.books.slug, "the-brothers-karamazov-dostoyevsky"));
  await d.insert(schema.bookAwards).values({
    bookId: karamazov.id,
    awardSlug: "nobel-prize",
    awardName: "Nobel Prize in Literature",
    year: 1880,
    distinction: "winner",
    scope: "international",
  });
}

describe("catalog search", () => {
  beforeEach(async () => {
    await db().delete(schema.books);
    await seed();
  });

  it("finds a book by exact author (strict FTS)", async () => {
    const res = await catalogRepo.searchCatalog(db(), "Dostoyevsky");
    expect(res.fuzzy).toBe(false);
    expect(res.books.map((b) => b.slug)).toContain("the-brothers-karamazov-dostoyevsky");
  });

  it("returns the right book for a MISSPELLED author via the fuzzy fallback", async () => {
    const res = await catalogRepo.searchCatalog(db(), "Dostoevski");
    expect(res.fuzzy).toBe(true);
    expect(res.books[0]?.slug).toBe("the-brothers-karamazov-dostoyevsky");
  });

  it("excludes community books from search", async () => {
    const res = await catalogRepo.searchCatalog(db(), "Community");
    expect(res.books).toHaveLength(0);
  });

  it("narrows results by the era filter without losing the FTS match", async () => {
    const inEra = await catalogRepo.searchCatalog(db(), "pride", { era: "1800-1849" });
    expect(inEra.books.map((b) => b.slug)).toEqual(["pride-and-prejudice-austen"]);
    const outOfEra = await catalogRepo.searchCatalog(db(), "pride", { era: "pre-1800" });
    expect(outOfEra.books).toHaveLength(0);
    expect(outOfEra.total).toBe(0);
  });

  it("narrows results by the genre (subject) filter", async () => {
    const romance = await catalogRepo.searchCatalog(db(), "pride", { subject: "romance" });
    expect(romance.books.map((b) => b.slug)).toEqual(["pride-and-prejudice-austen"]);
    const philosophy = await catalogRepo.searchCatalog(db(), "pride", { subject: "philosophy" });
    expect(philosophy.books).toHaveLength(0);
  });
});

describe("author search + starter set", () => {
  beforeEach(async () => {
    await db().delete(schema.books);
    await seed();
  });

  it("finds catalog authors by name substring, ranked by book count", async () => {
    const hits = await catalogRepo.searchAuthors(db(), "austen");
    expect(hits).toEqual([{ author: "Jane Austen", authorSlug: "jane-austen", bookCount: 1 }]);
  });

  it("never surfaces community authors", async () => {
    const hits = await catalogRepo.searchAuthors(db(), "some author");
    expect(hits).toHaveLength(0);
  });

  it("returns award-winning, cover-bearing catalog books as the starter set", async () => {
    const starters = await catalogRepo.listStarterBooks(db(), 6);
    // Only Karamazov has both a cover and an award in the seed; Pride has neither.
    expect(starters.map((b) => b.slug)).toEqual(["the-brothers-karamazov-dostoyevsky"]);
  });
});

describe("catalog browse + detail", () => {
  beforeEach(async () => {
    await db().delete(schema.books);
    await seed();
  });

  it("lists only catalog books and derives readability", async () => {
    const res = await catalogRepo.listBooks(db());
    expect(res.total).toBe(2);
    expect(res.books.every((b) => b.readable)).toBe(true);
  });

  it("filters by era bucket", async () => {
    const res = await catalogRepo.listBooks(db(), { era: "1800-1849" });
    expect(res.books.map((b) => b.slug)).toEqual(["pride-and-prejudice-austen"]);
  });

  it("resolves a book by slug, including community books (noindex pages)", async () => {
    const community = await catalogRepo.getBookBySlug(db(), "a-modern-community-title");
    expect(community?.sourceType).toBe("community");
  });
});
