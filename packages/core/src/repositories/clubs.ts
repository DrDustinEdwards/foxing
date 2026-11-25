import { likeContains } from "@dustinedwards/site-runtime/d1";
// Club data access: no permission logic and no event emission (domain/clubs.ts); writes run after the domain layer authorized them,
// and this file never touches a Durable Object. Threads and posts are in clubs-threads.ts, polls, meetings and schedule in
// clubs-events.ts (re-exported below).
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { customAlphabet, nanoid } from "nanoid";
import { chunked, type Db } from "../db";
import { uniqueSlug } from "@drdustinedwards/site-helpers/slug";
import type { ClubMemberRole, ClubMemberStatus } from "../enums";
import {
  clubBooks,
  type clubMeetingRsvps,
  type clubMeetings,
  clubMembers,
  type clubPollVotes,
  type clubPolls,
  type clubPosts,
  type clubSchedule,
  type clubThreads,
  clubs,
} from "../schema";

export type Club = typeof clubs.$inferSelect;
export type ClubMember = typeof clubMembers.$inferSelect;
export type ClubThread = typeof clubThreads.$inferSelect;
export type ClubPost = typeof clubPosts.$inferSelect;
export type ClubPoll = typeof clubPolls.$inferSelect;
export type ClubPollVote = typeof clubPollVotes.$inferSelect;
export type ClubMeeting = typeof clubMeetings.$inferSelect;
export type ClubMeetingRsvp = typeof clubMeetingRsvps.$inferSelect;
export type ClubScheduleRow = typeof clubSchedule.$inferSelect;

const joinCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeJoinCode = customAlphabet(joinCodeAlphabet, 10);

export function generateJoinCode(): string {
  return makeJoinCode();
}

/** PUBLIC clubs with a slug only, so it is safe on the anonymous suggest endpoint. */
export async function searchClubs(
  db: Db,
  query: string,
  limit = 4,
): Promise<{ id: string; slug: string; name: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await db
    .select({ id: clubs.id, slug: clubs.slug, name: clubs.name })
    .from(clubs)
    .where(and(likeContains(clubs.name, q), eq(clubs.visibility, "public"), isNotNull(clubs.slug)))
    .limit(limit);
  return rows.filter((r): r is { id: string; slug: string; name: string } => r.slug != null);
}

export async function createClub(
  db: Db,
  creatorId: string,
  input: {
    name: string;
    description?: string;
    coverUrl?: string;
    visibility?: string;
    memberApproval?: boolean;
    maxMembers?: number;
    readingPace?: string;
    chaptersPerWeek?: number;
    genreTags?: string[];
    currentBookId?: string;
  },
): Promise<Club> {
  const id = nanoid();
  const now = new Date();
  const [club] = await db
    .insert(clubs)
    .values({
      id,
      name: input.name,
      slug: await uniqueSlug(input.name, { fallback: "club" }),
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      creatorId,
      currentBookId: input.currentBookId ?? null,
      visibility: input.visibility ?? "public",
      memberApproval: input.memberApproval ?? false,
      maxMembers: input.maxMembers ?? null,
      readingPace: input.readingPace ?? null,
      chaptersPerWeek: input.chaptersPerWeek ?? null,
      genreTags: input.genreTags ?? null,
      joinCode: generateJoinCode(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (input.currentBookId) {
    await db.insert(clubBooks).values({ clubId: id, bookId: input.currentBookId, startedAt: now });
  }
  await db.insert(clubMembers).values({
    clubId: id,
    userId: creatorId,
    status: "active",
    role: "owner",
    joinedAt: now,
  });
  return club;
}

export async function getClubById(db: Db, id: string): Promise<Club | null> {
  const [row] = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1);
  return row ?? null;
}

export async function getClubBySlug(db: Db, slug: string): Promise<Club | null> {
  const [row] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
  return row ?? null;
}

export async function getClubByJoinCode(db: Db, code: string): Promise<Club | null> {
  const [row] = await db.select().from(clubs).where(eq(clubs.joinCode, code)).limit(1);
  return row ?? null;
}

export async function listPublicClubs(db: Db, limit = 50): Promise<Club[]> {
  return db
    .select()
    .from(clubs)
    .where(eq(clubs.visibility, "public"))
    .orderBy(desc(clubs.createdAt))
    .limit(limit);
}

export async function listPublicClubsReading(db: Db, bookId: string, limit = 3): Promise<Club[]> {
  return db
    .select()
    .from(clubs)
    .where(and(eq(clubs.visibility, "public"), eq(clubs.currentBookId, bookId)))
    .orderBy(desc(clubs.updatedAt))
    .limit(limit);
}

export async function listClubsForUser(db: Db, userId: string): Promise<Club[]> {
  return db
    .select({ club: clubs })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(and(eq(clubMembers.userId, userId), eq(clubMembers.status, "active")))
    .orderBy(desc(clubs.updatedAt))
    .then((rows) => rows.map((r) => r.club));
}

export async function updateClub(
  db: Db,
  id: string,
  patch: Partial<typeof clubs.$inferInsert>,
): Promise<Club | null> {
  const [row] = await db
    .update(clubs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clubs.id, id))
    .returning();
  return row ?? null;
}

export async function rotateJoinCode(db: Db, id: string): Promise<string> {
  const code = generateJoinCode();
  await db.update(clubs).set({ joinCode: code, updatedAt: new Date() }).where(eq(clubs.id, id));
  return code;
}

export async function deleteClub(db: Db, id: string): Promise<void> {
  // FK cascade removes members/threads/posts/polls/meetings/schedule/books.
  await db.delete(clubs).where(eq(clubs.id, id));
}

/** Points the club at a book or none: clubs.current_book_id is the current read; club_books is the history, its open row (no finished_at) the book now being read. */
export async function setCurrentBook(db: Db, clubId: string, bookId: string | null): Promise<void> {
  const now = new Date();
  await db
    .update(clubBooks)
    .set({ finishedAt: now })
    .where(and(eq(clubBooks.clubId, clubId), isNull(clubBooks.finishedAt)));
  if (bookId) await db.insert(clubBooks).values({ clubId, bookId, startedAt: now });
  await db.update(clubs).set({ currentBookId: bookId, updatedAt: now }).where(eq(clubs.id, clubId));
}

export async function getMembership(
  db: Db,
  clubId: string,
  userId: string,
): Promise<ClubMember | null> {
  const [row] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function countActiveMembers(db: Db, clubId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, "active")));
  return row?.n ?? 0;
}

