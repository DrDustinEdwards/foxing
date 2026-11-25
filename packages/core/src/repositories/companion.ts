import { reserveSettle } from "@dustinedwards/site-runtime/ai-caps";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { quotaDay } from "../companion/quota";
import { COMPANION_QUOTA } from "../config/companion";
import type { Db } from "../db";
import { bookAiCache, books, companionMessages, companionThreads, companionUsage } from "../schema";

export type CompanionThread = typeof companionThreads.$inferSelect;
export type CompanionMessageRow = typeof companionMessages.$inferSelect;
export type BookAiCacheRow = typeof bookAiCache.$inferSelect;

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
    .onConflictDoNothing()
    .returning();
  // A concurrent first message created it (unique user, book): use that thread.
  return row ?? (await findThread(db, userId, bookId))!;
}

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

/**
 * Record one fact-check on the cached text. A correction (`next` a string, blank for a withheld text) replaces the
 * text and keeps the old one in `original`; `next` null leaves the text as it was.
 */
export async function saveFactCheck(
  db: Db,
  r: {
    bookId: string;
    action: string;
    verdict: string;
    issues: string[];
    original: unknown;
    next: string | null;
    costMicros: number;
    model: string;
  },
): Promise<void> {
  const now = new Date();
  await db
    .update(bookAiCache)
    .set({
      ...(r.next === null ? {} : { content: r.next, model: r.model, generatedAt: now }),
      verdict: r.verdict,
      issues: r.issues,
      original: r.original,
      costMicros: r.costMicros,
      checkedAt: now,
    })
    .where(and(eq(bookAiCache.bookId, r.bookId), eq(bookAiCache.action, r.action)));
}

export async function findBooksNeedingFactCheck(db: Db, limit: number, only?: string[]) {
  return db
    .select()
    .from(books)
    .where(
      and(
        eq(books.sourceType, "catalog"),
        sql`EXISTS (SELECT 1 FROM book_ai_cache WHERE book_ai_cache.book_id = ${books.id} AND book_ai_cache.checked_at IS NULL)`,
        only ? inArray(books.id, only) : undefined,
      ),
    )
    .orderBy(asc(books.id))
    .limit(limit);
}

/** Reserve one call against the daily quota (`cents` worst case plus one request) only while under the cost ceiling and request backstop. Check and reservation are one conditional upsert (statements are atomic), so parallel requests cannot all pass on the same count. Returns the day reserved, for settleUsage, or null when spent. */
export async function reserveUsage(
  db: Db,
  userId: string,
  cents: number,
  now: Date = new Date(),
): Promise<string | null> {
  const day = quotaDay(now);
  const result = await db
    .insert(companionUsage)
    .values({ userId, day, costCents: cents, requests: 1 })
    .onConflictDoUpdate({
      target: [companionUsage.userId, companionUsage.day],
      set: {
        costCents: sql`${companionUsage.costCents} + ${cents}`,
        requests: sql`${companionUsage.requests} + 1`,
      },
      setWhere: sql`${companionUsage.costCents} < ${COMPANION_QUOTA.dailyCostCeilingCents} AND ${companionUsage.requests} < ${COMPANION_QUOTA.dailyRequestBackstop}`,
    })
    .run();
  // A skipped DO UPDATE changes no row (no trigger on this table can inflate the count).
  return result.meta.changes > 0 ? day : null;
}

export async function settleUsage(
  db: Db,
  userId: string,
  day: string,
  reservedCents: number,
  actualCents: number,
): Promise<void> {
  await db
    .update(companionUsage)
    .set({ costCents: sql`max(0, ${companionUsage.costCents} + ${actualCents - reservedCents})` })
    .where(and(eq(companionUsage.userId, userId), eq(companionUsage.day, day)));
}

/** The quota as site-runtime's reserveSettle; a call that throws keeps its reservation. */
export function companionQuota<T>(db: Db, userId: string, now: Date = new Date()) {
  return reserveSettle<T, string>({
    reserve: (cents) => reserveUsage(db, userId, cents, now),
    settle: (day, reserved, actual) => settleUsage(db, userId, day, reserved, actual),
  });
}
