import { env } from "cloudflare:test";
import type { ClubLiveHub } from "@foxing/api";
import { type LiveMessage, createDb, schema } from "@foxing/core";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { callApi, seedUser, testApi } from "./test-api";

// Captures every live broadcast so tests can assert the write -> commit -> notify path
// fires with the right message, without a real Durable Object.
function captureHub(): { hub: ClubLiveHub; sent: { clubId: string; message: LiveMessage[] }[] } {
  const sent: { clubId: string; message: LiveMessage[] }[] = [];
  return {
    sent,
    hub: {
      async broadcast(clubId, message) {
        sent.push({ clubId, message: Array.isArray(message) ? message : [message] });
      },
      async connect() {
        return new Response(null, { status: 101 });
      },
    },
  };
}

function apiWith(hub?: ClubLiveHub) {
  return testApi({
    resolveHub: hub ? () => hub : undefined,
  });
}

const call = (path: string, req?: Parameters<typeof callApi>[2], hub?: ClubLiveHub) =>
  callApi(apiWith(hub), path, req);

async function createClub(user: string, overrides: Record<string, unknown> = {}) {
  const res = await call("/clubs", {
    method: "POST",
    user,
    body: { name: "Test Club", ...overrides },
  });
  return { res, body: (await res.json()) as { club: { id: string; joinCode: string } } };
}

