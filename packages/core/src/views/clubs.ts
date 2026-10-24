// Club views: the clubs index, the club page and a thread page in their /api/v1 wire
// shape (@foxing/types). Each returns null when the viewer may not see it: a private
// club is "not found" to anyone but its active members (Grok audit 2026-10-21, FX-1).
import type * as W from "@foxing/types";
import type { Db } from "../db";
import { canModerateRole } from "../domain/clubs";
import { firstPreferenceTallies } from "../domain/poll-result";
import * as clubsRepo from "../repositories/clubs";
import { getProfileSummaries } from "../repositories/profiles";
import { bookRefs, ms } from "./wire";

async function cards(db: Db, clubs: clubsRepo.Club[]): Promise<W.ClubCard[]> {
  const [counts, books] = await Promise.all([
    clubsRepo.countActiveMembersFor(
      db,
      clubs.map((c) => c.id),
    ),
    bookRefs(
      db,
      clubs.map((c) => c.currentBookId),
    ),
  ]);
  return clubs.map((c) => card(c, counts.get(c.id) ?? 0, books));
}

function card(c: clubsRepo.Club, memberCount: number, books: Map<string, W.BookRef>): W.ClubCard {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    coverUrl: c.coverUrl,
    visibility: c.visibility as W.ClubCard["visibility"],
    isVerified: c.isVerified,
    memberCount,
    currentBook: c.currentBookId ? (books.get(c.currentBookId) ?? null) : null,
  };
}

export async function myClubs(db: Db, userId: string): Promise<W.ClubCard[]> {
  return cards(db, await clubsRepo.listClubsForUser(db, userId));
}

export async function publicClubs(db: Db, limit = 50): Promise<W.ClubCard[]> {
  return cards(db, await clubsRepo.listPublicClubs(db, limit));
}

/** The viewer's clubs, and public clubs they are not in yet. */
export async function clubsIndex(db: Db, userId: string): Promise<W.ClubsIndex> {
  const [mine, discover] = await Promise.all([myClubs(db, userId), publicClubs(db)]);
  const mineIds = new Set(mine.map((c) => c.id));
  return { mine, discover: discover.filter((c) => !mineIds.has(c.id)) };
}

/** A club the viewer may read, found by id or slug, with their membership. */
export async function readableClub(db: Db, idOrSlug: string, viewerId: string | null) {
  const club =
    (await clubsRepo.getClubById(db, idOrSlug)) ?? (await clubsRepo.getClubBySlug(db, idOrSlug));
  if (!club) return null;
  const membership = viewerId ? await clubsRepo.getMembership(db, club.id, viewerId) : null;
  const isMember = membership?.status === "active";
  if (club.visibility === "private" && !isMember) return null;
  return { club, membership, isMember };
}

function thread(t: clubsRepo.ClubThread, people: Map<string, W.ProfileSummary>): W.ClubThreadItem {
  return {
    id: t.id,
    title: t.title,
    type: t.type as W.ClubThreadItem["type"],
    chapter: t.chapter,
    isPinned: t.isPinned,
    isAiStarter: t.isAiStarter,
    hasSpoilers: t.hasSpoilers,
    author: people.get(t.authorId) ?? null,
    createdAt: t.createdAt.getTime(),
  };
}

