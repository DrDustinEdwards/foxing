// Club polls, meetings and the reading schedule: same rules as clubs.ts (authorize, commit to D1, emit, return any `live` message).
import { emit, type EventActor } from "../events";
import type { Db } from "../db";
import * as clubsRepo from "../repositories/clubs";
import type { LiveMessage } from "./clubs";
import { requireActive, requireClub, requireModerator } from "./club-guards";
import { domainErrors } from "./errors";
import { computePollResult, firstPreferenceTallies } from "./poll-result";

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
  const club = await requireClub(db, clubId);
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
  if (poll.isClosed || (poll.closesAt?.getTime() ?? Infinity) <= Date.now())
    throw domainErrors.conflict("This poll is closed.");
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
  if (poll.isClosed) throw domainErrors.conflict("This poll is already closed.");
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

export async function createMeeting(
  db: Db,
  actor: EventActor,
  clubId: string,
  input: Parameters<typeof clubsRepo.createMeeting>[3],
): Promise<clubsRepo.ClubMeeting> {
  await requireActive(db, clubId, actor.userId);
  const club = await requireClub(db, clubId);
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
