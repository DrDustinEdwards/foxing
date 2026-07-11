// Year in Reading data access (Phase 6). Reads the books a user finished within a
// calendar year (UTC), with the detail the recap + OG image need. Rating overlays come
// from diaryRepo. Pure DB reads; the domain assembles the recap payload.
import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../db";
import { books, userBooks } from "../schema";

export type FinishedBook = {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  wordCount: number | null;
  finishedAt: Date | null;
};

export async function listFinishedInYear(
  db: Db,
  userId: string,
  year: number,
): Promise<FinishedBook[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return db
    .select({
      bookId: userBooks.bookId,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
      wordCount: books.wordCount,
      finishedAt: userBooks.finishedAt,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.status, "finished"),
        gte(userBooks.finishedAt, start),
        lt(userBooks.finishedAt, end),
      ),
    )
    .orderBy(asc(userBooks.finishedAt));
}
