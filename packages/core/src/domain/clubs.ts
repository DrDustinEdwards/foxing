// Club domain logic. This is where authorization, event emission, and the
// decision of WHAT to fan out over the live layer all live -- in core, never in a
// client and never in the Durable Object. Each write commits to D1 (via clubsRepo),
// emits notifications/activity (via emit), and returns any `live` message for the API
// to relay to the club's ClubRoom AFTER this returns. That ordering is the invariant:
// D1 first, then notify. The DO never writes D1.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import type { ClubMemberRole } from "../enums";
import { emit, type EventActor } from "../events";
import * as clubsRepo from "../repositories/clubs";
import { books } from "../schema";
import { domainErrors } from "./errors";
import * as membership from "./membership";
import { computePollResult, firstPreferenceTallies } from "./poll-result";

// Messages the API relays to a club's ClubRoom. Plain data (no DO coupling): the API
// hands these to the injected hub notifier. Presence is produced by the DO itself.
export type LiveMessage =
  | { t: "thread"; thread: clubsRepo.ClubThread }
  | { t: "post"; post: clubsRepo.ClubPost }
  | { t: "tally"; poll_id: string; tallies: Record<string, number>; closed?: boolean }
  | { t: "notice"; kind: string; [k: string]: unknown };

async function bookTitle(db: Db, bookId: string): Promise<string> {
  const [row] = await db.select({ title: books.title }).from(books).where(eq(books.id, bookId));
  return row?.title ?? "";
}

/** Load the actor's membership and require it be active. Throws forbidden otherwise. */
async function requireActive(
  db: Db,
  clubId: string,
  userId: string,
): Promise<clubsRepo.ClubMember> {
  const m = await clubsRepo.getMembership(db, clubId, userId);
  if (!m || !membership.isActiveMember(m.status)) {
    throw domainErrors.forbidden("Join this club first.");
  }
  return m;
}

async function requireModerator(
  db: Db,
  clubId: string,
  userId: string,
): Promise<clubsRepo.ClubMember> {
  const m = await requireActive(db, clubId, userId);
  if (!membership.canModerate(m.role as ClubMemberRole)) {
    throw domainErrors.forbidden("Moderator access required.");
  }
  return m;
}

// -- Club CRUD --------------------------------------------------------------
// Clubs are free: no tier gate on creation. Everything below is membership/role
// authorization, which is domain logic (Plus gates the AI companion, never clubs).

export async function createClub(
  db: Db,
  creatorId: string,
  input: Parameters<typeof clubsRepo.createClub>[2],
): Promise<clubsRepo.Club> {
  return clubsRepo.createClub(db, creatorId, input);
}

export async function updateClub(
  db: Db,
  actor: EventActor,
  clubId: string,
  patch: {
    name?: string;
    description?: string | null;
    coverUrl?: string | null;
    visibility?: string;
    memberApproval?: boolean;
    maxMembers?: number | null;
    readingPace?: string | null;
    chaptersPerWeek?: number | null;
    genreTags?: string[] | null;
    currentBookId?: string | null;
  },
): Promise<clubsRepo.Club> {
  await requireModerator(db, clubId, actor.userId);
  const { currentBookId, ...rest } = patch;
  if (currentBookId !== undefined && currentBookId !== null) {
    // Pick an existing book (catalog or community). Search-to-add a new community book
    // is deferred (see deferred-items.md).
    const [exists] = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.id, currentBookId));
    if (!exists) throw domainErrors.notFound("Book not found.");
    await clubsRepo.setCurrentBook(db, clubId, currentBookId);
  }
  const updated = await clubsRepo.updateClub(db, clubId, {
    ...rest,
    ...(currentBookId === null ? { currentBookId: null } : {}),
  });
  if (!updated) throw domainErrors.notFound("Club not found.");
  return updated;
}

export async function deleteClub(db: Db, actor: EventActor, clubId: string): Promise<void> {
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  // Only the creator (owner) may delete the club.
  if (club.creatorId !== actor.userId) {
    throw domainErrors.forbidden("Only the club creator can delete it.");
  }
  // An explicit creator action on their own club. Deleting an account instead hands the
  // club to another member (deleteAccount in account.ts).
  await clubsRepo.deleteClub(db, clubId);
}

