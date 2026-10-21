// Club read plumbing for loaders. Reads run in-process via core (the standing rule:
// loaders never self-fetch the Worker's own /api/v1). Writes go to /api/v1 from the
// browser client and the page revalidates; the live layer pushes updates over the
// WebSocket. Kept separate from the route files so the shapes are testable.
import { clubsRepo, firstPreferenceTallies } from "@foxing/core";
import { createDb } from "@foxing/core";

export async function loadClubsIndex(env: Env, userId: string) {
  const db = createDb(env.DB);
  const [mine, discover] = await Promise.all([
    clubsRepo.listClubsForUser(db, userId),
    clubsRepo.listPublicClubs(db, 50),
  ]);
  const mineIds = new Set(mine.map((c) => c.id));
  return { mine, discover: discover.filter((c) => !mineIds.has(c.id)) };
}

export type PollWithTally = {
  poll: clubsRepo.ClubPoll;
  tallies: Record<string, number>;
  voteCount: number;
  myVote: string[] | null;
};

/** Full club detail bundle for the detail page. Returns null when the club does not
 *  exist or is private and the viewer is not an active member. */
export async function loadClubDetail(env: Env, slug: string, userId: string | null) {
  const db = createDb(env.DB);
  const club = await clubsRepo.getClubBySlug(db, slug);
  if (!club) return null;

  const membership = userId ? await clubsRepo.getMembership(db, club.id, userId) : null;
  const isMember = membership?.status === "active";
  if (club.visibility === "private" && !isMember) return null;

  const [threads, members, meetings, schedule, polls] = await Promise.all([
    clubsRepo.listThreads(db, club.id),
    clubsRepo.listMembers(db, club.id),
    clubsRepo.listMeetings(db, club.id),
    clubsRepo.listSchedule(db, club.id),
    clubsRepo.listPolls(db, club.id),
  ]);

  const pollsWithTallies: PollWithTally[] = await Promise.all(
    polls.map(async (poll) => {
      const votes = await clubsRepo.listVotes(db, poll.id);
      const tallies = firstPreferenceTallies(
        (poll.options ?? []).map((o) => o.id),
        votes.map((v) => v.ranks),
      );
      const myVote = userId ? (votes.find((v) => v.userId === userId)?.ranks ?? null) : null;
      return { poll, tallies, voteCount: votes.length, myVote };
    }),
  );

  return {
    club,
    membership,
    isMember,
    memberCount: members.filter((m) => m.status === "active").length,
    threads,
    members,
    meetings,
    schedule,
    polls: pollsWithTallies,
  };
}

export async function loadThreadDetail(
  env: Env,
  slug: string,
  threadId: string,
  userId: string | null,
) {
  const db = createDb(env.DB);
  const club = await clubsRepo.getClubBySlug(db, slug);
  if (!club) return null;
  const membership = userId ? await clubsRepo.getMembership(db, club.id, userId) : null;
  const isMember = membership?.status === "active";
  if (club.visibility === "private" && !isMember) return null;

  const thread = await clubsRepo.getThreadById(db, threadId);
  if (!thread || thread.isRemoved || thread.clubId !== club.id) return null;
  const posts = await clubsRepo.listPosts(db, thread.id);
  return { club, membership, isMember, thread, posts };
}