describe("clubs API (web -> api -> core -> D1)", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    // Children first (FKs), then clubs, then users.
    for (const t of [
      schema.clubPollVotes,
      schema.clubPolls,
      schema.clubPosts,
      schema.clubThreads,
      schema.clubMeetingRsvps,
      schema.clubMeetings,
      schema.clubSchedule,
      schema.clubBooks,
      schema.clubMembers,
      schema.clubs,
      schema.notifications,
      schema.activityEvents,
      schema.profiles,
      schema.user,
    ]) {
      await db.delete(t);
    }
  });

  it("clubs are free: both free and plus users can create (201)", async () => {
    await seedUser("free_user", "free");
    await seedUser("plus_user", "plus");

    const free = await call("/clubs", { method: "POST", user: "free_user", body: { name: "X" } });
    expect(free.status).toBe(201);

    const plus = await call("/clubs", { method: "POST", user: "plus_user", body: { name: "Y" } });
    expect(plus.status).toBe(201);
  });

  it("creating a club makes the creator an active owner", async () => {
    await seedUser("owner1", "plus");
    const { body } = await createClub("owner1");
    const db = createDb(env.DB);
    const [member] = await db
      .select()
      .from(schema.clubMembers)
      .where(
        and(eq(schema.clubMembers.clubId, body.club.id), eq(schema.clubMembers.userId, "owner1")),
      );
    expect(member.role).toBe("owner");
    expect(member.status).toBe("active");
  });

  it("open club: a free user joins directly and becomes active", async () => {
    await seedUser("owner2", "plus");
    await seedUser("joiner", "free");
    const { body } = await createClub("owner2");

    const res = await call(`/clubs/${body.club.id}/join`, { method: "POST", user: "joiner" });
    expect(res.status).toBe(201);
    const { member } = (await res.json()) as { member: { status: string } };
    expect(member.status).toBe("active");
  });

  it("approval-gated club: join is 'requested' and notifies the owner; approve activates + notifies", async () => {
    await seedUser("owner3", "plus");
    await seedUser("req_user", "free");
    const { body } = await createClub("owner3", { memberApproval: true });

    const join = await call(`/clubs/${body.club.id}/join`, { method: "POST", user: "req_user" });
    const { member } = (await join.json()) as { member: { status: string } };
    expect(member.status).toBe("requested");

    const db = createDb(env.DB);
    const ownerNotifs = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, "owner3"),
          eq(schema.notifications.type, "club_request"),
        ),
      );
    expect(ownerNotifs).toHaveLength(1);

    const approve = await call(`/clubs/${body.club.id}/members/req_user/approve`, {
      method: "POST",
      user: "owner3",
    });
    expect(approve.status).toBe(200);

    const [after] = await db
      .select()
      .from(schema.clubMembers)
      .where(
        and(eq(schema.clubMembers.clubId, body.club.id), eq(schema.clubMembers.userId, "req_user")),
      );
    expect(after.status).toBe("active");
    const approvalNotif = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, "req_user"),
          eq(schema.notifications.type, "club_approval"),
        ),
      );
    expect(approvalNotif).toHaveLength(1);
    const joinedActivity = await db
      .select()
      .from(schema.activityEvents)
      .where(
        and(
          eq(schema.activityEvents.userId, "req_user"),
          eq(schema.activityEvents.type, "joined_club"),
        ),
      );
    expect(joinedActivity).toHaveLength(1);
  });

  it("PLANT: a private club's children and join-by-id are hidden from non-members; the invite code still works", async () => {
    // Grok audit 2026-10-21, FX-1: only GET /clubs/:id checked membership, and
    // joinClub let anyone with the id in, at the default settings. The child reads are
    // now one page read, so the page and the thread read are what must stay hidden.
    await seedUser("owner_p", "plus");
    await seedUser("outsider", "free");
    const { body } = await createClub("owner_p", { visibility: "private" });
    const id = body.club.id;

    const thread = await call(`/clubs/${id}/threads`, {
      method: "POST",
      user: "owner_p",
      body: { title: "Members only" },
    });
    const threadId = ((await thread.json()) as { thread: { id: string } }).thread.id;
    for (const path of [`/clubs/${id}`, `/threads/${threadId}`]) {
      expect((await call(path, { user: "outsider" })).status, path).toBe(404);
      expect((await call(path)).status, `${path} anonymous`).toBe(404);
    }
    expect((await call(`/clubs/${id}/join`, { method: "POST", user: "outsider" })).status).toBe(
      404,
    );

    const byCode = await call(`/join/${body.club.joinCode}`, { method: "POST", user: "outsider" });
    expect(byCode.status).toBe(201);
    expect((await call(`/clubs/${id}`, { user: "outsider" })).status).toBe(200);

    // A private join is not a public activity row the feed would hand to followers.
    const db = createDb(env.DB);
    const joined = await db
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.targetId, id));
    expect(joined).toHaveLength(0);
  });

  it("join code lifecycle: rotate invalidates the old code, new one works", async () => {
    await seedUser("owner4", "plus");
    await seedUser("code_joiner", "free");
    const { body } = await createClub("owner4");
    const oldCode = body.club.joinCode;

    const rotate = await call(`/clubs/${body.club.id}/invite-code`, {
      method: "POST",
      user: "owner4",
    });
    const { joinCode: newCode } = (await rotate.json()) as { joinCode: string };
    expect(newCode).not.toBe(oldCode);

    const stale = await call(`/join/${oldCode}`, { method: "POST", user: "code_joiner" });
    expect(stale.status).toBe(404);

    const fresh = await call(`/join/${newCode}`, { method: "POST", user: "code_joiner" });
    expect(fresh.status).toBe(201);
  });

  it("thread + post: broadcasts live and notifies the thread author on reply", async () => {
    await seedUser("owner5", "plus");
    await seedUser("member5", "free");
    const { body } = await createClub("owner5");
    await call(`/clubs/${body.club.id}/join`, { method: "POST", user: "member5" });

    const { hub, sent } = captureHub();
    const threadRes = await call(
      `/clubs/${body.club.id}/threads`,
      { method: "POST", user: "owner5", body: { title: "Chapter 1", body: "Kick off" } },
      hub,
    );
    expect(threadRes.status).toBe(201);
    const { thread } = (await threadRes.json()) as { thread: { id: string } };
    expect(sent.at(-1)?.message[0]?.t).toBe("thread");

    const postRes = await call(
      `/threads/${thread.id}/posts`,
      { method: "POST", user: "member5", body: { content: "My take" } },
      hub,
    );
    expect(postRes.status).toBe(201);
    expect(sent.at(-1)?.message[0]?.t).toBe("post");

    const db = createDb(env.DB);
    const reply = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, "owner5"),
          eq(schema.notifications.type, "thread_reply"),
        ),
      );
    expect(reply).toHaveLength(1);
  });

  it("poll: vote broadcasts a live tally, close computes + persists the result", async () => {
    await seedUser("owner6", "plus");
    await seedUser("voter6", "free");
    const { body } = await createClub("owner6");
    await call(`/clubs/${body.club.id}/join`, { method: "POST", user: "voter6" });

    const { hub, sent } = captureHub();
    const pollRes = await call(
      `/clubs/${body.club.id}/polls`,
      {
        method: "POST",
        user: "owner6",
        body: {
          title: "Next read",
          options: [
            { id: "o1", label: "Book A" },
            { id: "o2", label: "Book B" },
          ],
        },
      },
      hub,
    );
    const { poll } = (await pollRes.json()) as { poll: { id: string } };

    await call(
      `/polls/${poll.id}/vote`,
      { method: "POST", user: "owner6", body: { ranks: ["o1"] } },
      hub,
    );
    await call(
      `/polls/${poll.id}/vote`,
      { method: "POST", user: "voter6", body: { ranks: ["o1"] } },
      hub,
    );
    const tallyMsg = sent.at(-1)?.message[0];
    expect(tallyMsg?.t).toBe("tally");
    if (tallyMsg?.t === "tally") expect(tallyMsg.tallies.o1).toBe(2);

    const closeRes = await call(`/polls/${poll.id}/close`, { method: "POST", user: "owner6" }, hub);
    const { result } = (await closeRes.json()) as { result: { winnerId: string } };
    expect(result.winnerId).toBe("o1");

    const db = createDb(env.DB);
    const [row] = await db.select().from(schema.clubPolls).where(eq(schema.clubPolls.id, poll.id));
    expect(row.isClosed).toBe(true);
    const closedNotif = await db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, "voter6"), eq(schema.notifications.type, "poll")));
    // one for poll.created + one for poll.closed
    expect(closedNotif.length).toBeGreaterThanOrEqual(1);
  });

  it("a member's live socket upgrades through the API to the club's ClubRoom", async () => {
    // The hub as the Worker builds it: the upgrade is forwarded to the real Durable Object,
    // whose 101 carries the socket and headers that cannot be changed.
    const ns = (env as unknown as { CLUB_ROOM: DurableObjectNamespace }).CLUB_ROOM;
    const hub: ClubLiveHub = {
      async broadcast() {},
      async connect(clubId, userId, request) {
        const url = new URL(request.url);
        url.searchParams.set("uid", userId);
        return ns.getByName(clubId).fetch(new Request(url, request));
      },
    };
    await seedUser("liveowner", "plus");
    const { body } = await createClub("liveowner");
    const res = await apiWith(hub).fetch(
      new Request(`https://test.local/clubs/${body.club.id}/live`, {
        headers: { "x-test-user": "liveowner", Upgrade: "websocket" },
      }),
      env as never,
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("the 101 has no socket");
    const first = new Promise<string>((done) =>
      ws.addEventListener("message", (e) => done(String(e.data))),
    );
    ws.accept();
    expect(JSON.parse(await first)).toEqual({ t: "presence", users: ["liveowner"] });
    ws.close();
  });

  it("a non-member cannot post", async () => {
    await seedUser("owner7", "plus");
    await seedUser("outsider", "free");
    const { body } = await createClub("owner7");
    const threadRes = await call(`/clubs/${body.club.id}/threads`, {
      method: "POST",
      user: "owner7",
      body: { title: "T" },
    });
    const { thread } = (await threadRes.json()) as { thread: { id: string } };

    const res = await call(`/threads/${thread.id}/posts`, {
      method: "POST",
      user: "outsider",
      body: { content: "let me in" },
    });
    expect(res.status).toBe(403);
  });

  it("deleting an account hands the club to the chosen member, keeps their posts, and a bad pick changes nothing", async () => {
    await seedUser("leaver", "plus");
    await seedUser("stayer", "free");
    await seedUser("outsider2", "free");
    const { body } = await createClub("leaver");
    const clubId = body.club.id;
    await call(`/clubs/${clubId}/join`, { method: "POST", user: "stayer" });
    const threadRes = await call(`/clubs/${clubId}/threads`, {
      method: "POST",
      user: "stayer",
      body: { title: "Chapter one" },
    });
    const { thread } = (await threadRes.json()) as { thread: { id: string } };
    await call(`/threads/${thread.id}/posts`, {
      method: "POST",
      user: "stayer",
      body: { content: "I loved it" },
    });

    const plan = await call("/account/clubs", { user: "leaver" });
    const { clubs } = (await plan.json()) as {
      clubs: { clubId: string; candidates: { userId: string }[]; suggested: string }[];
    };
    expect(clubs).toHaveLength(1);
    expect(clubs[0].suggested).toBe("stayer");

    // A pick who is not an active member is refused, and the batch never runs.
    const bad = await call("/account", {
      method: "DELETE",
      user: "leaver",
      body: { successors: { [clubId]: "outsider2" } },
    });
    expect(bad.status).toBe(422);
    const db = createDb(env.DB);
    expect(await db.select().from(schema.user).where(eq(schema.user.id, "leaver"))).toHaveLength(1);

    const ok = await call("/account", {
      method: "DELETE",
      user: "leaver",
      body: { successors: { [clubId]: "stayer" } },
    });
    expect(ok.status).toBe(204);
    const [club] = await db.select().from(schema.clubs).where(eq(schema.clubs.id, clubId));
    expect(club.creatorId).toBe("stayer");
    const [member] = await db
      .select()
      .from(schema.clubMembers)
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, "stayer")));
    expect(member.role).toBe("owner");
    expect(
      await db.select().from(schema.clubPosts).where(eq(schema.clubPosts.authorId, "stayer")),
    ).toHaveLength(1);
    const notes = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, "stayer"),
          eq(schema.notifications.type, "club_ownership"),
        ),
      );
    expect(notes).toHaveLength(1);
    expect(await db.select().from(schema.user).where(eq(schema.user.id, "leaver"))).toHaveLength(0);
  });
});
