import type { Db } from "../db";
import { bookOfTheMonth, books, clubs, externalBookClubPicks, externalBookClubs } from "../schema";
import { desc, eq, like, or } from "drizzle-orm";

// ---- Books --------------------------------------------------------------------

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  slug: string;
  sourceType: string;
  isStaffPick: boolean;
  publicationYear: number | null;
};

export async function listBooksAdmin(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminBookRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      slug: books.slug,
      sourceType: books.sourceType,
      isStaffPick: books.isStaffPick,
      publicationYear: books.publicationYear,
    })
    .from(books)
    .where(q ? or(like(books.title, `%${q}%`), like(books.author, `%${q}%`)) : undefined)
    .orderBy(desc(books.updatedAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
}

export type BookMetaPatch = {
  title?: string;
  author?: string;
  description?: string | null;
  publicationYear?: number | null;
  publisher?: string | null;
  subjects?: string[] | null;
};

export async function updateBookAdmin(db: Db, id: string, patch: BookMetaPatch): Promise<void> {
  await db
    .update(books)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(books.id, id));
}

export async function setBookStaffPick(
  db: Db,
  id: string,
  on: boolean,
  note?: string | null,
): Promise<void> {
  await db
    .update(books)
    .set({ isStaffPick: on, staffPickNote: note ?? null, updatedAt: new Date() })
    .where(eq(books.id, id));
}

// ---- Book of the Month --------------------------------------------------------

export type AdminBotmRow = typeof bookOfTheMonth.$inferSelect & {
  bookTitle: string | null;
  bookAuthor: string | null;
};

export async function listBotmAdmin(db: Db): Promise<AdminBotmRow[]> {
  const rows = await db
    .select({
      row: bookOfTheMonth,
      bookTitle: books.title,
      bookAuthor: books.author,
    })
    .from(bookOfTheMonth)
    .leftJoin(books, eq(bookOfTheMonth.bookId, books.id))
    .orderBy(desc(bookOfTheMonth.year), desc(bookOfTheMonth.month));
  return rows.map((r) => ({ ...r.row, bookTitle: r.bookTitle, bookAuthor: r.bookAuthor }));
}

export async function getBotm(db: Db, id: string) {
  const [row] = await db.select().from(bookOfTheMonth).where(eq(bookOfTheMonth.id, id)).limit(1);
  return row ?? null;
}

export type BotmInput = {
  bookId?: string | null;
  year: number;
  month: number;
  category?: string | null;
  curatorNote?: string | null;
  amazonUrl?: string | null;
  bookshopUrl?: string | null;
  isPublished?: boolean;
};

export async function createBotm(db: Db, input: BotmInput): Promise<string> {
  const [row] = await db
    .insert(bookOfTheMonth)
    .values({ ...input, isPublished: input.isPublished ?? false })
    .returning({ id: bookOfTheMonth.id });
  return row.id;
}

export async function updateBotm(db: Db, id: string, input: Partial<BotmInput>): Promise<void> {
  await db.update(bookOfTheMonth).set(input).where(eq(bookOfTheMonth.id, id));
}

export async function setBotmPublished(db: Db, id: string, on: boolean): Promise<void> {
  await db.update(bookOfTheMonth).set({ isPublished: on }).where(eq(bookOfTheMonth.id, id));
}

export async function deleteBotm(db: Db, id: string): Promise<void> {
  await db.delete(bookOfTheMonth).where(eq(bookOfTheMonth.id, id));
}

// ---- Celebrity picks (external clubs) -----------------------------------------

export async function listPickClubsAdmin(db: Db) {
  return db.select().from(externalBookClubs).orderBy(externalBookClubs.sortOrder);
}

export type AdminPickRow = typeof externalBookClubPicks.$inferSelect & {
  clubName: string | null;
  bookTitle: string | null;
};

export async function listPicksAdmin(db: Db, clubId?: string): Promise<AdminPickRow[]> {
  const rows = await db
    .select({
      row: externalBookClubPicks,
      clubName: externalBookClubs.name,
      bookTitle: books.title,
    })
    .from(externalBookClubPicks)
    .leftJoin(externalBookClubs, eq(externalBookClubPicks.clubId, externalBookClubs.id))
    .leftJoin(books, eq(externalBookClubPicks.bookId, books.id))
    .where(clubId ? eq(externalBookClubPicks.clubId, clubId) : undefined)
    .orderBy(desc(externalBookClubPicks.pickYear), desc(externalBookClubPicks.pickMonth))
    .limit(200);
  return rows.map((r) => ({ ...r.row, clubName: r.clubName, bookTitle: r.bookTitle }));
}

export async function setPickPublished(db: Db, id: string, on: boolean): Promise<void> {
  await db
    .update(externalBookClubPicks)
    .set({ isPublished: on, updatedAt: new Date() })
    .where(eq(externalBookClubPicks.id, id));
}

export async function updatePick(
  db: Db,
  id: string,
  patch: { notes?: string | null; curatorQuote?: string | null; category?: string | null },
): Promise<void> {
  await db
    .update(externalBookClubPicks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(externalBookClubPicks.id, id));
}

// ---- Reader clubs ---------------------------------------------------

export type AdminClubRow = {
  id: string;
  name: string;
  slug: string | null;
  visibility: string;
  isVerified: boolean;
  createdAt: Date;
};

export async function listClubsAdmin(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminClubRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      visibility: clubs.visibility,
      isVerified: clubs.isVerified,
      createdAt: clubs.createdAt,
    })
    .from(clubs)
    .where(q ? like(clubs.name, `%${q}%`) : undefined)
    .orderBy(desc(clubs.createdAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
}

export async function setClubVerified(
  db: Db,
  id: string,
  on: boolean,
  adminId: string,
): Promise<void> {
  await db
    .update(clubs)
    .set({
      isVerified: on,
      verifiedAt: on ? new Date() : null,
      verifiedBy: on ? adminId : null,
      updatedAt: new Date(),
    })
    .where(eq(clubs.id, id));
}

/** Hard-delete a club. Members, threads, posts, polls, and meetings cascade from the
 *  clubs FK (onDelete: cascade). Operator moderation action. */
export async function deleteClubAdmin(db: Db, id: string): Promise<void> {
  await db.delete(clubs).where(eq(clubs.id, id));
}
