// Social data access (Phase 6): follows, close_friends, reading_lists +
// reading_list_books, and the activity_events feed query. Pure DB reads/writes; no
// authorization and no event emission (those live in domain/social.ts). Reads run
// in-process from web/mobile loaders; writes are called by the API after the domain
// layer authorized them.
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db";
import {
  activityEvents,
  books,
  closeFriends,
  follows,
  notifications,
  readingListBooks,
  readingLists,
} from "../schema";

export type ReadingList = typeof readingLists.$inferSelect;
export type ReadingListBook = typeof readingListBooks.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type FollowerNotification = typeof notifications.$inferSelect;

// -- Follows ----------------------------------------------------------------

/** Idempotent follow. Returns true if a new edge was created. */
export async function follow(db: Db, followerId: string, followingId: string): Promise<void> {
  await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
}

export async function unfollow(db: Db, followerId: string, followingId: string): Promise<void> {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
}

export async function isFollowing(
  db: Db,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ x: sql<number>`1` })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return !!row;
}

/** ids of the users this user follows. */
export async function listFollowingIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return rows.map((r) => r.id);
}

/** ids of the users who follow this user. */
export async function listFollowerIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return rows.map((r) => r.id);
}

export async function countFollowers(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return row?.n ?? 0;
}

export async function countFollowing(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return row?.n ?? 0;
}

// -- Close friends ----------------------------------------------------------
// close_friends is a one-directional list the owner (user_id) curates. friend_id is
// the person granted the owner's friends-only content. It is NOT symmetric and NOT
// the same graph as follows.

export async function addCloseFriend(db: Db, userId: string, friendId: string): Promise<void> {
  await db.insert(closeFriends).values({ userId, friendId }).onConflictDoNothing();
}

export async function removeCloseFriend(db: Db, userId: string, friendId: string): Promise<void> {
  await db
    .delete(closeFriends)
    .where(and(eq(closeFriends.userId, userId), eq(closeFriends.friendId, friendId)));
}

/** friend_ids the given user has added to their close-friends list. */
export async function listCloseFriendIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: closeFriends.friendId })
    .from(closeFriends)
    .where(eq(closeFriends.userId, userId));
  return rows.map((r) => r.id);
}

/** user_ids of the people whose close-friends list CONTAINS the given viewer. These are
 *  the authors whose friends-only events the viewer is entitled to see. */
export async function listCloseFriendOfIds(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: closeFriends.userId })
    .from(closeFriends)
    .where(eq(closeFriends.friendId, viewerId));
  return rows.map((r) => r.id);
}

