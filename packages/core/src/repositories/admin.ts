// Admin data access. One module for every launch-critical operator surface: dashboard
// counts, users, catalog books, book-of-the-month, celebrity picks, reader clubs,
// journal posts, broadcast notifications, and site announcements. Reads run in-process
// from RR loaders; writes are called by the /api/v1/admin routes (browser client), each
// wrapped in an audit-log entry at the route layer. Suspension/admin flags live on
// profiles; club verification lives on clubs.is_verified. No new columns beyond the
// additive announcements table.
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db";
import {
  adminAuditLog,
  annotations,
  announcements,
  bookOfTheMonth,
  books,
  clubMembers,
  clubs,
  diaryEntries,
  externalBookClubPicks,
  externalBookClubs,
  journalPosts,
  journalPostVersions,
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

export async function listAuditLog(db: Db, limit = 50): Promise<AuditRow[]> {
  return db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.performedAt))
    .limit(Math.min(limit, 200));
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

// ---- Books --------------------------------------------------------------------

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  slug: string;
  sourceType: string;
  isStaffPick: boolean;
  publicationYear: number | null;
};

export async function listBooksAdmin(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminBookRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      slug: books.slug,
      sourceType: books.sourceType,
      isStaffPick: books.isStaffPick,
      publicationYear: books.publicationYear,
    })
    .from(books)
    .where(q ? or(like(books.title, `%${q}%`), like(books.author, `%${q}%`)) : undefined)
    .orderBy(desc(books.updatedAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
}

export type BookMetaPatch = {
  title?: string;
  author?: string;
  description?: string | null;
  publicationYear?: number | null;
  publisher?: string | null;
  subjects?: string[] | null;
};

export async function updateBookAdmin(db: Db, id: string, patch: BookMetaPatch): Promise<void> {
  await db
    .update(books)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(books.id, id));
}

export async function setBookStaffPick(
  db: Db,
  id: string,
  on: boolean,
  note?: string | null,
): Promise<void> {
  await db
    .update(books)
    .set({ isStaffPick: on, staffPickNote: note ?? null, updatedAt: new Date() })
    .where(eq(books.id, id));
}

// ---- Book of the Month --------------------------------------------------------

export type AdminBotmRow = typeof bookOfTheMonth.$inferSelect & {
  bookTitle: string | null;
  bookAuthor: string | null;
};

export async function listBotmAdmin(db: Db): Promise<AdminBotmRow[]> {
  const rows = await db
    .select({
      row: bookOfTheMonth,
      bookTitle: books.title,
      bookAuthor: books.author,
    })
    .from(bookOfTheMonth)
    .leftJoin(books, eq(bookOfTheMonth.bookId, books.id))
    .orderBy(desc(bookOfTheMonth.year), desc(bookOfTheMonth.month));
  return rows.map((r) => ({ ...r.row, bookTitle: r.bookTitle, bookAuthor: r.bookAuthor }));
}

export async function getBotm(db: Db, id: string) {
  const [row] = await db.select().from(bookOfTheMonth).where(eq(bookOfTheMonth.id, id)).limit(1);
  return row ?? null;
}

export type BotmInput = {
  bookId?: string | null;
  year: number;
  month: number;
  category?: string | null;
  curatorNote?: string | null;
  amazonUrl?: string | null;
  bookshopUrl?: string | null;
  isPublished?: boolean;
};

export async function createBotm(db: Db, input: BotmInput): Promise<string> {
  const [row] = await db
    .insert(bookOfTheMonth)
    .values({ ...input, isPublished: input.isPublished ?? false })
    .returning({ id: bookOfTheMonth.id });
  return row.id;
}

export async function updateBotm(db: Db, id: string, input: Partial<BotmInput>): Promise<void> {
  await db.update(bookOfTheMonth).set(input).where(eq(bookOfTheMonth.id, id));
}

export async function setBotmPublished(db: Db, id: string, on: boolean): Promise<void> {
  await db.update(bookOfTheMonth).set({ isPublished: on }).where(eq(bookOfTheMonth.id, id));
}

export async function deleteBotm(db: Db, id: string): Promise<void> {
  await db.delete(bookOfTheMonth).where(eq(bookOfTheMonth.id, id));
}

// ---- Celebrity picks (external clubs) -----------------------------------------

export async function listPickClubsAdmin(db: Db) {
  return db.select().from(externalBookClubs).orderBy(externalBookClubs.sortOrder);
}

export type AdminPickRow = typeof externalBookClubPicks.$inferSelect & {
  clubName: string | null;
  bookTitle: string | null;
};

export async function listPicksAdmin(db: Db, clubId?: string): Promise<AdminPickRow[]> {
  const rows = await db
    .select({
      row: externalBookClubPicks,
      clubName: externalBookClubs.name,
      bookTitle: books.title,
    })
    .from(externalBookClubPicks)
    .leftJoin(externalBookClubs, eq(externalBookClubPicks.clubId, externalBookClubs.id))
    .leftJoin(books, eq(externalBookClubPicks.bookId, books.id))
    .where(clubId ? eq(externalBookClubPicks.clubId, clubId) : undefined)
    .orderBy(desc(externalBookClubPicks.pickYear), desc(externalBookClubPicks.pickMonth))
    .limit(200);
  return rows.map((r) => ({ ...r.row, clubName: r.clubName, bookTitle: r.bookTitle }));
}

