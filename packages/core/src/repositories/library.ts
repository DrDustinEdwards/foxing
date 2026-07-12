// Library repository: shelf state (user_books), custom shelves, reading goals,
// and streak reads. All queries are user-scoped. Status writes go through
// domain/library.changeBookStatus (which also emits); this module is data access.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import type { UserBookStatus } from "../enums";
import {
  books,
  customShelfBooks,
  customShelves,
  readingGoals,
  readingStreaks,
  userBooks,
  userFavorites,
  vocabulary,
} from "../schema";
import type { CreateGoalInput, CreateShelfInput, UpdateGoalInput } from "../validators/library";

export type UserBook = typeof userBooks.$inferSelect;
export type CustomShelf = typeof customShelves.$inferSelect;
export type ReadingGoal = typeof readingGoals.$inferSelect;
export type ReadingStreak = typeof readingStreaks.$inferSelect;

export interface LibraryEntry {
  bookId: string;
  status: string;
  progressPct: number;
  updatedAt: Date;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}

export async function getUserBook(
  db: Db,
  userId: string,
  bookId: string,
): Promise<UserBook | null> {
  const rows = await db
    .select()
    .from(userBooks)
    .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Timestamp to set for a status transition (others are left untouched). */
function statusTimestamp(status: UserBookStatus, now: Date): Partial<UserBook> {
  switch (status) {
    case "finished":
      return { finishedAt: now };
    case "paused":
      return { pausedAt: now };
    case "abandoned":
      return { abandonedAt: now };
    default:
      return {};
  }
}

/** Upsert the shelf status, keyed on (user, book). Sets started_at on the first
 *  reading/finished transition and the status-specific timestamp. Data only; the
 *  domain layer emits events. */
export async function upsertStatus(
  db: Db,
  userId: string,
  bookId: string,
  status: UserBookStatus,
): Promise<{ row: UserBook; wasFinished: boolean }> {
  const now = new Date();
  const existing = await getUserBook(db, userId, bookId);
  const startsReading = status === "reading" || status === "finished";

  if (!existing) {
    const [row] = await db
      .insert(userBooks)
      .values({
        userId,
        bookId,
        status,
        startedAt: startsReading ? now : null,
        ...statusTimestamp(status, now),
      })
      .returning();
    return { row, wasFinished: false };
  }

  const [row] = await db
    .update(userBooks)
    .set({
      status,
      startedAt: existing.startedAt ?? (startsReading ? now : null),
      ...statusTimestamp(status, now),
      updatedAt: now,
    })
    .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
    .returning();
  return { row, wasFinished: existing.status === "finished" };
}

export async function removeFromLibrary(db: Db, userId: string, bookId: string): Promise<boolean> {
  const rows = await db
    .delete(userBooks)
    .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)))
    .returning({ id: userBooks.id });
  return rows.length > 0;
}

export async function listLibrary(db: Db, userId: string): Promise<LibraryEntry[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      status: userBooks.status,
      progressPct: userBooks.progressPct,
      updatedAt: userBooks.updatedAt,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .where(eq(userBooks.userId, userId))
    .orderBy(desc(userBooks.updatedAt));
}

export interface ProfileBook {
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}

/** Count of finished books. Powers the profile "Books read" stat tile. */
export async function countFinishedBooks(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(userBooks)
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "finished")));
  return Number(row?.n ?? 0);
}

/** The user's favorite books (user_favorites), ordered, for the profile cover row. */
export async function listFavoriteBooks(
  db: Db,
  userId: string,
  limit = 5,
): Promise<ProfileBook[]> {
  return db
    .select({
      bookId: userFavorites.bookId,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
    })
    .from(userFavorites)
    .innerJoin(books, eq(userFavorites.bookId, books.id))
    .where(eq(userFavorites.userId, userId))
    .orderBy(asc(userFavorites.position))
    .limit(limit);
}

/** Recently finished books, newest first, for the public profile library preview. */
export async function listFinishedBooks(
  db: Db,
  userId: string,
  limit = 8,
): Promise<ProfileBook[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "finished")))
    .orderBy(desc(userBooks.updatedAt))
    .limit(limit);
}

