// Club endpoints: CRUD, membership, threads/posts, polls, meetings,
// schedule, and the live WebSocket. Handlers stay thin: guard the session, validate,
// call the core clubs domain (which authorizes, commits to D1, and emits events), then
// -- only after that returns -- relay any `live` message to the club's ClubRoom via the
// injected hub. That ordering is the invariant: D1 commits first, then the DO fans out.
// The DO never writes D1.
import { Hono } from "hono";
import {
  type LiveMessage,
  clubsDomain,
  clubsRepo,
  createClubInput,
  createMeetingInput,
  createPollInput,
  createScheduleInput,
  createThreadInput,
  createPostInput,
  firstPreferenceTallies,
  muteMemberInput,
  removePostInput,
  rsvpInput,
  setRoleInput,
  updateClubInput,
  votePollInput,
} from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Context } from "hono";
import type { Env } from "../types";

export const clubRoutes = new Hono<Env>();

function actorOf(c: Context<Env>) {
  const session = requireSession(c);
  return { session, actor: { userId: session.id, timezone: c.get("profile")?.timezone } };
}

// Fan out to the club's ClubRoom AFTER the write committed. A live-layer failure must
// never fail an already-committed write, so this is best-effort and swallowed.
async function notify(c: Context<Env>, clubId: string, live: LiveMessage | LiveMessage[]) {
  try {
    await c.get("hub").broadcast(clubId, live);
  } catch (err) {
    console.error(`[clubs] live broadcast failed for ${clubId}`, err);
  }
}

// -- Reads (also callable in-process by loaders via clubsRepo) --------------

clubRoutes.get("/clubs", async (c) => {
  const clubs = await clubsRepo.listPublicClubs(c.get("db"));
  return c.json({ clubs });
});

clubRoutes.get("/clubs/mine", async (c) => {
  const session = requireSession(c);
  const clubs = await clubsRepo.listClubsForUser(c.get("db"), session.id);
  return c.json({ clubs });
});

clubRoutes.get("/clubs/:id", async (c) => {
  const db = c.get("db");
  const session = c.get("session");
  const club = await clubsRepo.getClubById(db, c.req.param("id"));
  if (!club) throw errors.notFound("Club not found.");
  const membership = session ? await clubsRepo.getMembership(db, club.id, session.id) : null;
  // Private clubs are visible only to their members.
  if (club.visibility === "private" && membership?.status !== "active") {
    throw errors.notFound("Club not found.");
  }
  return c.json({ club, membership });
});

clubRoutes.get("/clubs/:id/members", async (c) => {
  const members = await clubsRepo.listMembers(c.get("db"), c.req.param("id"));
  return c.json({ members });
});

clubRoutes.get("/clubs/:id/threads", async (c) => {
  const threads = await clubsRepo.listThreads(c.get("db"), c.req.param("id"));
  return c.json({ threads });
});

clubRoutes.get("/threads/:id", async (c) => {
  const db = c.get("db");
  const thread = await clubsRepo.getThreadById(db, c.req.param("id"));
  if (!thread || thread.isRemoved) throw errors.notFound("Thread not found.");
  const posts = await clubsRepo.listPosts(db, thread.id);
  return c.json({ thread, posts });
});

clubRoutes.get("/clubs/:id/polls", async (c) => {
  const db = c.get("db");
  const polls = await clubsRepo.listPolls(db, c.req.param("id"));
  const withTallies = await Promise.all(
    polls.map(async (poll) => {
      const votes = await clubsRepo.listVotes(db, poll.id);
      const tallies = firstPreferenceTallies(
        (poll.options ?? []).map((o) => o.id),
        votes.map((v) => v.ranks),
      );
      return { poll, tallies, voteCount: votes.length };
    }),
  );
  return c.json({ polls: withTallies });
});

clubRoutes.get("/clubs/:id/meetings", async (c) => {
  const meetings = await clubsRepo.listMeetings(c.get("db"), c.req.param("id"));
  return c.json({ meetings });
});

clubRoutes.get("/clubs/:id/schedule", async (c) => {
  const schedule = await clubsRepo.listSchedule(c.get("db"), c.req.param("id"));
  return c.json({ schedule });
});

// Public invite preview: club summary for the join page + OG image.
clubRoutes.get("/join/:code", async (c) => {
  const club = await clubsRepo.getClubByJoinCode(c.get("db"), c.req.param("code"));
  if (!club) throw errors.notFound("This invite link is no longer valid.");
  const memberCount = await clubsRepo.countActiveMembers(c.get("db"), club.id);
  return c.json({
    club: {
      id: club.id,
      slug: club.slug,
      name: club.name,
      description: club.description,
      coverUrl: club.coverUrl,
      memberApproval: club.memberApproval,
    },
    memberCount,
  });
});

// -- Club CRUD --------------------------------------------------------------

clubRoutes.post("/clubs", rateLimit("write"), async (c) => {
  const { session } = actorOf(c);
  // Clubs are free: creating, joining, posting, polls, and inline passage comments are
  // all part of the free social product. Plus gates the AI companion, never clubs.
  const input = await parseJson(c, createClubInput);
  const club = await clubsDomain.createClub(c.get("db"), session.id, input);
  return c.json({ club }, 201);
});

clubRoutes.patch("/clubs/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, updateClubInput);
  const club = await clubsDomain.updateClub(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ club });
});

clubRoutes.delete("/clubs/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await clubsDomain.deleteClub(c.get("db"), actor, c.req.param("id"));
  return c.json({ ok: true });
});

