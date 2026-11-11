// Companion persistence: per-book conversation threads/messages, and the free-cached
// catalog generator output, and the daily usage quota. All companion data access goes through here.
import { reserveSettle } from "@dustinedwards/site-runtime/ai-caps";
import { and, desc, eq, sql } from "drizzle-orm";
import { quotaDay } from "../companion/quota";
import { COMPANION_QUOTA } from "../config/companion";
import type { Db } from "../db";
import { bookAiCache, companionMessages, companionThreads, companionUsage } from "../schema";

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

/**
 * Reserve one call against the reader's daily quota: `cents` (its worst case, companion.reserveCents) and one
 * request, only while the day is under both the cost ceiling and the request backstop. Check and reservation are one
 * conditional upsert: a D1 database "is inherently single-threaded, and processes queries one at a time"
 * (developers.cloudflare.com/d1/platform/limits/), and a SQLite statement is atomic, so parallel requests cannot all
 * pass on the same count. Returns the day reserved against, for settleUsage, or null when the quota is spent.
 */
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

/** Replace a reservation with the call's real cost, once it settles: `actualCents - reservedCents` added in place. */
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

/**
 * A reader's companion quota as site-runtime's reserveSettle: reserve the worst case (reserveUsage), run the call, settle
 * to its real cost (settleUsage). Null from the reserve is a spent quota; a call that throws keeps its reservation.
 */
export function companionQuota<T>(db: Db, userId: string, now: Date = new Date()) {
  return reserveSettle<T, string>({
    reserve: (cents) => reserveUsage(db, userId, cents, now),
    settle: (day, reserved, actual) => settleUsage(db, userId, day, reserved, actual),
  });
}
