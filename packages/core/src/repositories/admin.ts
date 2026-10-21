// Admin data access. One module for every launch-critical operator surface: dashboard
// counts, users, catalog books, book-of-the-month, celebrity picks, reader clubs,
// journal posts, broadcast notifications, and site announcements. Reads run in-process
// from RR loaders; writes are called by the /api/v1/admin routes (browser client), each
// wrapped in an audit-log entry at the route layer. Suspension/admin flags live on
// profiles; club verification lives on clubs.is_verified. No new columns beyond the
// additive announcements table. Dashboard, audit and users live here; the catalog,
// journal and announcement surfaces live in their own modules, re-exported below so
// adminRepo stays one namespace.
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db";
import {
  adminAuditLog,
  annotations,
  bookOfTheMonth,
  books,
  clubMembers,
  clubs,
  diaryEntries,
  journalPosts,
  notifications,
  profiles,
  session,
  user,
  userBooks,
} from "../schema";

async function countWhere(db: Db, table: SQLiteTable, where?: SQL): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(table).where(where);
  return row?.n ?? 0;
}

// ---- Dashboard ----------------------------------------------------------------

export type AdminStats = {
  totalUsers: number;
  plusUsers: number;
  suspendedUsers: number;
  totalBooks: number;
  staffPicks: number;
  totalClubs: number;
  publishedJournal: number;
  publishedBotm: number;
  recentSignups: Array<{ id: string; username: string; createdAt: Date; tier: string }>;
};

export async function getAdminStats(db: Db): Promise<AdminStats> {
  const [totalUsers, plusUsers, suspendedUsers, totalBooks, staffPicks, totalClubs] =
    await Promise.all([
      countWhere(db, profiles),
      countWhere(db, profiles, eq(profiles.subscriptionTier, "plus")),
      countWhere(db, profiles, eq(profiles.isSuspended, true)),
      countWhere(db, books),
      countWhere(db, books, eq(books.isStaffPick, true)),
      countWhere(db, clubs),
    ]);

  const [publishedJournal, publishedBotm, recentSignups] = await Promise.all([
    countWhere(db, journalPosts, eq(journalPosts.isPublished, true)),
    countWhere(db, bookOfTheMonth, eq(bookOfTheMonth.isPublished, true)),
    db
      .select({
        id: profiles.id,
        username: profiles.username,
        createdAt: profiles.createdAt,
        tier: profiles.subscriptionTier,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(10),
  ]);

  return {
    totalUsers,
    plusUsers,
    suspendedUsers,
    totalBooks,
    staffPicks,
    totalClubs,
    publishedJournal,
    publishedBotm,
    recentSignups,
  };
}

// ---- Audit log ----------------------------------------------------------------

export type AuditEntry = {
  action: string;
  params?: Record<string, unknown> | null;
  actor?: string | null;
  sourceIp?: string | null;
};

export async function writeAuditLog(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(adminAuditLog).values({
    action: entry.action,
    params: entry.params ?? null,
    actor: entry.actor ?? null,
    sourceIp: entry.sourceIp ?? null,
    performedAt: new Date(),
  });
}

export type AuditRow = typeof adminAuditLog.$inferSelect;

export async function listAuditLog(db: Db, limit = 50, offset = 0): Promise<AuditRow[]> {
  return db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.performedAt))
    .limit(Math.min(limit, 200))
    .offset(offset);
}

// ---- Users --------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  tier: string;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: Date;
};

export async function listUsers(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminUserRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      tier: profiles.subscriptionTier,
      isAdmin: profiles.isAdmin,
      isSuspended: profiles.isSuspended,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(
      q ? or(like(profiles.username, `%${q}%`), like(profiles.displayName, `%${q}%`)) : undefined,
    )
    .orderBy(desc(profiles.createdAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
  return rows;
}

/** The account behind an operator call's named actor (api operator bearer). Only the
 *  id and email: whether it may act is decided from its profile, per request. */
export async function getOperatorActor(
  db: Db,
  id: string,
): Promise<{ id: string; email: string } | null> {
  const [row] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}

export async function getUserDetail(db: Db, id: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!row) return null;
  // Email lives on the Better Auth user row, not the profile. Last-active is the most
  // recent session start (a good-enough proxy without a dedicated column).
  const [authRow] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  const [lastSession] = await db
    .select({ createdAt: session.createdAt })
    .from(session)
    .where(eq(session.userId, id))
    .orderBy(desc(session.createdAt))
    .limit(1);
  return { ...row, email: authRow?.email ?? null, lastActiveAt: lastSession?.createdAt ?? null };
}

export type UserActivityStats = {
  booksFinished: number;
  highlights: number;
  clubsJoined: number;
  diaryEntries: number;
};

export async function getUserActivityStats(db: Db, id: string): Promise<UserActivityStats> {
  const [booksFinished, highlights, clubsJoined, diary] = await Promise.all([
    countWhere(db, userBooks, and(eq(userBooks.userId, id), eq(userBooks.status, "finished"))),
    countWhere(db, annotations, and(eq(annotations.userId, id), eq(annotations.type, "highlight"))),
    countWhere(db, clubMembers, eq(clubMembers.userId, id)),
    countWhere(db, diaryEntries, eq(diaryEntries.userId, id)),
  ]);
  return { booksFinished, highlights, clubsJoined, diaryEntries: diary };
}

/** The role and permission state an admin change previews and then guards on. */
export type UserRoleState = {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  isSuspended: boolean;
  tier: string;
};

export async function getUserRoleState(db: Db, id: string): Promise<UserRoleState | null> {
  const [row] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      isAdmin: profiles.isAdmin,
      isSuspended: profiles.isSuspended,
      tier: profiles.subscriptionTier,
    })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return row ?? null;
}

// The three role setters write only while the row still holds `from`, the value the
// admin saw in the preview, and return whether a row changed. Counted with RETURNING,
// not meta.changes, which triggers can inflate.

export async function setUserSuspended(
  db: Db,
  id: string,
  suspended: boolean,
  from: boolean,
): Promise<boolean> {
  const rows = await db
    .update(profiles)
    .set({ isSuspended: suspended, updatedAt: new Date() })
    .where(and(eq(profiles.id, id), eq(profiles.isSuspended, from)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}

export async function setUserTier(
  db: Db,
  id: string,
  tier: "free" | "plus",
  from: string,
): Promise<boolean> {
  const rows = await db
    .update(profiles)
    .set({ subscriptionTier: tier, updatedAt: new Date() })
    .where(and(eq(profiles.id, id), eq(profiles.subscriptionTier, from)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}

export async function setUserAdmin(
  db: Db,
  id: string,
  isAdmin: boolean,
  from: boolean,
): Promise<boolean> {
  const rows = await db
    .update(profiles)
    .set({ isAdmin, updatedAt: new Date() })
    .where(and(eq(profiles.id, id), eq(profiles.isAdmin, from)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}

/** Send one notification to a single user (admin-directed). */
export async function notifyUser(
  db: Db,
  userId: string,
  input: { type: string; title: string; body?: string | null },
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    createdAt: new Date(),
  });
}

export * from "./admin-announcements";
export * from "./admin-catalog";
export * from "./admin-journal";