clubRoutes.post("/clubs/:id/invite-code", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const joinCode = await clubsDomain.rotateInviteCode(c.get("db"), actor, c.req.param("id"));
  return c.json({ joinCode });
});

// -- Membership -------------------------------------------------------------

clubRoutes.post("/clubs/:id/join", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const member = await clubsDomain.joinClub(c.get("db"), actor, c.req.param("id"));
  return c.json({ member }, 201);
});

clubRoutes.post("/join/:code", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { member, club } = await clubsDomain.joinByCode(c.get("db"), actor, c.req.param("code"));
  return c.json({ member, club }, 201);
});

clubRoutes.delete("/clubs/:id/members/me", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await clubsDomain.leaveClub(c.get("db"), actor, c.req.param("id"));
  return c.json({ ok: true });
});

clubRoutes.post("/clubs/:id/members/:userId/approve", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const member = await clubsDomain.approveMember(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("userId"),
  );
  return c.json({ member });
});

clubRoutes.post("/clubs/:id/members/:userId/ban", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const reason = (await c.req.raw
    .clone()
    .json()
    .catch(() => ({}))) as { reason?: string };
  const member = await clubsDomain.banMember(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("userId"),
    reason?.reason,
  );
  return c.json({ member });
});

clubRoutes.post("/clubs/:id/members/:userId/unban", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const member = await clubsDomain.unbanMember(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("userId"),
  );
  return c.json({ member });
});

clubRoutes.post("/clubs/:id/members/:userId/mute", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { minutes } = await parseJson(c, muteMemberInput);
  const member = await clubsDomain.muteMember(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("userId"),
    minutes,
    Date.now(),
  );
  return c.json({ member });
});

clubRoutes.post("/clubs/:id/members/:userId/role", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { role } = await parseJson(c, setRoleInput);
  const member = await clubsDomain.setMemberRole(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("userId"),
    role,
  );
  return c.json({ member });
});

// -- Threads + posts --------------------------------------------------------

clubRoutes.post("/clubs/:id/threads", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createThreadInput);
  const { thread, clubId, live } = await clubsDomain.createThread(
    c.get("db"),
    actor,
    c.req.param("id"),
    input,
  );
  await notify(c, clubId, live);
  return c.json({ thread }, 201);
});

clubRoutes.post("/threads/:id/posts", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createPostInput);
  const { post, clubId, live } = await clubsDomain.createPost(
    c.get("db"),
    actor,
    c.req.param("id"),
    input,
  );
  await notify(c, clubId, live);
  return c.json({ post }, 201);
});

clubRoutes.delete("/posts/:id", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { reason } = await parseJson(c, removePostInput).catch(() => ({ reason: undefined }));
  const { post, clubId, live } = await clubsDomain.removePost(
    c.get("db"),
    actor,
    c.req.param("id"),
    reason,
  );
  await notify(c, clubId, live);
  return c.json({ post });
});

// -- Polls ------------------------------------------------------------------

clubRoutes.post("/clubs/:id/polls", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createPollInput);
  const poll = await clubsDomain.createPoll(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ poll }, 201);
});

clubRoutes.post("/polls/:id/vote", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { ranks } = await parseJson(c, votePollInput);
  const { clubId, live } = await clubsDomain.votePoll(c.get("db"), actor, c.req.param("id"), ranks);
  await notify(c, clubId, live);
  return c.json({ ok: true });
});

clubRoutes.post("/polls/:id/close", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { clubId, result, live } = await clubsDomain.closePoll(
    c.get("db"),
    actor,
    c.req.param("id"),
  );
  await notify(c, clubId, live);
  return c.json({ result });
});

// -- Meetings ---------------------------------------------------------------

clubRoutes.post("/clubs/:id/meetings", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createMeetingInput);
  const meeting = await clubsDomain.createMeeting(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ meeting }, 201);
});

clubRoutes.post("/meetings/:id/cancel", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const meeting = await clubsDomain.cancelMeeting(c.get("db"), actor, c.req.param("id"));
  return c.json({ meeting });
});

clubRoutes.post("/meetings/:id/rsvp", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const { status } = await parseJson(c, rsvpInput);
  await clubsDomain.rsvpMeeting(c.get("db"), actor, c.req.param("id"), status);
  return c.json({ ok: true });
});

// -- Schedule ---------------------------------------------------------------

clubRoutes.post("/clubs/:id/schedule", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  const input = await parseJson(c, createScheduleInput);
  const entry = await clubsDomain.addSchedule(c.get("db"), actor, c.req.param("id"), input);
  return c.json({ entry }, 201);
});

clubRoutes.delete("/clubs/:id/schedule/:scheduleId", rateLimit("write"), async (c) => {
  const { actor } = actorOf(c);
  await clubsDomain.removeSchedule(
    c.get("db"),
    actor,
    c.req.param("id"),
    c.req.param("scheduleId"),
  );
  return c.json({ ok: true });
});

// -- Live layer (WebSocket) -------------------------------------------------
// Membership is checked BEFORE the upgrade, so a non-member never gets a socket into
// the ClubRoom. The hub forwards the upgrade to the club's own Durable Object; every
// broadcast is scoped to that one club's sockets by construction (one DO per club).
clubRoutes.get("/clubs/:id/live", async (c) => {
  const session = requireSession(c);
  const clubId = c.req.param("id");
  const membership = await clubsRepo.getMembership(c.get("db"), clubId, session.id);
  if (!membership || membership.status !== "active") {
    throw errors.forbidden("Join this club to connect to its live room.");
  }
  return c.get("hub").connect(clubId, session.id, c.req.raw);
});