export async function setPickPublished(db: Db, id: string, on: boolean): Promise<void> {
  await db
    .update(externalBookClubPicks)
    .set({ isPublished: on, updatedAt: new Date() })
    .where(eq(externalBookClubPicks.id, id));
}

export async function updatePick(
  db: Db,
  id: string,
  patch: { notes?: string | null; curatorQuote?: string | null; category?: string | null },
): Promise<void> {
  await db
    .update(externalBookClubPicks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(externalBookClubPicks.id, id));
}

// ---- Reader clubs (Phase 5) ---------------------------------------------------

export type AdminClubRow = {
  id: string;
  name: string;
  slug: string | null;
  visibility: string;
  isVerified: boolean;
  createdAt: Date;
};

export async function listClubsAdmin(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number } = {},
): Promise<AdminClubRow[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const q = opts.q?.trim();
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      visibility: clubs.visibility,
      isVerified: clubs.isVerified,
      createdAt: clubs.createdAt,
    })
    .from(clubs)
    .where(q ? like(clubs.name, `%${q}%`) : undefined)
    .orderBy(desc(clubs.createdAt))
    .limit(limit)
    .offset(opts.offset ?? 0);
}

export async function setClubVerified(
  db: Db,
  id: string,
  on: boolean,
  adminId: string,
): Promise<void> {
  await db
    .update(clubs)
    .set({
      isVerified: on,
      verifiedAt: on ? new Date() : null,
      verifiedBy: on ? adminId : null,
      updatedAt: new Date(),
    })
    .where(eq(clubs.id, id));
}

/** Hard-delete a club. Members, threads, posts, polls, and meetings cascade from the
 *  clubs FK (onDelete: cascade). Operator moderation action. */
export async function deleteClubAdmin(db: Db, id: string): Promise<void> {
  await db.delete(clubs).where(eq(clubs.id, id));
}

// ---- Journal ------------------------------------------------------------------

export type JournalAdminQuery = {
  limit?: number;
  offset?: number;
  /** Published or not; omitted lists both. */
  published?: boolean;
  /** Matches title or slug, case-insensitively. */
  q?: string;
};

export async function listJournalAdmin(db: Db, query: JournalAdminQuery = {}) {
  const where: SQL[] = [];
  if (query.published !== undefined) where.push(eq(journalPosts.isPublished, query.published));
  if (query.q) {
    const pattern = `%${query.q.toLowerCase()}%`;
    const match = or(
      like(sql`lower(${journalPosts.title})`, pattern),
      like(journalPosts.slug, pattern),
    );
    if (match) where.push(match);
  }
  return db
    .select({
      id: journalPosts.id,
      title: journalPosts.title,
      slug: journalPosts.slug,
      isPublished: journalPosts.isPublished,
      featured: journalPosts.featured,
      publishedAt: journalPosts.publishedAt,
      updatedAt: journalPosts.updatedAt,
      tags: journalPosts.tags,
    })
    .from(journalPosts)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(journalPosts.updatedAt), desc(journalPosts.id))
    .limit(query.limit ?? 200)
    .offset(query.offset ?? 0);
}

export async function getJournalById(db: Db, id: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.id, id)).limit(1);
  return row ?? null;
}

export async function getJournalBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(journalPosts).where(eq(journalPosts.slug, slug)).limit(1);
  return row ?? null;
}

export type JournalInput = {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  tags?: string[] | null;
  featured?: boolean;
  isPublished?: boolean;
};

/** Optimistic concurrency for a journal write: the write lands only while updated_at still holds this. */
export type JournalWriteGuard = { expectedUpdatedAt?: Date };

/**
 * The updated_at a write stamps: now, but always past the stored one, so two writes in the same
 * millisecond still leave different versions and a stale expectedUpdatedAt can never match again.
 */
function nextUpdatedAt(stored: Date | null | undefined): Date {
  const now = Date.now();
  return new Date(stored ? Math.max(now, stored.getTime() + 1) : now);
}

function journalRow(id: string, guard: JournalWriteGuard): SQL {
  const byId = eq(journalPosts.id, id);
  if (!guard.expectedUpdatedAt) return byId;
  return and(byId, eq(journalPosts.updatedAt, guard.expectedUpdatedAt)) as SQL;
}

/** authorId is null for a post created outside a user session (the Carrel site API). */
export async function createJournalPost(
  db: Db,
  input: JournalInput,
  authorId: string | null,
): Promise<string> {
  const published = input.isPublished ?? false;
  const [row] = await db
    .insert(journalPosts)
    .values({
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      coverImageAlt: input.coverImageAlt ?? null,
      tags: input.tags ?? null,
      featured: input.featured ?? false,
      authorId,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    })
    .returning({ id: journalPosts.id });
  return row.id;
}

