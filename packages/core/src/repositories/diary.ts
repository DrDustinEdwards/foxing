// Diary / reviews data access. diary_entries is the single home for ratings
// and reviews (Letterboxd model: one entry per read-through, re-reads free). Book and
// profile ratings derive from the LATEST entry per (user, book). Pure DB access; event
// emission + authorization live in domain/diary.ts.
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db";
import { books, diaryEntries } from "../schema";

export type DiaryEntry = typeof diaryEntries.$inferSelect;

function slugify(bookTitle: string): string {
  const base = bookTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "entry"}-${nanoid(6).toLowerCase()}`;
}

export async function createEntry(
  db: Db,
  userId: string,
  input: {
    bookId: string;
    logDate?: number;
    ratingHalf?: number | null;
    review?: string | null;
    containsSpoilers?: boolean;
    visibility?: string;
    bookTitle: string;
  },
): Promise<DiaryEntry> {
  const [row] = await db
    .insert(diaryEntries)
    .values({
      userId,
      bookId: input.bookId,
      logDate: input.logDate ? new Date(input.logDate) : new Date(),
      ratingHalf: input.ratingHalf ?? null,
      review: input.review ?? null,
      containsSpoilers: input.containsSpoilers ?? false,
      visibility: input.visibility ?? "private",
      slug: slugify(input.bookTitle),
    })
    .returning();
  return row;
}

export async function updateEntry(
  db: Db,
  entryId: string,
  patch: {
    logDate?: number;
    ratingHalf?: number | null;
    review?: string | null;
    containsSpoilers?: boolean;
    visibility?: string;
  },
): Promise<DiaryEntry | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.logDate !== undefined) set.logDate = new Date(patch.logDate);
  if (patch.ratingHalf !== undefined) set.ratingHalf = patch.ratingHalf;
  if (patch.review !== undefined) set.review = patch.review;
  if (patch.containsSpoilers !== undefined) set.containsSpoilers = patch.containsSpoilers;
  if (patch.visibility !== undefined) set.visibility = patch.visibility;
  const [row] = await db
    .update(diaryEntries)
    .set(set)
    .where(eq(diaryEntries.id, entryId))
    .returning();
  return row ?? null;
}

export async function deleteEntry(db: Db, entryId: string): Promise<void> {
  await db.delete(diaryEntries).where(eq(diaryEntries.id, entryId));
}

export async function getEntryById(db: Db, entryId: string): Promise<DiaryEntry | null> {
  const [row] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, entryId)).limit(1);
  return row ?? null;
}

/** A user's diary, newest-logged first, restricted to the visibilities the viewer may
 *  see (owner passes all three; a stranger passes ['public']). */
export async function listEntriesForUser(
  db: Db,
  userId: string,
  allowedVisibilities: string[],
  opts: { limit?: number } = {},
): Promise<DiaryEntry[]> {
  if (allowedVisibilities.length === 0) return [];
  const rows = await db
    .select()
    .from(diaryEntries)
    .where(eq(diaryEntries.userId, userId))
    .orderBy(desc(diaryEntries.logDate))
    .limit(Math.min(opts.limit ?? 50, 100));
  return rows.filter((r) => allowedVisibilities.includes(r.visibility));
}

export interface RatedSignalBook {
  bookId: string;
  title: string;
  author: string;
  subjects: string[] | null;
  ratingHalf: number | null;
}

/** Rated diary entries with the book's author + subjects, for the recommender's
 *  behaviour signals ("because you rated X highly"). */
export async function listRatedForSignals(db: Db, userId: string): Promise<RatedSignalBook[]> {
  return db
    .select({
      bookId: diaryEntries.bookId,
      title: books.title,
      author: books.author,
      subjects: books.subjects,
      ratingHalf: diaryEntries.ratingHalf,
    })
    .from(diaryEntries)
    .innerJoin(books, eq(books.id, diaryEntries.bookId))
    .where(and(eq(diaryEntries.userId, userId), isNotNull(diaryEntries.ratingHalf)));
}

/** The latest entry for a (user, book) pair. Drives the profile/book-page rating. */
export async function latestEntryForBook(
  db: Db,
  userId: string,
  bookId: string,
): Promise<DiaryEntry | null> {
  const [row] = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.bookId, bookId)))
    .orderBy(desc(diaryEntries.logDate), desc(diaryEntries.updatedAt))
    .limit(1);
  return row ?? null;
}

// -- Book rating aggregate --------------------------------------------------
// Recomputed in core after every diary write (spec-cf-schema: "rating aggregates
// recomputed from diary_entries by core, not triggers"). The aggregate takes each
// user's LATEST rated entry for the book and averages rating_half. weighted_rating is
// stored in stars (rating_half / 2); rating_count is the number of distinct raters.
// Ratings are anonymous, so all visibilities count toward the average (only the review
// TEXT is visibility-gated, never the numeric rating). Fine at current scale; move to a
// windowed SQL query if a book ever accrues enough entries to make this hot.
export async function recomputeBookRating(db: Db, bookId: string): Promise<void> {
  const rated = await db
    .select({
      userId: diaryEntries.userId,
      ratingHalf: diaryEntries.ratingHalf,
      logDate: diaryEntries.logDate,
      updatedAt: diaryEntries.updatedAt,
    })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.bookId, bookId), isNotNull(diaryEntries.ratingHalf)));

  const latestByUser = new Map<string, { ratingHalf: number; ts: number }>();
  for (const r of rated) {
    if (r.ratingHalf == null) continue;
    const ts = (r.logDate?.getTime() ?? 0) * 1e6 + (r.updatedAt?.getTime() ?? 0);
    const prev = latestByUser.get(r.userId);
    if (!prev || ts > prev.ts) latestByUser.set(r.userId, { ratingHalf: r.ratingHalf, ts });
  }

  const count = latestByUser.size;
  const avgStars =
    count === 0
      ? null
      : [...latestByUser.values()].reduce((s, v) => s + v.ratingHalf, 0) / count / 2;

  await db
    .update(books)
    .set({ weightedRating: avgStars, ratingCount: count })
    .where(eq(books.id, bookId));
}
