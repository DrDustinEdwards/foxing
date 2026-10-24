// Companion persistence: per-book conversation threads/messages, and the free-cached
// catalog generator output. All companion data access goes through here.
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { bookAiCache, companionMessages, companionThreads } from "../schema";

export type CompanionThread = typeof companionThreads.$inferSelect;
export type CompanionMessageRow = typeof companionMessages.$inferSelect;
export type BookAiCacheRow = typeof bookAiCache.$inferSelect;

/** The user's existing thread for a book, or null if none exists yet. */
export async function findThread(
  db: Db,
  userId: string,
  bookId: string,
): Promise<CompanionThread | null> {
  const rows = await db
    .select()
    .from(companionThreads)
    .where(and(eq(companionThreads.userId, userId), eq(companionThreads.bookId, bookId)))
    .orderBy(desc(companionThreads.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getThreadById(db: Db, id: string): Promise<CompanionThread | null> {
  const rows = await db.select().from(companionThreads).where(eq(companionThreads.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Find the user's thread for a book, or create one. One thread per (user, book). */
export async function getOrCreateThread(
  db: Db,
  userId: string,
  bookId: string,
  mode?: string,
): Promise<CompanionThread> {
  const existing = await findThread(db, userId, bookId);
  if (existing) return existing;
  const [row] = await db
    .insert(companionThreads)
    .values({ userId, bookId, mode: mode ?? null })
    .returning();
  return row;
}

/** Recent messages in a thread, oldest first, for context assembly. */
export async function listRecentMessages(
  db: Db,
  threadId: string,
  limit = 10,
): Promise<CompanionMessageRow[]> {
  const rows = await db
    .select()
    .from(companionMessages)
    .where(eq(companionMessages.threadId, threadId))
    // Two messages saved in the same millisecond tie on created_at, and the nanoid id is
    // random, so SQLite's rowid (insertion order) breaks the tie.
    .orderBy(desc(companionMessages.createdAt), desc(sql`rowid`))
    .limit(limit);
  return rows.reverse();
}

export async function appendMessage(
  db: Db,
  threadId: string,
  role: "user" | "assistant",
  content: string,
  action?: string,
): Promise<CompanionMessageRow> {
  const [row] = await db
    .insert(companionMessages)
    .values({ threadId, role, content, action: action ?? null })
    .returning();
  return row;
}

/** One cached, free-catalog-generator action's content for a book, if generated. */
export async function getCachedAction(
  db: Db,
  bookId: string,
  action: string,
): Promise<BookAiCacheRow | null> {
  const rows = await db
    .select()
    .from(bookAiCache)
    .where(and(eq(bookAiCache.bookId, bookId), eq(bookAiCache.action, action)))
    .limit(1);
  return rows[0] ?? null;
}

/** Every cached action generated for a book (used to assemble companion context). */
export async function listCachedActions(db: Db, bookId: string): Promise<BookAiCacheRow[]> {
  return db.select().from(bookAiCache).where(eq(bookAiCache.bookId, bookId));
}

export async function upsertCachedAction(
  db: Db,
  bookId: string,
  action: string,
  content: unknown,
  model: string,
): Promise<void> {
  await db
    .insert(bookAiCache)
    .values({ bookId, action, content, model, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: [bookAiCache.bookId, bookAiCache.action],
      set: { content, model, generatedAt: new Date() },
    });
}