export async function rotateInviteCode(db: Db, actor: EventActor, clubId: string): Promise<string> {
  await requireModerator(db, clubId, actor.userId);
  return clubsRepo.rotateJoinCode(db, clubId);
}

// -- Membership -------------------------------------------------------------

/** Whether a member's role (the raw text column) may moderate: see ban and mute details. */
export function canModerateRole(role: string | null | undefined): boolean {
  return membership.canModerate(role as ClubMemberRole);
}

export async function joinClub(
  db: Db,
  actor: EventActor,
  clubId: string,
  opts: { viaInvite?: boolean } = {},
): Promise<clubsRepo.ClubMember> {
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");

  const existing = await clubsRepo.getMembership(db, clubId, actor.userId);
  if (existing?.status === "active") return existing;
  if (existing?.status === "banned") throw domainErrors.forbidden("You are banned from this club.");
  // A private club is joined through its invite code or an invitation, never by id: the
  // same "not found" a non-member gets from GET /clubs/:id (Grok audit 2026-10-21, FX-1).
  if (club.visibility === "private" && !opts.viaInvite && existing?.status !== "invited") {
    throw domainErrors.notFound("Club not found.");
  }

  const activeCount = await clubsRepo.countActiveMembers(db, clubId);
  const status = membership.resolveJoinStatus(
    { memberApproval: club.memberApproval, maxMembers: club.maxMembers },
    activeCount,
  );
  const now = new Date();
  const member = await clubsRepo.upsertMembership(db, clubId, actor.userId, {
    status,
    role: "member",
    requestedAt: status === "requested" ? now : null,
    joinedAt: status === "active" ? now : null,
  });

  if (status === "active") {
    await emit(db, "club.member.joined", actor, {
      clubId,
      clubName: club.name,
      isPrivate: club.visibility === "private",
    });
  } else if (status === "requested") {
    await emit(db, "club.join.requested", actor, {
      clubId,
      clubName: club.name,
      ownerId: club.creatorId,
    });
  }
  return member;
}

export async function joinByCode(
  db: Db,
  actor: EventActor,
  code: string,
): Promise<{ member: clubsRepo.ClubMember; club: clubsRepo.Club }> {
  const club = await clubsRepo.getClubByJoinCode(db, code);
  if (!club) throw domainErrors.notFound("This invite link is no longer valid.");
  const member = await joinClub(db, actor, club.id, { viaInvite: true });
  return { member, club };
}

export async function leaveClub(db: Db, actor: EventActor, clubId: string): Promise<void> {
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  if (club.creatorId === actor.userId) {
    throw domainErrors.conflict("The creator cannot leave; delete or transfer the club instead.");
  }
  await clubsRepo.setMemberStatus(db, clubId, actor.userId, "left");
}

export async function approveMember(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
): Promise<clubsRepo.ClubMember> {
  await requireModerator(db, clubId, actor.userId);
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  const target = await clubsRepo.getMembership(db, clubId, targetUserId);
  if (!target || !membership.canApprove(target.status)) {
    throw domainErrors.conflict("No pending request for that user.");
  }
  const member = await clubsRepo.setMemberStatus(db, clubId, targetUserId, "active", {
    joinedAt: new Date(),
  });
  await emit(
    db,
    "club.member.approved",
    { userId: targetUserId },
    {
      clubId,
      clubName: club.name,
      isPrivate: club.visibility === "private",
    },
  );
  return member as clubsRepo.ClubMember;
}

async function moderateTarget(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
): Promise<{ actorRole: ClubMemberRole; targetRole: ClubMemberRole }> {
  const actorM = await requireModerator(db, clubId, actor.userId);
  const target = await clubsRepo.getMembership(db, clubId, targetUserId);
  if (!target) throw domainErrors.notFound("That member is not in this club.");
  const actorRole = actorM.role as ClubMemberRole;
  const targetRole = target.role as ClubMemberRole;
  if (!membership.canActOn(actorRole, targetRole)) {
    throw domainErrors.forbidden("You cannot moderate that member.");
  }
  return { actorRole, targetRole };
}