export interface PublicShelf {
  id: string;
  name: string;
  bookCount: number;
}

/** Public custom shelves with book counts, for the profile shelves grid. */
export async function listPublicShelves(db: Db, userId: string): Promise<PublicShelf[]> {
  const rows = await db
    .select({
      id: customShelves.id,
      name: customShelves.name,
      bookCount: sql<number>`count(${customShelfBooks.bookId})`,
    })
    .from(customShelves)
    .leftJoin(customShelfBooks, eq(customShelfBooks.shelfId, customShelves.id))
    .where(and(eq(customShelves.userId, userId), eq(customShelves.isPublic, true)))
    .groupBy(customShelves.id);
  return rows.map((r) => ({ id: r.id, name: r.name, bookCount: Number(r.bookCount) }));
}

/** Currently-reading books for a user, newest activity first. Powers the profile
 *  "currently reading" strip; the caller decides whether progress visibility allows it. */
export async function listCurrentlyReading(
  db: Db,
  userId: string,
  limit = 6,
): Promise<LibraryEntry[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      status: userBooks.status,
      progressPct: userBooks.progressPct,
      updatedAt: userBooks.updatedAt,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "reading")))
    .orderBy(desc(userBooks.updatedAt))
    .limit(limit);
}

// --- Vocabulary ------------------------------------------------------------

export type VocabularyEntry = typeof vocabulary.$inferSelect;

/** Count of words not yet mastered. Powers the account menu "N words to master" line. */
export async function countVocabularyToMaster(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.mastered, false)));
  return Number(row?.n ?? 0);
}

/** A user's saved words, newest first. Backs the /vocabulary page. */
export async function listVocabulary(db: Db, userId: string): Promise<VocabularyEntry[]> {
  return db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .orderBy(desc(vocabulary.lookedUpAt))
    .limit(500);
}

// --- Custom shelves --------------------------------------------------------

export async function listShelves(db: Db, userId: string): Promise<CustomShelf[]> {
  return db
    .select()
    .from(customShelves)
    .where(eq(customShelves.userId, userId))
    .orderBy(customShelves.position, desc(customShelves.createdAt));
}

export async function createShelf(
  db: Db,
  userId: string,
  input: CreateShelfInput,
): Promise<CustomShelf> {
  const [row] = await db
    .insert(customShelves)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? false,
    })
    .returning();
  return row;
}

/** Delete a shelf the caller owns. Returns false if it is not theirs. */
export async function deleteShelf(db: Db, userId: string, shelfId: string): Promise<boolean> {
  const rows = await db
    .delete(customShelves)
    .where(and(eq(customShelves.id, shelfId), eq(customShelves.userId, userId)))
    .returning({ id: customShelves.id });
  return rows.length > 0;
}

