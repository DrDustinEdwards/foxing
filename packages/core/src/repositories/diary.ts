// diary_entries is the single home for ratings and reviews (one entry per read-through, re-reads free); book and profile ratings
// derive from the LATEST entry per (user, book). Events and authorization are in domain/diary.ts.
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { type Db, inList } from "../db";
import { uniqueSlug } from "@drdustinedwards/site-helpers/slug";
import { books, diaryEntries } from "../schema";

export type DiaryEntry = typeof diaryEntries.$inferSelect;

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
      slug: await uniqueSlug(input.bookTitle, { fallback: "entry" }),
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
    .where(
      and(eq(diaryEntries.userId, userId), inArray(diaryEntries.visibility, allowedVisibilities)),
    )
    .orderBy(desc(diaryEntries.logDate), desc(diaryEntries.id))
    .limit(Math.min(opts.limit ?? 50, 100));
  // The visibility filter is in the query, so a stranger gets a full page of public entries rather than the
  // public ones among the newest 50.
  return rows;
}

export async function listPublicReviewsForBook(
  db: Db,
  bookId: string,
  limit = 3,
): Promise<DiaryEntry[]> {
  return db
    .select()
    .from(diaryEntries)
    .where(
      and(
        eq(diaryEntries.bookId, bookId),
        eq(diaryEntries.visibility, "public"),
        isNotNull(diaryEntries.review),
      ),
    )
    .orderBy(desc(diaryEntries.logDate))
    .limit(limit);
}

export interface RatedSignalBook {
  bookId: string;
  title: string;
  author: string;
  subjects: string[] | null;
  ratingHalf: number | null;
}

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

/** Latest rating per book id in one query (same "latest" as latestEntryForBook); a book with no entry is absent. */
export async function latestRatingsForBooks(
  db: Db,
  userId: string,
  bookIds: readonly string[],
): Promise<Map<string, number | null>> {
  const latest = new Map<string, number | null>();
  if (bookIds.length === 0) return latest;
  const rows = await db
    .select({ bookId: diaryEntries.bookId, ratingHalf: diaryEntries.ratingHalf })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), inList(diaryEntries.bookId, bookIds)))
    .orderBy(desc(diaryEntries.logDate), desc(diaryEntries.updatedAt));
  for (const r of rows) if (!latest.has(r.bookId)) latest.set(r.bookId, r.ratingHalf ?? null);
  return latest;
}

// Recomputed in core after every diary write (not by triggers): each user's LATEST rated entry averages into weighted_rating (stars,
// rating_half / 2); rating_count is distinct raters. Ratings are anonymous, so all visibilities count; only review TEXT is visibility-gated.
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

  // Latest = the newest log date, then the newest edit. Compared as a pair: folding both into one number
  // (logDate * 1e6 + updatedAt) passed 2^53 and lost the tie-break.
  const latestByUser = new Map<string, { ratingHalf: number; logged: number; edited: number }>();
  for (const r of rated) {
    if (r.ratingHalf == null) continue;
    const logged = r.logDate?.getTime() ?? 0;
    const edited = r.updatedAt?.getTime() ?? 0;
    const prev = latestByUser.get(r.userId);
    if (!prev || logged > prev.logged || (logged === prev.logged && edited > prev.edited))
      latestByUser.set(r.userId, { ratingHalf: r.ratingHalf, logged, edited });
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
