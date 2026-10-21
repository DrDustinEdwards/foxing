// Club data access. Pure DB reads/writes over the 10 club tables; no
// permission logic and no event emission (that lives in domain/clubs.ts). Reads are
// called in-process from web/mobile loaders; writes are called by the API layer after
// the domain layer has authorized them. All fan-out to the live layer happens AFTER
// these commit -- this file never touches a Durable Object.
import { and, desc, eq, isNotNull, like, sql } from "drizzle-orm";
import { customAlphabet, nanoid } from "nanoid";
import type { Db } from "../db";
import type { ClubMemberRole, ClubMemberStatus } from "../enums";
import {
  clubBooks,
  clubMeetingRsvps,
  clubMeetings,
  clubMembers,
  clubPollVotes,
  clubPolls,
  clubPosts,
  clubSchedule,
  clubThreads,
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
  return `${base || "club"}-${nanoid(6).toLowerCase()}`;
}

// -- Clubs ------------------------------------------------------------------

/** Public clubs matching a name query, for the command palette's federated search.
 *  Only PUBLIC clubs with a slug are returned, so this is safe on the anonymous suggest
 *  endpoint (private clubs never surface here). */
export async function searchClubs(
  db: Db,
  query: string,
  limit = 4,
): Promise<{ slug: string; name: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const term = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({ slug: clubs.slug, name: clubs.name })
    .from(clubs)
    .where(and(like(clubs.name, term), eq(clubs.visibility, "public"), isNotNull(clubs.slug)))
    .limit(limit);
  return rows.filter((r): r is { slug: string; name: string } => r.slug != null);
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

// -- Threads ----------------------------------------------------------------

export async function createThread(
  db: Db,
  clubId: string,
  authorId: string,
  input: {
    type?: string;
    title: string;
    bookId?: string;
    chapter?: string;
    hasSpoilers?: boolean;
    expiresAt?: number;
    isAiStarter?: boolean;
  },
): Promise<ClubThread> {
  const [row] = await db
    .insert(clubThreads)
    .values({
      clubId,
      authorId,
      type: input.type ?? "discussion",
      title: input.title,
      bookId: input.bookId ?? null,
      chapter: input.chapter ?? null,
      hasSpoilers: input.hasSpoilers ?? false,
      isAiStarter: input.isAiStarter ?? false,
      expiresAt: input.expiresAt != null ? new Date(input.expiresAt) : null,
    })
    .returning();
  return row;
}

export async function getThreadById(db: Db, id: string): Promise<ClubThread | null> {
  const [row] = await db.select().from(clubThreads).where(eq(clubThreads.id, id)).limit(1);
  return row ?? null;
}

export async function listThreads(db: Db, clubId: string, limit = 50): Promise<ClubThread[]> {
  return db
    .select()
    .from(clubThreads)
    .where(and(eq(clubThreads.clubId, clubId), eq(clubThreads.isRemoved, false)))
    .orderBy(desc(clubThreads.isPinned), desc(clubThreads.createdAt))
    .limit(limit);
}

export async function removeThread(
  db: Db,
  id: string,
  removedBy: string,
): Promise<ClubThread | null> {
  const [row] = await db
    .update(clubThreads)
    .set({ isRemoved: true, removedBy, removedAt: new Date() })
    .where(eq(clubThreads.id, id))
    .returning();
  return row ?? null;
}

// -- Posts ------------------------------------------------------------------

export async function createPost(
  db: Db,
  threadId: string,
  authorId: string,
  input: { content: string; parentPostId?: string; hasSpoiler?: boolean },
): Promise<ClubPost> {
  const [row] = await db
    .insert(clubPosts)
    .values({
      threadId,
      authorId,
      content: input.content,
      parentPostId: input.parentPostId ?? null,
      hasSpoiler: input.hasSpoiler ?? false,
    })
    .returning();
  return row;
}

export async function getPostById(db: Db, id: string): Promise<ClubPost | null> {
  const [row] = await db.select().from(clubPosts).where(eq(clubPosts.id, id)).limit(1);
  return row ?? null;
}

export async function listPosts(db: Db, threadId: string, limit = 200): Promise<ClubPost[]> {
  return db
    .select()
    .from(clubPosts)
    .where(and(eq(clubPosts.threadId, threadId), eq(clubPosts.isRemoved, false)))
    .orderBy(clubPosts.createdAt)
    .limit(limit);
}

export async function removePost(
  db: Db,
  id: string,
  removedBy: string,
  reason?: string,
): Promise<ClubPost | null> {
  const [row] = await db
    .update(clubPosts)
    .set({ isRemoved: true, removedBy, removedReason: reason ?? null, removedAt: new Date() })
    .where(eq(clubPosts.id, id))
    .returning();
  return row ?? null;
}

// -- Polls ------------------------------------------------------------------

export async function createPoll(
  db: Db,
  clubId: string,
  createdBy: string,
  input: {
    title: string;
    description?: string;
    pollType?: string;
    options: { id: string; label: string; bookId?: string }[];
    closesAt?: number;
  },
): Promise<ClubPoll> {
  const [row] = await db
    .insert(clubPolls)
    .values({
      clubId,
      createdBy,
      title: input.title,
      description: input.description ?? null,
      pollType: input.pollType ?? "single",
      options: input.options,
      closesAt: input.closesAt != null ? new Date(input.closesAt) : null,
    })
    .returning();
  return row;
}

export async function getPollById(db: Db, id: string): Promise<ClubPoll | null> {
  const [row] = await db.select().from(clubPolls).where(eq(clubPolls.id, id)).limit(1);
  return row ?? null;
}

export async function listPolls(db: Db, clubId: string): Promise<ClubPoll[]> {
  return db
    .select()
    .from(clubPolls)
    .where(eq(clubPolls.clubId, clubId))
    .orderBy(desc(clubPolls.createdAt));
}

export async function upsertVote(
  db: Db,
  pollId: string,
  userId: string,
  ranks: string[],
): Promise<void> {
  await db
    .insert(clubPollVotes)
    .values({ pollId, userId, ranks })
    .onConflictDoUpdate({
      target: [clubPollVotes.pollId, clubPollVotes.userId],
      set: { ranks },
    });
}

export async function listVotes(db: Db, pollId: string): Promise<ClubPollVote[]> {
  return db.select().from(clubPollVotes).where(eq(clubPollVotes.pollId, pollId));
}

export async function closePoll(db: Db, id: string): Promise<ClubPoll | null> {
  const [row] = await db
    .update(clubPolls)
    .set({ isClosed: true, updatedAt: new Date() })
    .where(eq(clubPolls.id, id))
    .returning();
  return row ?? null;
}

// -- Meetings ---------------------------------------------------------------

export async function createMeeting(
  db: Db,
  clubId: string,
  createdBy: string,
  input: {
    title: string;
    description?: string;
    bookId?: string;
    meetingDate: number;
    endDate?: number;
    meetingType?: string;
    locationName?: string;
    locationAddress?: string;
    locationUrl?: string;
    isRecurring?: boolean;
    recurrenceRule?: string;
    rsvpLimit?: number;
  },
): Promise<ClubMeeting> {
  const [row] = await db
    .insert(clubMeetings)
    .values({
      clubId,
      createdBy,
      title: input.title,
      description: input.description ?? null,
      bookId: input.bookId ?? null,
      meetingDate: new Date(input.meetingDate),
      endDate: input.endDate != null ? new Date(input.endDate) : null,
      meetingType: input.meetingType ?? "virtual",
      locationName: input.locationName ?? null,
      locationAddress: input.locationAddress ?? null,
      locationUrl: input.locationUrl ?? null,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.recurrenceRule ?? null,
      rsvpLimit: input.rsvpLimit ?? null,
    })
    .returning();
  return row;
}

export async function getMeetingById(db: Db, id: string): Promise<ClubMeeting | null> {
  const [row] = await db.select().from(clubMeetings).where(eq(clubMeetings.id, id)).limit(1);
  return row ?? null;
}

export async function listMeetings(db: Db, clubId: string): Promise<ClubMeeting[]> {
  return db
    .select()
    .from(clubMeetings)
    .where(eq(clubMeetings.clubId, clubId))
    .orderBy(clubMeetings.meetingDate);
}

export async function cancelMeeting(db: Db, id: string): Promise<ClubMeeting | null> {
  const [row] = await db
    .update(clubMeetings)
    .set({ isCancelled: true, cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(clubMeetings.id, id))
    .returning();
  return row ?? null;
}

export async function upsertRsvp(
  db: Db,
  meetingId: string,
  userId: string,
  status: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(clubMeetingRsvps)
    .values({ meetingId, userId, status, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [clubMeetingRsvps.meetingId, clubMeetingRsvps.userId],
      set: { status, updatedAt: now },
    });
}

export async function listRsvps(db: Db, meetingId: string): Promise<ClubMeetingRsvp[]> {
  return db.select().from(clubMeetingRsvps).where(eq(clubMeetingRsvps.meetingId, meetingId));
}

// -- Schedule ---------------------------------------------------------------

export async function createSchedule(
  db: Db,
  clubId: string,
  input: { chapterName: string; unlockDate: number },
): Promise<ClubScheduleRow> {
  const [row] = await db
    .insert(clubSchedule)
    .values({ clubId, chapterName: input.chapterName, unlockDate: new Date(input.unlockDate) })
    .returning();
  return row;
}

export async function listSchedule(db: Db, clubId: string): Promise<ClubScheduleRow[]> {
  return db
    .select()
    .from(clubSchedule)
    .where(eq(clubSchedule.clubId, clubId))
    .orderBy(clubSchedule.unlockDate);
}

export async function deleteSchedule(db: Db, id: string, clubId: string): Promise<boolean> {
  const rows = await db
    .delete(clubSchedule)
    .where(and(eq(clubSchedule.id, id), eq(clubSchedule.clubId, clubId)))
    .returning({ id: clubSchedule.id });
  return rows.length > 0;
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
