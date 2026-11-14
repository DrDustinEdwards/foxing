// Notifications read/mark data access. Notifications are WRITTEN only by the
// core event emitter; this repo is the read + mark-read surface the mobile client and
// in-app UI use. Push delivery of these is gated in domain/push.ts.
import { olderThan } from "@dustinedwards/site-runtime/d1";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import { notifications } from "../schema";

export type Notification = typeof notifications.$inferSelect;

export async function listForUser(
  db: Db,
  userId: string,
  opts: { cursor?: { at: number; id: string } | null; limit?: number; type?: string } = {},
): Promise<Notification[]> {
  const limit = Math.min(opts.limit ?? 40, 100);
  const conds = [eq(notifications.userId, userId)];
  if (opts.type) conds.push(eq(notifications.type, opts.type));
  if (opts.cursor)
    conds.push(
      olderThan(
        notifications.createdAt,
        notifications.id,
        new Date(opts.cursor.at),
        opts.cursor.id,
      ),
    );
  return db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return row?.n ?? 0;
}

export async function markRead(db: Db, userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

/** All notifications created at/after a cutoff, across users. Drives the push delivery
 *  sweep; the sweep dedupes already-pushed ids via KV. */
export async function listCreatedSince(db: Db, sinceMs: number): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(gt(notifications.createdAt, new Date(sinceMs)))
    .orderBy(desc(notifications.createdAt))
    .limit(500);
}
