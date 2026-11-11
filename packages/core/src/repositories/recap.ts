// Year in Reading data access. Reads the books a user finished within a
// calendar year in the reader's own timezone (UTC without one), with the detail the recap + OG image need. Rating overlays come
// from diaryRepo. Pure DB reads; the domain assembles the recap payload.
import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "../db";
import { books, userBooks } from "../schema";
import { periodRange } from "./library";

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
  timezone: string | null = null,
): Promise<FinishedBook[]> {
  // The same local year as the recap's monthly chart (views/library finishedSpread) and the year goal, so the count and
  // the chart agree for a finish late on Dec 31 or early on Jan 1.
  const { start, end } = periodRange("year", year, null, null, timezone);
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
