// Account export and erasure from ONE registry of user-scoped tables, so they cannot drift. The completeness test
// (packages/core/test/account-export.test.ts) fails if a table with a foreign key to `user` is neither here nor excluded.
// Deletion is child-first; D1's ON DELETE CASCADE from user is only a backstop, so erasure does not depend on foreign-key enforcement.
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { and, eq, getTableName, inArray, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { domainErrors } from "./errors";
import { rankSuccessors } from "./membership";
import type { Db } from "../db";
import {
  account,
  activityEvents,
  announcements,
  authEvents,
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
  companionUsage,
  customShelfBooks,
  customShelves,
  diaryEntries,
  follows,
  journalPostVersions,
  journalPosts,
  notifications,
  passkey,
  profiles,
  pushTokens,
  reactions,
  readingGoals,
  readingListBooks,
  readingLists,
  readingSessions,
  readingStreaks,
  session,
  user,
  userBooks,
  verification,
  vocabulary,
} from "../schema";

type Entry = {
  key: string;
  tableName: string;
  select: (db: Db, userId: string) => Promise<unknown[]>;
  del: (db: Db, userId: string) => BatchItem<"sqlite">;
};

function byColumn(key: string, table: SQLiteTable, column: SQLiteColumn): Entry {
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) => db.select().from(table).where(eq(column, userId)),
    del: (db, userId) => db.delete(table).where(eq(column, userId)),
  };
}

function byEitherColumn(key: string, table: SQLiteTable, a: SQLiteColumn, b: SQLiteColumn): Entry {
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) =>
      db
        .select()
        .from(table)
        .where(or(eq(a, userId), eq(b, userId))),
    del: (db, userId) => db.delete(table).where(or(eq(a, userId), eq(b, userId))),
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
    select: (db, userId) =>
      db
        .select()
        .from(table)
        .where(inArray(fk, parent(db, userId))),
    del: (db, userId) => db.delete(table).where(inArray(fk, parent(db, userId))),
  };
}

const REGISTRY: Entry[] = [
  byParent(
    "customShelfBooks",
    customShelfBooks,
    customShelfBooks.shelfId,
    customShelves,
    customShelves.id,
    customShelves.userId,
  ),
  byParent(
    "readingListBooks",
    readingListBooks,
    readingListBooks.listId,
    readingLists,
    readingLists.id,
    readingLists.userId,
  ),
  byParent(
    "companionMessages",
    companionMessages,
    companionMessages.threadId,
    companionThreads,
    companionThreads.id,
    companionThreads.userId,
  ),
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
  byColumn("customShelves", customShelves, customShelves.userId),
  byColumn("annotations", annotations, annotations.userId),
  byColumn("reactions", reactions, reactions.userId),
  byEitherColumn("follows", follows, follows.followerId, follows.followingId),
  byColumn("closeFriends", closeFriends, closeFriends.userId),
  byColumn("readingLists", readingLists, readingLists.userId),
  byColumn("activityEvents", activityEvents, activityEvents.userId),
  byColumn("notifications", notifications, notifications.userId),
  byColumn("pushTokens", pushTokens, pushTokens.userId),
  byColumn("companionThreads", companionThreads, companionThreads.userId),
  byColumn("companionUsage", companionUsage, companionUsage.userId),
  byColumn("profiles", profiles, profiles.id),
];

export const ACCOUNT_EXPORT_KEYS: string[] = REGISTRY.map((e) => e.key);

export const USER_SCOPED_TABLE_NAMES: ReadonlySet<string> = new Set(
  REGISTRY.map((e) => e.tableName),
);

/** Tables with a foreign key to `user` left out on purpose: Better Auth's own rows (its deleteUser removes them) and public content whose FK is ON DELETE SET NULL, so attribution is nulled and the content stays. */
export const ACCOUNT_EXPORT_EXCLUDED: ReadonlySet<string> = new Set([
  getTableName(user),
  getTableName(session),
  getTableName(account),
  getTableName(verification),
  getTableName(passkey),
  getTableName(books),
  getTableName(journalPosts),
  getTableName(journalPostVersions),
  getTableName(announcements),
]);

export async function exportAccount(db: Db, userId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const entry of REGISTRY) {
    out[entry.key] = await entry.select(db, userId);
  }
  return out;
}