export async function banMember(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
  reason?: string,
): Promise<clubsRepo.ClubMember> {
  await moderateTarget(db, actor, clubId, targetUserId);
  const member = await clubsRepo.setMemberStatus(db, clubId, targetUserId, "banned", {
    bannedAt: new Date(),
    bannedBy: actor.userId,
    banReason: reason ?? null,
  });
  return member as clubsRepo.ClubMember;
}

export async function unbanMember(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
): Promise<clubsRepo.ClubMember> {
  await requireModerator(db, clubId, actor.userId);
  const target = await clubsRepo.getMembership(db, clubId, targetUserId);
  if (!target || !membership.canUnban(target.status)) {
    throw domainErrors.conflict("That member is not banned.");
  }
  const member = await clubsRepo.setMemberStatus(db, clubId, targetUserId, "active", {
    bannedAt: null,
    bannedBy: null,
    banReason: null,
    joinedAt: new Date(),
  });
  return member as clubsRepo.ClubMember;
}

export async function muteMember(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
  minutes: number,
  nowMs: number,
): Promise<clubsRepo.ClubMember> {
  await moderateTarget(db, actor, clubId, targetUserId);
  const until = membership.muteUntil(nowMs, minutes);
  const member = await clubsRepo.setMemberMute(
    db,
    clubId,
    targetUserId,
    until ? new Date(until) : null,
    actor.userId,
  );
  return member as clubsRepo.ClubMember;
}

export async function setMemberRole(
  db: Db,
  actor: EventActor,
  clubId: string,
  targetUserId: string,
  newRole: ClubMemberRole,
): Promise<clubsRepo.ClubMember> {
  const actorM = await requireActive(db, clubId, actor.userId);
  const target = await clubsRepo.getMembership(db, clubId, targetUserId);
  if (!target) throw domainErrors.notFound("That member is not in this club.");
  if (
    !membership.canSetRole(actorM.role as ClubMemberRole, target.role as ClubMemberRole, newRole)
  ) {
    throw domainErrors.forbidden("Only the owner can change roles.");
  }
  const member = await clubsRepo.setMemberRole(db, clubId, targetUserId, newRole);
  return member as clubsRepo.ClubMember;
}

// -- Threads + posts --------------------------------------------------------

export async function createThread(
  db: Db,
  actor: EventActor,
  clubId: string,
  input: {
    type?: string;
    title: string;
    bookId?: string;
    chapter?: string;
    hasSpoilers?: boolean;
    expiresAt?: number;
    body?: string;
  },
): Promise<{ thread: clubsRepo.ClubThread; clubId: string; live: LiveMessage }> {
  const m = await requireActive(db, clubId, actor.userId);
  if (membership.isMuted(m.mutedUntil, Date.now())) {
    throw domainErrors.forbidden("You are muted in this club.");
  }
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");

  const thread = await clubsRepo.createThread(db, clubId, actor.userId, input);
  if (input.body) {
    await clubsRepo.createPost(db, thread.id, actor.userId, { content: input.body });
  }

  // Announcement threads notify every active member; discussion threads rely on the
  // live broadcast (no per-member notification, to keep the notification feed usable).
  if (thread.type === "announcement") {
    const recipientIds = await clubsRepo.listActiveMemberIds(db, clubId, actor.userId);
    await emit(db, "club.thread.announced", actor, {
      recipientIds,
      clubName: club.name,
      threadTitle: thread.title,
      threadId: thread.id,
    });
  }

  return { thread, clubId, live: { t: "thread", thread } };
}