async function ownsShelf(db: Db, userId: string, shelfId: string): Promise<boolean> {
  const rows = await db
    .select({ id: customShelves.id })
    .from(customShelves)
    .where(and(eq(customShelves.id, shelfId), eq(customShelves.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function addBookToShelf(
  db: Db,
  userId: string,
  shelfId: string,
  bookId: string,
): Promise<boolean> {
  if (!(await ownsShelf(db, userId, shelfId))) return false;
  await db
    .insert(customShelfBooks)
    .values({ shelfId, bookId, addedAt: new Date() })
    .onConflictDoNothing();
  return true;
}

export async function removeBookFromShelf(
  db: Db,
  userId: string,
  shelfId: string,
  bookId: string,
): Promise<boolean> {
  if (!(await ownsShelf(db, userId, shelfId))) return false;
  await db
    .delete(customShelfBooks)
    .where(and(eq(customShelfBooks.shelfId, shelfId), eq(customShelfBooks.bookId, bookId)));
  return true;
}

export async function listShelfBooks(
  db: Db,
  userId: string,
  shelfId: string,
): Promise<LibraryEntry[]> {
  if (!(await ownsShelf(db, userId, shelfId))) return [];
  return db
    .select({
      bookId: customShelfBooks.bookId,
      status: sql<string>`'shelf'`,
      progressPct: sql<number>`0`,
      updatedAt: customShelfBooks.addedAt,
      title: books.title,
      author: books.author,
      slug: books.slug,
      coverUrl: books.coverUrl,
    })
    .from(customShelfBooks)
    .innerJoin(books, eq(customShelfBooks.bookId, books.id))
    .where(eq(customShelfBooks.shelfId, shelfId))
    .orderBy(desc(customShelfBooks.addedAt));
}

/** Shelf ids (owned by the user) that contain the given book. For the book-page picker. */
export async function shelfIdsForBook(db: Db, userId: string, bookId: string): Promise<string[]> {
  const rows = await db
    .select({ shelfId: customShelfBooks.shelfId })
    .from(customShelfBooks)
    .innerJoin(customShelves, eq(customShelfBooks.shelfId, customShelves.id))
    .where(and(eq(customShelves.userId, userId), eq(customShelfBooks.bookId, bookId)));
  return rows.map((r) => r.shelfId);
}

// --- Reading goals ---------------------------------------------------------

export async function createGoal(
  db: Db,
  userId: string,
  input: CreateGoalInput,
): Promise<ReadingGoal> {
  const [row] = await db
    .insert(readingGoals)
    .values({
      userId,
      type: input.type,
      target: input.target,
      periodType: input.periodType,
      year: input.year,
      month: input.month ?? null,
      week: input.week ?? null,
    })
    .returning();
  return row;
}

/** Retarget a goal the caller owns. Returns the updated row, or null if not theirs. */
export async function updateGoal(
  db: Db,
  userId: string,
  goalId: string,
  patch: UpdateGoalInput,
): Promise<ReadingGoal | null> {
  const [row] = await db
    .update(readingGoals)
    .set({ target: patch.target, ...(patch.type ? { type: patch.type } : {}) })
    .where(and(eq(readingGoals.id, goalId), eq(readingGoals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteGoal(db: Db, userId: string, goalId: string): Promise<boolean> {
  const rows = await db
    .delete(readingGoals)
    .where(and(eq(readingGoals.id, goalId), eq(readingGoals.userId, userId)))
    .returning({ id: readingGoals.id });
  return rows.length > 0;
}

export async function listGoals(db: Db, userId: string): Promise<ReadingGoal[]> {
  return db
    .select()
    .from(readingGoals)
    .where(eq(readingGoals.userId, userId))
    .orderBy(desc(readingGoals.year));
}

/** Half-open [start, end) date range for a goal period. */
export function periodRange(
  periodType: string,
  year: number,
  month?: number | null,
  week?: number | null,
): { start: Date; end: Date } {
  if (periodType === "month" && month) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end };
  }
  if (periodType === "week" && week) {
    // ISO week: week 1 contains the year's first Thursday; weeks start Monday.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0 = Monday
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
  }
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

/** Books the user finished within a goal's period (books-type goal progress). */
export async function countFinishedInPeriod(
  db: Db,
  userId: string,
  goal: { periodType: string; year: number; month?: number | null; week?: number | null },
): Promise<number> {
  const { start, end } = periodRange(goal.periodType, goal.year, goal.month, goal.week);
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userBooks)
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.status, "finished"),
        sql`${userBooks.finishedAt} >= ${start.getTime()} AND ${userBooks.finishedAt} < ${end.getTime()}`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

// --- Streaks ---------------------------------------------------------------

export async function getStreak(db: Db, userId: string): Promise<ReadingStreak | null> {
  const rows = await db
    .select()
    .from(readingStreaks)
    .where(eq(readingStreaks.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Bump total_books_finished on a fresh finish (upserting the streak row). */
export async function incrementBooksFinished(db: Db, userId: string): Promise<void> {
  const now = new Date();
  const existing = await getStreak(db, userId);
  if (!existing) {
    await db.insert(readingStreaks).values({ userId, totalBooksFinished: 1, updatedAt: now });
    return;
  }
  await db
    .update(readingStreaks)
    .set({ totalBooksFinished: existing.totalBooksFinished + 1, updatedAt: now })
    .where(eq(readingStreaks.userId, userId));
}
