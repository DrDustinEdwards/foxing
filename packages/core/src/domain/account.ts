// Account data rights: GDPR export and erasure, driven by ONE registry of every
// user-scoped table so export and delete can never drift apart. A table is
// user-scoped if it holds rows owned or authored by a user. The completeness test
// (packages/core/test/account-export.test.ts) enumerates every table with a
// foreign key to `user` and fails if it is not represented here or explicitly
// excluded, so a table added later cannot silently fall out of the export.
//
// Deletion is explicit and child-first (grandchildren, then children, then the
// parent), then removes the Better Auth rows. D1 also enforces the ON DELETE
// CASCADE from the user root, so the final user-row delete is a backstop for
// anything not enumerated; the explicit deletes make erasure deterministic
// regardless of foreign-key enforcement in a given environment.
import { type SQLiteColumn, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { eq, getTableName, inArray, or } from "drizzle-orm";
import type { Db } from "../db";
import {
  account,
  activityEvents,
  annotations,
  books,
  closeFriends,
  clubMeetingRsvps,
  clubMeetings,
  clubMembers,
  clubPollVotes,
  clubPolls,
  clubPosts,
  clubThreads,
  clubs,
  companionMessages,
  companionThreads,
  customShelfBooks,
  customShelves,
  diaryEntries,
  follows,
  journalPostVersions,
  journalPosts,
  notifications,
  profiles,
  pushTokens,
  reactions,
  readingGoals,
  readingListBooks,
  readingLists,
  readingSessions,
  readingStreaks,
  reports,
  saves,
  session,
  user,
  userBadges,
  userBookTags,
  userBooks,
  userFavorites,
  verification,
  vocabulary,
} from "../schema";

type Entry = {
  /** camelCase key in the export JSON. */
  key: string;
  /** SQL table name, used by the completeness test. */
  tableName: string;
  select: (db: Db, userId: string) => Promise<unknown[]>;
  del: (db: Db, userId: string) => Promise<void>;
};

/** Rows owned via a single user-id-like column (userId, reporterId, creatorId, ...). */
function byColumn(key: string, table: SQLiteTable, column: SQLiteColumn): Entry {
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) => db.select().from(table).where(eq(column, userId)),
    del: async (db, userId) => {
      await db.delete(table).where(eq(column, userId));
    },
  };
}

/** Rows the user is on either side of (follows: follower or following). */
function byEitherColumn(
  key: string,
  table: SQLiteTable,
  a: SQLiteColumn,
  b: SQLiteColumn,
): Entry {
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) =>
      db.select().from(table).where(or(eq(a, userId), eq(b, userId))),
    del: async (db, userId) => {
      await db.delete(table).where(or(eq(a, userId), eq(b, userId)));
    },
  };
}

/** Grandchildren with no user column: matched through the parent the user owns. */
function byParent(
  key: string,
  table: SQLiteTable,
  fk: SQLiteColumn,
  parentTable: SQLiteTable,
  parentPk: SQLiteColumn,
  parentUser: SQLiteColumn,
): Entry {
  const parent = (db: Db, userId: string) =>
    db.select({ id: parentPk }).from(parentTable).where(eq(parentUser, userId));
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) => db.select().from(table).where(inArray(fk, parent(db, userId))),
    del: async (db, userId) => {
      await db.delete(table).where(inArray(fk, parent(db, userId)));
    },
  };
}

