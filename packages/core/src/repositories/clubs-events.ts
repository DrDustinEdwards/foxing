import type { Db } from "../db";
import type {
  ClubMeeting,
  ClubMeetingRsvp,
  ClubPoll,
  ClubPollVote,
  ClubScheduleRow,
} from "./clubs";
import { clubMeetingRsvps, clubMeetings, clubPolls, clubPollVotes, clubSchedule } from "../schema";
import { and, desc, eq } from "drizzle-orm";

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
