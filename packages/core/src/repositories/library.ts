// Shelf state, custom shelves, reading goals and streaks, all user-scoped. Status writes go through domain/library.changeBookStatus, which also emits.
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import type { UserBookStatus } from "../enums";
import { books, customShelfBooks, customShelves, userBooks, vocabulary } from "../schema";
import type { SaveProgressInput } from "../validators/annotation";
import type { CreateShelfInput } from "../validators/library";

const bookRef = {
  title: books.title,
  author: books.author,
  slug: books.slug,
  coverUrl: books.coverUrl,
};

export type UserBook = typeof userBooks.$inferSelect;
export type CustomShelf = typeof customShelves.$inferSelect;

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

/** First write starts the book ('reading'); later writes update progress and never downgrade status. */
export async function upsertProgress(
  db: Db,
  userId: string,
  input: SaveProgressInput,
): Promise<UserBook> {
  const now = new Date();
  const existing = await getUserBook(db, userId, input.bookId);

  if (!existing) {
    const [row] = await db
      .insert(userBooks)
      .values({
        userId,
        bookId: input.bookId,
        status: "reading",
        progress: input.locator,
        progressPct: input.progressPct,
        startedAt: now,
      })
      .returning();
    return row;
  }

  const [row] = await db
    .update(userBooks)
    .set({
      progress: input.locator,
      progressPct: input.progressPct,
      status: existing.status === "want" ? "reading" : existing.status,
      updatedAt: now,
    })
    .where(and(eq(userBooks.userId, userId), eq(userBooks.bookId, input.bookId)))
    .returning();
  return row;
}

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

export async function listLibrary(
  db: Db,
  userId: string,
): Promise<(LibraryEntry & { finishedAt: Date | null })[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      status: userBooks.status,
      progressPct: userBooks.progressPct,
      updatedAt: userBooks.updatedAt,
      finishedAt: userBooks.finishedAt,
      ...bookRef,
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

export async function countFinishedBooks(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(userBooks)
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "finished")));
  return Number(row?.n ?? 0);
}

export async function countReaders(db: Db, bookId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(userBooks)
    .where(eq(userBooks.bookId, bookId));
  return Number(row?.n ?? 0);
}

export async function listFinishedBooks(db: Db, userId: string, limit = 8): Promise<ProfileBook[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      ...bookRef,
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
      ...bookRef,
    })
    .from(userBooks)
    .innerJoin(books, eq(userBooks.bookId, books.id))
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "reading")))
    .orderBy(desc(userBooks.updatedAt))
    .limit(limit);
}

export async function listOwnedBookIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ bookId: userBooks.bookId })
    .from(userBooks)
    .where(eq(userBooks.userId, userId));
  return rows.map((r) => r.bookId);
}

export interface ReadSignalBook {
  bookId: string;
  title: string;
  author: string;
  subjects: string[] | null;
}

export async function listFinishedForSignals(db: Db, userId: string): Promise<ReadSignalBook[]> {
  return db
    .select({
      bookId: userBooks.bookId,
      title: books.title,
      author: books.author,
      subjects: books.subjects,
    })
    .from(userBooks)
    .innerJoin(books, eq(books.id, userBooks.bookId))
    .where(and(eq(userBooks.userId, userId), eq(userBooks.status, "finished")));
}

export interface FinishedStatBook {
  finishedAt: Date | null;
  subjects: string[] | null;
}

export async function listFinishedInRangeForStats(
  db: Db,
  userId: string,
  startMs: number,
  endMs: number,
): Promise<FinishedStatBook[]> {
  return db
    .select({ finishedAt: userBooks.finishedAt, subjects: books.subjects })
    .from(userBooks)
    .innerJoin(books, eq(books.id, userBooks.bookId))
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.status, "finished"),
        sql`${userBooks.finishedAt} >= ${startMs} AND ${userBooks.finishedAt} < ${endMs}`,
      ),
    );
}

export type VocabularyEntry = typeof vocabulary.$inferSelect;

export async function countVocabularyToMaster(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.mastered, false)));
  return Number(row?.n ?? 0);
}

export async function countVocabulary(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId));
  return Number(row?.n ?? 0);
}

export async function listVocabulary(db: Db, userId: string): Promise<VocabularyEntry[]> {
  return db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .orderBy(desc(vocabulary.lookedUpAt))
    .limit(500);
}

export async function setVocabularyMastered(
  db: Db,
  userId: string,
  id: string,
  mastered: boolean,
): Promise<VocabularyEntry | null> {
  const [row] = await db
    .update(vocabulary)
    .set({ mastered, updatedAt: new Date() })
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, userId)))
    .returning();
  return row ?? null;
}

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
      ...bookRef,
    })
    .from(customShelfBooks)
    .innerJoin(books, eq(customShelfBooks.bookId, books.id))
    .where(eq(customShelfBooks.shelfId, shelfId))
    .orderBy(desc(customShelfBooks.addedAt));
}

export async function shelfIdsForBook(db: Db, userId: string, bookId: string): Promise<string[]> {
  const rows = await db
    .select({ shelfId: customShelfBooks.shelfId })
    .from(customShelfBooks)
    .innerJoin(customShelves, eq(customShelfBooks.shelfId, customShelves.id))
    .where(and(eq(customShelves.userId, userId), eq(customShelfBooks.bookId, bookId)));
  return rows.map((r) => r.shelfId);
}