// Ordered child-first so explicit deletes never orphan a grandchild.
const REGISTRY: Entry[] = [
  byParent("customShelfBooks", customShelfBooks, customShelfBooks.shelfId, customShelves, customShelves.id, customShelves.userId),
  byParent("readingListBooks", readingListBooks, readingListBooks.listId, readingLists, readingLists.id, readingLists.userId),
  byParent("companionMessages", companionMessages, companionMessages.threadId, companionThreads, companionThreads.id, companionThreads.userId),
  byColumn("clubPollVotes", clubPollVotes, clubPollVotes.userId),
  byColumn("clubMeetingRsvps", clubMeetingRsvps, clubMeetingRsvps.userId),
  byColumn("clubPosts", clubPosts, clubPosts.authorId),
  byColumn("clubThreads", clubThreads, clubThreads.authorId),
  byColumn("clubPolls", clubPolls, clubPolls.createdBy),
  byColumn("clubMeetings", clubMeetings, clubMeetings.createdBy),
  byColumn("clubMembers", clubMembers, clubMembers.userId),
  byColumn("clubs", clubs, clubs.creatorId),
  byColumn("userBooks", userBooks, userBooks.userId),
  byColumn("diaryEntries", diaryEntries, diaryEntries.userId),
  byColumn("readingSessions", readingSessions, readingSessions.userId),
  byColumn("readingGoals", readingGoals, readingGoals.userId),
  byColumn("readingStreaks", readingStreaks, readingStreaks.userId),
  byColumn("vocabulary", vocabulary, vocabulary.userId),
  byColumn("userBadges", userBadges, userBadges.userId),
  byColumn("userFavorites", userFavorites, userFavorites.userId),
  byColumn("userBookTags", userBookTags, userBookTags.userId),
  byColumn("customShelves", customShelves, customShelves.userId),
  byColumn("annotations", annotations, annotations.userId),
  byColumn("reactions", reactions, reactions.userId),
  byColumn("saves", saves, saves.userId),
  byEitherColumn("follows", follows, follows.followerId, follows.followingId),
  byColumn("closeFriends", closeFriends, closeFriends.userId),
  byColumn("readingLists", readingLists, readingLists.userId),
  byColumn("activityEvents", activityEvents, activityEvents.userId),
  byColumn("notifications", notifications, notifications.userId),
  byColumn("reports", reports, reports.reporterId),
  byColumn("pushTokens", pushTokens, pushTokens.userId),
  byColumn("companionThreads", companionThreads, companionThreads.userId),
  byColumn("profiles", profiles, profiles.id),
];

/** Every export key, in registry order. Endpoint output has exactly these keys. */
export const ACCOUNT_EXPORT_KEYS: string[] = REGISTRY.map((e) => e.key);

/** SQL names covered by the registry; the completeness test checks against these. */
export const USER_SCOPED_TABLE_NAMES: ReadonlySet<string> = new Set(
  REGISTRY.map((e) => e.tableName),
);

/**
 * Tables with a foreign key to `user` that are intentionally NOT in the per-user
 * export or delete:
 *  - Better Auth infrastructure (user, session, account, verification). `user`
 *    basics travel with the export via the caller's session; `account` holds the
 *    password hash and is never exported. These are removed by deleteAccount.
 *  - Public content the user contributed or authored (catalog books via added_by,
 *    journal posts + versions via author_id / saved_by). These outlive the account:
 *    their FK is ON DELETE SET NULL, so deleting the user nulls the attribution and
 *    the content stays. They are not personal data to erase or export per-user.
 */
export const ACCOUNT_EXPORT_EXCLUDED: ReadonlySet<string> = new Set([
  getTableName(user),
  getTableName(session),
  getTableName(account),
  getTableName(verification),
  getTableName(books),
  getTableName(journalPosts),
  getTableName(journalPostVersions),
]);

/** GDPR export: every user-owned table as JSON, keyed by ACCOUNT_EXPORT_KEYS. */
export async function exportAccount(db: Db, userId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const entry of REGISTRY) {
    out[entry.key] = await entry.select(db, userId);
  }
  return out;
}

/** GDPR erasure: remove every user-owned row, then the Better Auth rows. */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  for (const entry of REGISTRY) {
    await entry.del(db, userId);
  }
  // Better Auth rows. verification keys on the email (identifier), not the user id.
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  if (row?.email) {
    await db.delete(verification).where(eq(verification.identifier, row.email));
  }
  await db.delete(user).where(eq(user.id, userId));
}