export async function createPost(
  db: Db,
  actor: EventActor,
  threadId: string,
  input: { content: string; parentPostId?: string; hasSpoiler?: boolean },
): Promise<{ post: clubsRepo.ClubPost; clubId: string; live: LiveMessage }> {
  const thread = await clubsRepo.getThreadById(db, threadId);
  if (!thread || thread.isRemoved) throw domainErrors.notFound("Thread not found.");
  const m = await requireActive(db, thread.clubId, actor.userId);
  if (membership.isMuted(m.mutedUntil, Date.now())) {
    throw domainErrors.forbidden("You are muted in this club.");
  }

  let parentAuthorId: string | null = null;
  if (input.parentPostId) {
    const parent = await clubsRepo.getPostById(db, input.parentPostId);
    if (!parent || parent.threadId !== threadId)
      throw domainErrors.notFound("Parent post not found.");
    parentAuthorId = parent.authorId;
  }

  const post = await clubsRepo.createPost(db, threadId, actor.userId, input);

  // Notify the thread author (thread_reply) and the parent-post author (post_reply),
  // deduped and never the actor themselves.
  const notify: { userId: string; type: "thread_reply" | "post_reply" }[] = [];
  if (thread.authorId !== actor.userId)
    notify.push({ userId: thread.authorId, type: "thread_reply" });
  if (parentAuthorId && parentAuthorId !== actor.userId && parentAuthorId !== thread.authorId) {
    notify.push({ userId: parentAuthorId, type: "post_reply" });
  }
  if (notify.length > 0) {
    await emit(db, "club.post.created", actor, { notify, threadId, threadTitle: thread.title });
  }

  return { post, clubId: thread.clubId, live: { t: "post", post } };
}

export async function removePost(
  db: Db,
  actor: EventActor,
  postId: string,
  reason?: string,
): Promise<{ post: clubsRepo.ClubPost; clubId: string; live: LiveMessage }> {
  const post = await clubsRepo.getPostById(db, postId);
  if (!post) throw domainErrors.notFound("Post not found.");
  const thread = await clubsRepo.getThreadById(db, post.threadId);
  if (!thread) throw domainErrors.notFound("Thread not found.");
  // Moderators/owners may remove any post; an author may remove their own.
  if (post.authorId !== actor.userId) {
    await requireModerator(db, thread.clubId, actor.userId);
  } else {
    await requireActive(db, thread.clubId, actor.userId);
  }
  const removed = await clubsRepo.removePost(db, postId, actor.userId, reason);
  return {
    post: removed as clubsRepo.ClubPost,
    clubId: thread.clubId,
    live: { t: "notice", kind: "post_removed", postId, threadId: thread.id },
  };
}

// -- Polls ------------------------------------------------------------------

export async function createPoll(
  db: Db,
  actor: EventActor,
  clubId: string,
  input: {
    title: string;
    description?: string;
    pollType?: string;
    options: { id: string; label: string; bookId?: string }[];
    closesAt?: number;
  },
): Promise<clubsRepo.ClubPoll> {
  await requireActive(db, clubId, actor.userId);
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  const poll = await clubsRepo.createPoll(db, clubId, actor.userId, input);
  const recipientIds = await clubsRepo.listActiveMemberIds(db, clubId, actor.userId);
  await emit(db, "club.poll.created", actor, {
    recipientIds,
    clubName: club.name,
    pollTitle: poll.title,
    pollId: poll.id,
  });
  return poll;
}

export async function votePoll(
  db: Db,
  actor: EventActor,
  pollId: string,
  ranks: string[],
): Promise<{ poll: clubsRepo.ClubPoll; clubId: string; live: LiveMessage }> {
  const poll = await clubsRepo.getPollById(db, pollId);
  if (!poll) throw domainErrors.notFound("Poll not found.");
  if (poll.isClosed) throw domainErrors.conflict("This poll is closed.");
  await requireActive(db, poll.clubId, actor.userId);

  const optionIds = new Set((poll.options ?? []).map((o) => o.id));
  if (ranks.length === 0 || ranks.some((id) => !optionIds.has(id))) {
    throw domainErrors.validation("Ballot references an unknown option.");
  }
  if (poll.pollType === "single" && ranks.length !== 1) {
    throw domainErrors.validation("This poll takes a single choice.");
  }
  if (new Set(ranks).size !== ranks.length) {
    throw domainErrors.validation("A ballot cannot rank the same option twice.");
  }

  await clubsRepo.upsertVote(db, pollId, actor.userId, ranks);
  const votes = await clubsRepo.listVotes(db, pollId);
  const tallies = firstPreferenceTallies(
    (poll.options ?? []).map((o) => o.id),
    votes.map((v) => v.ranks),
  );
  return { poll, clubId: poll.clubId, live: { t: "tally", poll_id: pollId, tallies } };
}

