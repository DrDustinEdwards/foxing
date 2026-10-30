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
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { and, eq, getTableName, inArray, lt, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { domainErrors } from "./errors";
import { rankSuccessors } from "./membership";
import type { Db } from "../db";
import {
  account,
  activityEvents,
  announcements,
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
  passkey,
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
  /** One DELETE statement, so the whole erasure runs as a single D1 batch. */
  del: (db: Db, userId: string) => BatchItem<"sqlite">;
};

/** Rows owned via a single user-id-like column (userId, reporterId, creatorId, ...). */
function byColumn(key: string, table: SQLiteTable, column: SQLiteColumn): Entry {
  return {
    key,
    tableName: getTableName(table),
    select: (db, userId) => db.select().from(table).where(eq(column, userId)),
    del: (db, userId) => db.delete(table).where(eq(column, userId)),
  };
}

/** Rows the user is on either side of (follows: follower or following). */
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

// Ordered child-first so explicit deletes never orphan a grandchild.
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
 *  - Better Auth infrastructure (user, session, account, verification, passkey). `user`
 *    basics travel with the export via the caller's session; `account` holds sign-in
 *    links to Google or Apple and `passkey` the devices' public keys, neither the
 *    reader's own content. These are removed by deleteAccount.
 *  - Public content the user contributed or authored (catalog books via added_by,
 *    journal posts + versions via author_id / saved_by, admin announcements via
 *    created_by). These outlive the account: their FK is ON DELETE SET NULL, so
 *    deleting the user nulls the attribution and the content stays. They are not
 *    personal data to erase or export per-user.
 */
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

/** GDPR export: every user-owned table as JSON, keyed by ACCOUNT_EXPORT_KEYS. */
export async function exportAccount(db: Db, userId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const entry of REGISTRY) {
    out[entry.key] = await entry.select(db, userId);
  }
  return out;
}

/** A club the user created, the members who may take it over (best first, see
 *  rankSuccessors) and the default. No candidates: the club is deleted with the account. */
export type ClubHandover = {
  clubId: string;
  name: string;
  candidates: { userId: string; name: string; role: string }[];
  suggested: string | null;
};

/** The clubs a user would hand over on deleting their account (Dustin, 2026-10-23: one
 *  person leaving must not delete everyone else's discussion; the owner picks who takes
 *  over, as Slack, GitHub and Discord have an owner hand over before leaving). */
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

/** The owner's choice per club: a candidate's user id, or null to delete the club. A club
 *  left out gets its suggested successor (an admin deletion, or an older client). */
export type ClubSuccessors = Record<string, string | null>;

/** The statements that hand each club over, checked before anything is written. */
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

/** GDPR erasure, in one D1 batch so a failure leaves nothing half-done: hand each club
 *  the user created to the member they chose (or the suggested one), then remove every
 *  user-owned row, then the Better Auth rows. Clubs nobody takes over go with the account. */
export async function deleteAccount(
  db: Db,
  userId: string,
  successors: ClubSuccessors = {},
): Promise<void> {
  const handover = await handoverStatements(db, userId, successors);
  // verification keys on the email (identifier), not the user id.
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  const stmts: BatchItem<"sqlite">[] = [
    ...handover,
    ...REGISTRY.map((entry) => entry.del(db, userId)),
    db.delete(session).where(eq(session.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(passkey).where(eq(passkey.userId, userId)),
    ...(row?.email ? [db.delete(verification).where(eq(verification.identifier, row.email))] : []),
    db.delete(user).where(eq(user.id, userId)),
  ];
  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

/** Expired sessions and one-time sign-in values, deleted once a day. Nothing else removes them,
 *  so they piled up (230 expired verification rows and 181 expired sessions on 2026-10-30).
 *  The same cleanup as EmDash 1.4.0 (emdash-cms/emdash#4287, MIT). */
export async function deleteExpiredAuthRows(db: Db, now: Date): Promise<void> {
  await db.batch([
    db.delete(session).where(lt(session.expiresAt, now)),
    db.delete(verification).where(lt(verification.expiresAt, now)),
  ]);
}