/**
 * Saves a journal post, snapshotting the text it replaces into journal_post_versions first.
 * savedBy is null for a save made outside a user session (the Carrel site API). Returns false,
 * having written nothing, when the post does not exist or the guard's updated_at is stale.
 */
export async function updateJournalPost(
  db: Db,
  id: string,
  input: Partial<JournalInput>,
  savedBy: string | null,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  if (
    guard.expectedUpdatedAt &&
    current.updatedAt.getTime() !== guard.expectedUpdatedAt.getTime()
  ) {
    return false;
  }
  // Snapshot the current version before overwriting, mirroring the legacy version history.
  const [snapshot] = await db
    .insert(journalPostVersions)
    .values({
      postId: id,
      title: current.title,
      content: current.content,
      excerpt: current.excerpt,
      savedAt: new Date(),
      savedBy,
    })
    .returning({ id: journalPostVersions.id });
  const updated = await db
    .update(journalPosts)
    .set({ ...input, updatedAt: nextUpdatedAt(current.updatedAt) })
    .where(journalRow(id, guard))
    .returning({ id: journalPosts.id });
  if (updated.length === 0) {
    // Another write landed between the read and this one: the snapshot describes nothing.
    await db.delete(journalPostVersions).where(eq(journalPostVersions.id, snapshot.id));
    return false;
  }
  return true;
}

/**
 * Publishes or unpublishes a journal post. Returns false, having written nothing, when the post
 * does not exist or the guard's updated_at is stale.
 */
export async function setJournalPublished(
  db: Db,
  id: string,
  on: boolean,
  guard: JournalWriteGuard = {},
): Promise<boolean> {
  const current = await getJournalById(db, id);
  if (!current) return false;
  const updated = await db
    .update(journalPosts)
    .set({
      isPublished: on,
      // First publish stamps published_at; unpublishing keeps the original stamp.
      publishedAt: on && !current.publishedAt ? new Date() : (current.publishedAt ?? null),
      updatedAt: nextUpdatedAt(current.updatedAt),
    })
    .where(journalRow(id, guard))
    .returning({ id: journalPosts.id });
  return updated.length > 0;
}

/** The text a post held before each save, newest first. */
export async function listJournalVersions(db: Db, postId: string, limit = 50) {
  return db
    .select()
    .from(journalPostVersions)
    .where(eq(journalPostVersions.postId, postId))
    .orderBy(desc(journalPostVersions.savedAt), desc(journalPostVersions.id))
    .limit(limit);
}

export async function getJournalVersion(db: Db, postId: string, versionId: string) {
  const [row] = await db
    .select()
    .from(journalPostVersions)
    .where(and(eq(journalPostVersions.postId, postId), eq(journalPostVersions.id, versionId)))
    .limit(1);
  return row ?? null;
}

// ---- Broadcast notifications --------------------------------------------------

/** Insert one notification per onboarded user. Returns how many were written. Chunked
 *  so a large audience never exceeds D1's bound-parameter limit. */
export async function broadcastNotification(
  db: Db,
  input: { type: string; title: string; body?: string | null },
): Promise<number> {
  const recipients = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.isSuspended, false));
  const now = new Date();
  const rows = recipients.map((r) => ({
    userId: r.id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    createdAt: now,
  }));
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(notifications).values(rows.slice(i, i + CHUNK));
  }
  return rows.length;
}

// ---- Announcements ------------------------------------------------------------

export type Announcement = typeof announcements.$inferSelect;

export async function listAnnouncements(db: Db): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
}

/** The single live announcement for a placement, if any (is_active + within window).
 *  The window bounds (null = open-ended) are checked in JS to keep the null semantics
 *  readable; the active-set for one placement is tiny. */
export async function getActiveAnnouncement(
  db: Db,
  placement = "banner",
): Promise<Announcement | null> {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.isActive, true), eq(announcements.placement, placement)))
    .orderBy(desc(announcements.createdAt))
    .limit(10);
  const live = rows.find(
    (a) => (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now),
  );
  return live ?? null;
}

export async function getAnnouncement(db: Db, id: string): Promise<Announcement | null> {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return row ?? null;
}

export type AnnouncementInput = {
  title: string;
  body: string;
  placement?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export async function createAnnouncement(
  db: Db,
  input: AnnouncementInput,
  createdBy: string,
): Promise<string> {
  const [row] = await db
    .insert(announcements)
    .values({
      title: input.title,
      body: input.body,
      placement: input.placement ?? "banner",
      linkUrl: input.linkUrl ?? null,
      linkLabel: input.linkLabel ?? null,
      isActive: input.isActive ?? false,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdBy,
    })
    .returning({ id: announcements.id });
  return row.id;
}

export async function updateAnnouncement(
  db: Db,
  id: string,
  input: Partial<AnnouncementInput>,
): Promise<void> {
  await db
    .update(announcements)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(announcements.id, id));
}

export async function deleteAnnouncement(db: Db, id: string): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id));
}