export async function closePoll(
  db: Db,
  actor: EventActor,
  pollId: string,
): Promise<{
  poll: clubsRepo.ClubPoll;
  clubId: string;
  result: ReturnType<typeof computePollResult>;
  live: LiveMessage;
}> {
  const poll = await clubsRepo.getPollById(db, pollId);
  if (!poll) throw domainErrors.notFound("Poll not found.");
  // The poll creator or a moderator may close it.
  if (poll.createdBy !== actor.userId) {
    await requireModerator(db, poll.clubId, actor.userId);
  } else {
    await requireActive(db, poll.clubId, actor.userId);
  }

  const votes = await clubsRepo.listVotes(db, pollId);
  const optionIds = (poll.options ?? []).map((o) => o.id);
  const result = computePollResult(
    poll.pollType === "irv" ? "irv" : "single",
    optionIds,
    votes.map((v) => v.ranks),
  );
  await clubsRepo.closePoll(db, pollId);

  // Persist the computed result in the close event's data json, and notify the club.
  const recipientIds = await clubsRepo.listActiveMemberIds(db, poll.clubId, actor.userId);
  await emit(db, "club.poll.closed", actor, {
    recipientIds,
    pollId,
    pollTitle: poll.title,
    result,
  });

  return {
    poll,
    clubId: poll.clubId,
    result,
    live: { t: "tally", poll_id: pollId, tallies: result.finalCounts, closed: true },
  };
}

// -- Meetings ---------------------------------------------------------------

export async function createMeeting(
  db: Db,
  actor: EventActor,
  clubId: string,
  input: Parameters<typeof clubsRepo.createMeeting>[3],
): Promise<clubsRepo.ClubMeeting> {
  await requireActive(db, clubId, actor.userId);
  const club = await clubsRepo.getClubById(db, clubId);
  if (!club) throw domainErrors.notFound("Club not found.");
  const meeting = await clubsRepo.createMeeting(db, clubId, actor.userId, input);
  const recipientIds = await clubsRepo.listActiveMemberIds(db, clubId, actor.userId);
  await emit(db, "club.meeting.created", actor, {
    recipientIds,
    clubName: club.name,
    meetingTitle: meeting.title,
    meetingId: meeting.id,
  });
  return meeting;
}

export async function cancelMeeting(
  db: Db,
  actor: EventActor,
  meetingId: string,
): Promise<clubsRepo.ClubMeeting> {
  const meeting = await clubsRepo.getMeetingById(db, meetingId);
  if (!meeting) throw domainErrors.notFound("Meeting not found.");
  if (meeting.createdBy !== actor.userId) {
    await requireModerator(db, meeting.clubId, actor.userId);
  } else {
    await requireActive(db, meeting.clubId, actor.userId);
  }
  const canceled = await clubsRepo.cancelMeeting(db, meetingId);
  return canceled as clubsRepo.ClubMeeting;
}

export async function rsvpMeeting(
  db: Db,
  actor: EventActor,
  meetingId: string,
  status: string,
): Promise<void> {
  const meeting = await clubsRepo.getMeetingById(db, meetingId);
  if (!meeting) throw domainErrors.notFound("Meeting not found.");
  await requireActive(db, meeting.clubId, actor.userId);
  await clubsRepo.upsertRsvp(db, meetingId, actor.userId, status);
}

// -- Schedule ---------------------------------------------------------------

export async function addSchedule(
  db: Db,
  actor: EventActor,
  clubId: string,
  input: { chapterName: string; unlockDate: number },
): Promise<clubsRepo.ClubScheduleRow> {
  await requireModerator(db, clubId, actor.userId);
  return clubsRepo.createSchedule(db, clubId, input);
}

export async function removeSchedule(
  db: Db,
  actor: EventActor,
  clubId: string,
  scheduleId: string,
): Promise<void> {
  await requireModerator(db, clubId, actor.userId);
  const ok = await clubsRepo.deleteSchedule(db, scheduleId, clubId);
  if (!ok) throw domainErrors.notFound("Schedule entry not found.");
}

/** Chapter-unlock gate: a chapter is readable once its unlock date has passed. Pure
 *  read used by the thread list and the reader club layer. */
export function isChapterUnlocked(unlockDate: Date, nowMs: number): boolean {
  return unlockDate.getTime() <= nowMs;
}
