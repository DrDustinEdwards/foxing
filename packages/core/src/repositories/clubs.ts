// Club data access. Pure DB reads/writes over the 10 club tables; no
// permission logic and no event emission (that lives in domain/clubs.ts). Reads are
// called in-process from web/mobile loaders; writes are called by the API layer after
// the domain layer has authorized them. All fan-out to the live layer happens AFTER
// these commit -- this file never touches a Durable Object. Threads and posts live in
// clubs-threads.ts, polls, meetings and schedule in clubs-events.ts (re-exported below).
import { and, desc, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import { customAlphabet, nanoid } from "nanoid";
import { chunked, type Db } from "../db";
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

// Join codes are short, unambiguous, and URL/deep-link safe (no lookalike chars).
const joinCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeJoinCode = customAlphabet(joinCodeAlphabet, 10);
// nanoid's own alphabet has "_" and "-", which put "_" or "--" into a club's URL.
const makeSlugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/** A fresh, collision-resistant invite code. */
export function generateJoinCode(): string {
  return makeJoinCode();
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // Suffix guarantees uniqueness without a collision-retry loop.
  return `${base || "club"}-${makeSlugSuffix()}`;
}

// -- Clubs ------------------------------------------------------------------

/** Public clubs matching a name query, for the command palette's federated search.
 *  Only PUBLIC clubs with a slug are returned, so this is safe on the anonymous suggest
 *  endpoint (private clubs never surface here). */
export async function searchClubs(
  db: Db,
  query: string,
  limit = 4,
): Promise<{ id: string; slug: string; name: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const term = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({ id: clubs.id, slug: clubs.slug, name: clubs.name })
    .from(clubs)
    .where(and(like(clubs.name, term), eq(clubs.visibility, "public"), isNotNull(clubs.slug)))
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
      slug: slugify(input.name),
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
  // The creator is the first, owning member.
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

/** Public clubs for the browse list, most recent first. */
export async function listPublicClubs(db: Db, limit = 50): Promise<Club[]> {
  return db
    .select()
    .from(clubs)
    .where(eq(clubs.visibility, "public"))
    .orderBy(desc(clubs.createdAt))
    .limit(limit);
}

/** Public clubs whose current read is the given book. */
export async function listPublicClubsReading(db: Db, bookId: string, limit = 3): Promise<Club[]> {
  return db
    .select()
    .from(clubs)
    .where(and(eq(clubs.visibility, "public"), eq(clubs.currentBookId, bookId)))
    .orderBy(desc(clubs.updatedAt))
    .limit(limit);
}

/** Clubs the user is an active member of. */
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

/** Regenerate the join code, invalidating the previous one. Returns the new code. */
export async function rotateJoinCode(db: Db, id: string): Promise<string> {
  const code = generateJoinCode();
  await db.update(clubs).set({ joinCode: code, updatedAt: new Date() }).where(eq(clubs.id, id));
  return code;
}

export async function deleteClub(db: Db, id: string): Promise<void> {
  // FK cascade removes members/threads/posts/polls/meetings/schedule/books.
  await db.delete(clubs).where(eq(clubs.id, id));
}

/** Point the club at an existing book (catalog or community) and log it in history. */
export async function setCurrentBook(db: Db, clubId: string, bookId: string): Promise<void> {
  const now = new Date();
  await db
    .update(clubBooks)
    .set({ isCurrent: false })
    .where(and(eq(clubBooks.clubId, clubId), eq(clubBooks.isCurrent, true)));
  await db.insert(clubBooks).values({ clubId, bookId, startedAt: now, isCurrent: true });
  await db.update(clubs).set({ currentBookId: bookId, updatedAt: now }).where(eq(clubs.id, clubId));
}

// -- Membership -------------------------------------------------------------

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

/** Active member counts for many clubs at once, keyed by club id. */
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

/** Insert or move a membership row to a new status/role. */
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

/** Active-member user ids for a club, minus one optional excluded id (the actor).
 *  Used by the event emitter to notify a club without notifying the actor. */
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