// -- Reading lists ----------------------------------------------------------

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "list"}-${nanoid(6).toLowerCase()}`;
}

export async function createList(
  db: Db,
  userId: string,
  input: {
    title: string;
    description?: string | null;
    coverUrl?: string | null;
    isPublic?: boolean;
  },
): Promise<ReadingList> {
  const [list] = await db
    .insert(readingLists)
    .values({
      userId,
      title: input.title,
      slug: slugify(input.title),
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      isPublic: input.isPublic ?? false,
    })
    .returning();
  return list;
}

export async function updateList(
  db: Db,
  listId: string,
  patch: {
    title?: string;
    description?: string | null;
    coverUrl?: string | null;
    isPublic?: boolean;
  },
): Promise<ReadingList | null> {
  const [row] = await db
    .update(readingLists)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(readingLists.id, listId))
    .returning();
  return row ?? null;
}

export async function deleteList(db: Db, listId: string): Promise<void> {
  await db.delete(readingLists).where(eq(readingLists.id, listId));
}

export async function getListById(db: Db, listId: string): Promise<ReadingList | null> {
  const [row] = await db.select().from(readingLists).where(eq(readingLists.id, listId)).limit(1);
  return row ?? null;
}

export async function getListBySlug(db: Db, slug: string): Promise<ReadingList | null> {
  const [row] = await db.select().from(readingLists).where(eq(readingLists.slug, slug)).limit(1);
  return row ?? null;
}

export async function listListsForUser(
  db: Db,
  userId: string,
  opts: { publicOnly?: boolean } = {},
): Promise<ReadingList[]> {
  const where = opts.publicOnly
    ? and(eq(readingLists.userId, userId), eq(readingLists.isPublic, true))
    : eq(readingLists.userId, userId);
  return db.select().from(readingLists).where(where).orderBy(desc(readingLists.updatedAt));
}

export interface ListSummary {
  listId: string;
  bookCount: number;
  covers: string[]; // up to four cover urls, in list order, for a preview stack
}

/** Per-list book count and a few preview covers for the owner's lists index. One pass over
 *  the list's books (scoped to the owner via the reading_lists join), grouped in memory. */
export async function listSummariesForUser(db: Db, userId: string): Promise<ListSummary[]> {
  const rows = await db
    .select({ listId: readingListBooks.listId, coverUrl: books.coverUrl })
    .from(readingListBooks)
    .innerJoin(
      readingLists,
      and(eq(readingLists.id, readingListBooks.listId), eq(readingLists.userId, userId)),
    )
    .innerJoin(books, eq(books.id, readingListBooks.bookId))
    .orderBy(readingListBooks.listId, readingListBooks.position, readingListBooks.addedAt);

  const map = new Map<string, { bookCount: number; covers: string[] }>();
  for (const r of rows) {
    let e = map.get(r.listId);
    if (!e) {
      e = { bookCount: 0, covers: [] };
      map.set(r.listId, e);
    }
    e.bookCount += 1;
    if (r.coverUrl && e.covers.length < 4) e.covers.push(r.coverUrl);
  }
  return [...map.entries()].map(([listId, v]) => ({ listId, ...v }));
}

export async function listBooks(db: Db, listId: string): Promise<ReadingListBook[]> {
  return db
    .select()
    .from(readingListBooks)
    .where(eq(readingListBooks.listId, listId))
    .orderBy(readingListBooks.position, readingListBooks.addedAt);
}

export async function addBookToList(
  db: Db,
  listId: string,
  input: { bookId: string; position?: number; note?: string | null },
): Promise<ReadingListBook> {
  const [row] = await db
    .insert(readingListBooks)
    .values({
      listId,
      bookId: input.bookId,
      position: input.position ?? 0,
      note: input.note ?? null,
    })
    .returning();
  return row;
}

export async function removeBookFromList(db: Db, listId: string, bookId: string): Promise<void> {
  await db
    .delete(readingListBooks)
    .where(and(eq(readingListBooks.listId, listId), eq(readingListBooks.bookId, bookId)));
}

// -- Activity feed candidates -----------------------------------------------
// Fetch the newest events authored by any of the candidate authors. Visibility
// filtering per viewer happens in domain/social.ts (the pure resolver), NOT here: this
// returns raw rows so the resolver stays unit-testable without D1.

export async function listActivityByAuthors(
  db: Db,
  authorIds: string[],
  opts: { cursor?: number | null; limit?: number } = {},
): Promise<ActivityEvent[]> {
  if (authorIds.length === 0) return [];
  const limit = Math.min(opts.limit ?? 40, 100);
  const conds = [inArray(activityEvents.userId, authorIds)];
  if (opts.cursor) conds.push(lt(activityEvents.createdAt, new Date(opts.cursor)));
  return db
    .select()
    .from(activityEvents)
    .where(and(...conds))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

/** The viewer's own new_follower notifications, for the feed self-channel ("X followed
 *  you"). Time-ordered so the domain can merge them with activity by created_at. */
export async function listFollowerNotifications(
  db: Db,
  viewerId: string,
  opts: { cursor?: number | null; limit?: number } = {},
): Promise<FollowerNotification[]> {
  const limit = Math.min(opts.limit ?? 40, 100);
  const conds = [eq(notifications.userId, viewerId), eq(notifications.type, "new_follower")];
  if (opts.cursor) conds.push(lt(notifications.createdAt, new Date(opts.cursor)));
  return db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/** A single user's own activity, filtered to the visibilities the viewer may see. Used
 *  by the public profile activity tab. */
export async function listActivityForUser(
  db: Db,
  userId: string,
  allowedVisibilities: string[],
  opts: { limit?: number } = {},
): Promise<ActivityEvent[]> {
  if (allowedVisibilities.length === 0) return [];
  return db
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.userId, userId),
        inArray(activityEvents.visibility, allowedVisibilities),
      ),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(Math.min(opts.limit ?? 30, 100));
}
