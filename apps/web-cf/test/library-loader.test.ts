import { env } from "cloudflare:test";
import { createDb, libraryRepo, schema } from "@foxing/core";
import { beforeEach, describe, expect, it } from "vitest";
import { loadLibraryData, loadShelfDetail } from "../app/lib/library.server";

// Regression: the /library loader used to self-fetch its own /api/v1 and swallow the
// failure (`if (!res.ok) return {}`), so a reader with tracked books saw an EMPTY
// library and the dogfood would have lied. The loader now reads core in-process;
// this proves tracked books actually come back.

async function seedUser(id: string) {
  await createDb(env.DB)
    .insert(schema.user)
    .values({
      id,
      name: "Test",
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function seedBook(id: string, slug: string) {
  await createDb(env.DB).insert(schema.books).values({
    id,
    title: "Middlemarch",
    author: "George Eliot",
    slug,
    source: "test",
    sourceType: "catalog",
    language: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("library loader data", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.readingStreaks);
    await db.delete(schema.readingGoals);
    await db.delete(schema.customShelfBooks);
    await db.delete(schema.customShelves);
    await db.delete(schema.userBooks);
    await db.delete(schema.books);
    await db.delete(schema.user);
  });

  it("returns a reader's tracked books (never silently empty)", async () => {
    await seedUser("u_lib");
    await seedBook("bk_lib", "the-tracked-book");
    await createDb(env.DB).insert(schema.userBooks).values({
      id: "ub_1",
      userId: "u_lib",
      bookId: "bk_lib",
      status: "reading",
      progressPct: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const data = await loadLibraryData(env as never, "u_lib");
    expect(data.library).toHaveLength(1);
    expect(data.library[0]).toMatchObject({
      bookId: "bk_lib",
      status: "reading",
      slug: "the-tracked-book",
      title: "Middlemarch",
    });
  });

  it("returns empty structures (not an error) when nothing is tracked", async () => {
    await seedUser("u_empty");
    const data = await loadLibraryData(env as never, "u_empty");
    expect(data.library).toEqual([]);
    expect(data.shelves).toEqual([]);
    expect(data.goals).toEqual([]);
    expect(data.streak).toBeNull();
  });

  it("shelf detail returns the shelf and its books for the owner", async () => {
    await seedUser("u_shelf");
    await seedBook("bk_s1", "shelf-book-one");
    const db = createDb(env.DB);
    const shelf = await libraryRepo.createShelf(db, "u_shelf", { name: "Winter reads" });
    await libraryRepo.addBookToShelf(db, "u_shelf", shelf.id, "bk_s1");

    const detail = await loadShelfDetail(env as never, "u_shelf", shelf.id);
    expect(detail?.shelf.name).toBe("Winter reads");
    expect(detail?.books.map((b) => b.slug)).toContain("shelf-book-one");

    // The book-page picker reads shelf membership via shelfIdsForBook.
    const ids = await libraryRepo.shelfIdsForBook(db, "u_shelf", "bk_s1");
    expect(ids).toContain(shelf.id);
  });

  it("shelf detail is null for a shelf the caller does not own", async () => {
    await seedUser("u_owner");
    await seedUser("u_other");
    const shelf = await libraryRepo.createShelf(createDb(env.DB), "u_owner", { name: "Private" });
    expect(await loadShelfDetail(env as never, "u_other", shelf.id)).toBeNull();
  });
});