export async function clubPage(
  db: Db,
  idOrSlug: string,
  viewerId: string | null,
): Promise<W.ClubPage | null> {
  const found = await readableClub(db, idOrSlug, viewerId);
  if (!found) return null;
  const { club, membership, isMember } = found;
  const isModerator = isMember && canModerateRole(membership?.role);

  const [threads, members, meetings, schedule, polls, books] = await Promise.all([
    clubsRepo.listThreads(db, club.id),
    clubsRepo.listMembers(db, club.id),
    clubsRepo.listMeetings(db, club.id),
    clubsRepo.listSchedule(db, club.id),
    clubsRepo.listPolls(db, club.id),
    bookRefs(db, [club.currentBookId]),
  ]);
  // Moderators see the whole roster with ban and mute details; everyone else sees
  // active members without them (FX-8).
  const roster = isModerator ? members : members.filter((m) => m.status === "active");
  const people = await getProfileSummaries(db, [
    ...threads.map((t) => t.authorId),
    ...roster.map((m) => m.userId),
  ]);

  const [pollItems, meetingItems] = await Promise.all([
    Promise.all(
      polls.map(async (poll): Promise<W.ClubPollItem> => {
        const votes = await clubsRepo.listVotes(db, poll.id);
        return {
          id: poll.id,
          title: poll.title,
          description: poll.description,
          pollType: poll.pollType as W.ClubPollItem["pollType"],
          options: poll.options ?? [],
          closesAt: ms(poll.closesAt),
          isClosed: poll.isClosed,
          createdBy: poll.createdBy,
          tallies: firstPreferenceTallies(
            (poll.options ?? []).map((o) => o.id),
            votes.map((v) => v.ranks),
          ),
          voteCount: votes.length,
          myVote: viewerId ? (votes.find((v) => v.userId === viewerId)?.ranks ?? null) : null,
        };
      }),
    ),
    Promise.all(
      meetings.map(async (m): Promise<W.ClubMeetingItem> => {
        const rsvps = await clubsRepo.listRsvps(db, m.id);
        const counts: Record<W.RsvpStatus, number> = { going: 0, maybe: 0, not_going: 0 };
        for (const r of rsvps) if (r.status in counts) counts[r.status as W.RsvpStatus]++;
        const mine = viewerId ? rsvps.find((r) => r.userId === viewerId) : undefined;
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          meetingDate: m.meetingDate.getTime(),
          endDate: ms(m.endDate),
          meetingType: m.meetingType,
          locationName: m.locationName,
          locationUrl: m.locationUrl,
          isCancelled: m.isCancelled,
          rsvps: counts,
          myRsvp: (mine?.status as W.RsvpStatus | undefined) ?? null,
        };
      }),
    ),
  ]);

  return {
    club: {
      ...card(club, members.filter((m) => m.status === "active").length, books),
      creatorId: club.creatorId,
      clubType: club.clubType,
      memberApproval: club.memberApproval,
      readingPace: club.readingPace,
      chaptersPerWeek: club.chaptersPerWeek,
      genreTags: club.genreTags ?? [],
      joinCode: isModerator ? club.joinCode : null,
      createdAt: club.createdAt.getTime(),
    },
    membership: membership
      ? { status: membership.status as W.ClubMemberStatus, role: membership.role as W.ClubRole }
      : null,
    isMember,
    isModerator,
    threads: threads.map((t) => thread(t, people)),
    members: roster.map((m) => ({
      userId: m.userId,
      profile: people.get(m.userId) ?? null,
      role: m.role as W.ClubRole,
      status: m.status as W.ClubMemberStatus,
      joinedAt: ms(m.joinedAt),
      ...(isModerator
        ? { mutedUntil: ms(m.mutedUntil), bannedAt: ms(m.bannedAt), banReason: m.banReason }
        : {}),
    })),
    polls: pollItems,
    meetings: meetingItems,
    schedule: schedule.map((s) => ({
      id: s.id,
      chapterName: s.chapterName,
      unlockDate: s.unlockDate.getTime(),
    })),
  };
}

/** A thread and its posts. clubIdOrSlug, when given, must be the thread's club. */
export async function threadPage(
  db: Db,
  threadId: string,
  viewerId: string | null,
  clubIdOrSlug?: string,
): Promise<W.ThreadPage | null> {
  const t = await clubsRepo.getThreadById(db, threadId);
  if (!t || t.isRemoved) return null;
  const found = await readableClub(db, t.clubId, viewerId);
  if (!found) return null;
  const { club, isMember } = found;
  if (clubIdOrSlug && clubIdOrSlug !== club.id && clubIdOrSlug !== club.slug) return null;

  const posts = await clubsRepo.listPosts(db, t.id);
  const people = await getProfileSummaries(db, [t.authorId, ...posts.map((p) => p.authorId)]);
  return {
    club: { id: club.id, slug: club.slug, name: club.name },
    isMember,
    thread: { ...thread(t, people), bookId: t.bookId },
    posts: posts.map((p) => ({
      id: p.id,
      parentPostId: p.parentPostId,
      content: p.content,
      hasSpoiler: p.hasSpoiler,
      isEdited: p.isEdited,
      isPinned: p.isPinned,
      author: people.get(p.authorId) ?? null,
      createdAt: p.createdAt.getTime(),
    })),
  };
}
