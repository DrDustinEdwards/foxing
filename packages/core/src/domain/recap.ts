// Year in Reading recap. Aggregates a user's finishes for a calendar year
// into a shareable payload: counts, top books (by the user's own rating), and stats.
// The public variant is visibility-gated at the route (profile must be public). The OG
// image renders from this same payload.
import type { Db } from "../db";
import * as diaryRepo from "../repositories/diary";
import * as recapRepo from "../repositories/recap";

export type RecapBook = {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  ratingHalf: number | null;
};

export type Recap = {
  year: number;
  booksFinished: number;
  totalWords: number;
  distinctAuthors: number;
  averageRating: number | null; // in stars (0-5), over rated finishes
  topBooks: RecapBook[]; // highest-rated finishes, up to 5
  finished: RecapBook[]; // all finishes, oldest first
};

export async function getRecap(
  db: Db,
  userId: string,
  year: number,
  timezone: string | null = null,
): Promise<Recap> {
  const finishedRows = await recapRepo.listFinishedInYear(db, userId, year, timezone);

  // Overlay each finish with the user's latest rating for that book, all in one query.
  const ratings = await diaryRepo.latestRatingsForBooks(
    db,
    userId,
    finishedRows.map((b) => b.bookId),
  );
  const withRatings: RecapBook[] = finishedRows.map((b) => ({
    bookId: b.bookId,
    title: b.title,
    author: b.author,
    slug: b.slug,
    coverUrl: b.coverUrl,
    ratingHalf: ratings.get(b.bookId) ?? null,
  }));

  const rated = withRatings.filter((b) => b.ratingHalf != null);
  const averageRating =
    rated.length === 0
      ? null
      : rated.reduce((s, b) => s + (b.ratingHalf as number), 0) / rated.length / 2;

  const topBooks = [...rated]
    .sort((a, b) => (b.ratingHalf as number) - (a.ratingHalf as number))
    .slice(0, 5);

  return {
    year,
    booksFinished: finishedRows.length,
    totalWords: finishedRows.reduce((s, b) => s + (b.wordCount ?? 0), 0),
    distinctAuthors: new Set(finishedRows.map((b) => b.author)).size,
    averageRating,
    topBooks,
    finished: withRatings,
  };
}
