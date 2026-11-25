// Admin data access for the operator surfaces: dashboard, audit, users. Catalog, journal and announcement surfaces live in their own
// modules, re-exported below so adminRepo stays one namespace. Reads run in-process from loaders; writes are called by the
// /api/v1/admin routes, each audit-logged at the route layer.
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { likeContains } from "@dustinedwards/site-runtime/d1";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db";
import { type AdminSettings, isAdminEmail } from "@dustinedwards/site-runtime/access";
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
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(where);
  return row?.n ?? 0;
}

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
  opts: { q?: string; limit?: number; offset?: number; admins: AdminSettings },
): Promise<AdminUserRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      tier: profiles.subscriptionTier,
      isSuspended: profiles.isSuspended,
      createdAt: profiles.createdAt,
      email: user.email,
    })
    .from(profiles)
    .leftJoin(user, eq(user.id, profiles.id))
    .where(
      q ? or(likeContains(profiles.username, q), likeContains(profiles.displayName, q)) : undefined,
    )
    .orderBy(desc(profiles.createdAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
  return rows.map(({ email, ...row }) => ({
    ...row,
    isAdmin: isAdminEmail(opts.admins, email ?? ""),
  }));
}

/** Only id and email: whether it may act is decided from its profile, per request. */
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

export async function getUserDetail(db: Db, id: string, admins: AdminSettings) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!row) return null;
  // Email lives on the Better Auth user row; last-active is the latest session start.
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
  const email = authRow?.email ?? null;
  return {
    ...row,
    email,
    isAdmin: isAdminEmail(admins, email ?? ""),
    lastActiveAt: lastSession?.createdAt ?? null,
  };
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

export type UserRoleState = {
  id: string;
  username: string;
  displayName: string | null;
  isSuspended: boolean;
  tier: string;
};

export async function getUserRoleState(db: Db, id: string): Promise<UserRoleState | null> {
  const [row] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      isSuspended: profiles.isSuspended,
      tier: profiles.subscriptionTier,
    })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return row ?? null;
}

// The two role setters write only while the row still holds `from`, the value the
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