export type ClubHandover = {
  clubId: string;
  name: string;
  candidates: { userId: string; name: string; role: string }[];
  suggested: string | null;
};

/** One person leaving must not delete everyone else's discussion, so the owner of a club hands it over. */
export async function clubsToHandOver(db: Db, userId: string): Promise<ClubHandover[]> {
  const owned = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(eq(clubs.creatorId, userId));
  const out: ClubHandover[] = [];
  for (const club of owned) {
    const members = await db
      .select({
        userId: clubMembers.userId,
        status: clubMembers.status,
        role: clubMembers.role,
        joinedAt: clubMembers.joinedAt,
        username: profiles.username,
        displayName: profiles.displayName,
      })
      .from(clubMembers)
      .leftJoin(profiles, eq(profiles.id, clubMembers.userId))
      .where(eq(clubMembers.clubId, club.id));
    const candidates = rankSuccessors(members, userId).map((m) => ({
      userId: m.userId,
      name: m.displayName || m.username || "A member",
      role: m.role,
    }));
    out.push({
      clubId: club.id,
      name: club.name,
      candidates,
      suggested: candidates[0]?.userId ?? null,
    });
  }
  return out;
}

/** The owner's choice per club: a candidate's user id, or null to delete it. A club left out gets its suggested successor. */
export type ClubSuccessors = Record<string, string | null>;

async function handoverStatements(
  db: Db,
  userId: string,
  chosen: ClubSuccessors,
): Promise<BatchItem<"sqlite">[]> {
  const plan = await clubsToHandOver(db, userId);
  const owned = new Set(plan.map((c) => c.clubId));
  for (const id of Object.keys(chosen)) {
    if (!owned.has(id)) throw domainErrors.validation("That club is not yours to hand over.");
  }
  const stmts: BatchItem<"sqlite">[] = [];
  for (const club of plan) {
    const pick = club.clubId in chosen ? chosen[club.clubId] : club.suggested;
    if (pick === null) continue; // deleted with the account
    if (!club.candidates.some((c) => c.userId === pick)) {
      throw domainErrors.validation(`Pick an active member to take over ${club.name}.`);
    }
    stmts.push(
      db
        .update(clubs)
        .set({ creatorId: pick, updatedAt: new Date() })
        .where(eq(clubs.id, club.clubId)),
      db
        .update(clubMembers)
        .set({ role: "owner" })
        .where(and(eq(clubMembers.clubId, club.clubId), eq(clubMembers.userId, pick))),
      db.insert(notifications).values({
        userId: pick,
        type: "club_ownership",
        title: `You now own ${club.name}`,
        body: "Its creator deleted their account and handed the club to you.",
        data: { clubId: club.clubId },
      }),
    );
  }
  return stmts;
}

/** Rows a deletion removes before Better Auth's: club hand-overs, user-owned rows, then sign-in codes kept under the email. */
async function erasureStatements(
  db: Db,
  userId: string,
  successors: ClubSuccessors,
): Promise<BatchItem<"sqlite">[]> {
  const handover = await handoverStatements(db, userId, successors);
  // verification keys on the email (identifier), not the user id.
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return [
    ...handover,
    ...REGISTRY.map((entry) => entry.del(db, userId)),
    db.delete(authEvents).where(eq(authEvents.userId, userId)),
    ...(row?.email ? [db.delete(verification).where(eq(verification.identifier, row.email))] : []),
  ];
}

/** The reader's own deletion (Better Auth's deleteUser runs it first), one D1 batch so a refused hand-over leaves nothing half-done. */
export async function eraseAccountData(
  db: Db,
  userId: string,
  successors: ClubSuccessors = {},
): Promise<void> {
  const stmts = await erasureStatements(db, userId, successors);
  if (stmts.length > 0) await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

export async function checkSuccessors(
  db: Db,
  userId: string,
  successors: ClubSuccessors,
): Promise<void> {
  await handoverStatements(db, userId, successors);
}

/** GDPR erasure by an admin, one D1 batch so a failure leaves nothing half-done. */
export async function deleteAccount(
  db: Db,
  userId: string,
  successors: ClubSuccessors = {},
): Promise<void> {
  const stmts: BatchItem<"sqlite">[] = [
    ...(await erasureStatements(db, userId, successors)),
    db.delete(session).where(eq(session.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(passkey).where(eq(passkey.userId, userId)),
    db.delete(user).where(eq(user.id, userId)),
  ];
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