export async function countActiveMembersFor(
  db: Db,
  clubIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (clubIds.length === 0) return map;
  for (const chunk of chunked(clubIds)) {
    const rows = await db
      .select({ clubId: clubMembers.clubId, n: sql<number>`count(*)` })
      .from(clubMembers)
      .where(and(inArray(clubMembers.clubId, chunk), eq(clubMembers.status, "active")))
      .groupBy(clubMembers.clubId);
    for (const r of rows) map.set(r.clubId, r.n);
  }
  return map;
}

export async function listMembers(db: Db, clubId: string): Promise<ClubMember[]> {
  return db
    .select()
    .from(clubMembers)
    .where(eq(clubMembers.clubId, clubId))
    .orderBy(desc(clubMembers.joinedAt));
}

export async function upsertMembership(
  db: Db,
  clubId: string,
  userId: string,
  values: {
    status: ClubMemberStatus;
    role?: ClubMemberRole;
    invitedBy?: string | null;
    requestedAt?: Date | null;
    joinedAt?: Date | null;
  },
): Promise<ClubMember> {
  const [row] = await db
    .insert(clubMembers)
    .values({
      clubId,
      userId,
      status: values.status,
      role: values.role ?? "member",
      invitedBy: values.invitedBy ?? null,
      requestedAt: values.requestedAt ?? null,
      joinedAt: values.joinedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [clubMembers.clubId, clubMembers.userId],
      set: {
        status: values.status,
        ...(values.role ? { role: values.role } : {}),
        joinedAt: values.joinedAt ?? null,
      },
    })
    .returning();
  return row;
}

export async function setMemberStatus(
  db: Db,
  clubId: string,
  userId: string,
  status: ClubMemberStatus,
  extra: Partial<typeof clubMembers.$inferInsert> = {},
): Promise<ClubMember | null> {
  const [row] = await db
    .update(clubMembers)
    .set({ status, ...extra })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .returning();
  return row ?? null;
}

export async function setMemberRole(
  db: Db,
  clubId: string,
  userId: string,
  role: ClubMemberRole,
): Promise<ClubMember | null> {
  const [row] = await db
    .update(clubMembers)
    .set({ role })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .returning();
  return row ?? null;
}

export async function setMemberMute(
  db: Db,
  clubId: string,
  userId: string,
  mutedUntil: Date | null,
  mutedBy: string,
): Promise<ClubMember | null> {
  const [row] = await db
    .update(clubMembers)
    .set({ mutedUntil, mutedBy })
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)))
    .returning();
  return row ?? null;
}

export async function listActiveMemberIds(
  db: Db,
  clubId: string,
  exclude?: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: clubMembers.userId })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.status, "active")));
  return rows.map((r) => r.userId).filter((id) => id !== exclude);
}

export * from "./clubs-events";
export * from "./clubs-threads";
