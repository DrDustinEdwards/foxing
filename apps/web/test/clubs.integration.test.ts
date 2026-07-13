import { env } from "cloudflare:test";
import { type ClubLiveHub, createApi } from "@foxing/api";
import { type LiveMessage, createDb, schema } from "@foxing/core";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

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
  return createApi({
    resolveSession: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id, email: `${id}@example.com` } : null;
    },
    resolveCompanionCaller: () =>
      // biome-ignore lint/correctness/useYield: throws on first iteration by design
      async function* unused() {
        throw new Error("not used in this suite");
      },
    resolveBilling: () => ({
      client: {
        async createCheckoutSession() {
          return { url: "" };
        },
        async createPortalSession() {
          return { url: "" };
        },
        async verifyWebhook() {
          throw new Error("unused");
        },
        async getSubscription() {
          throw new Error("unused");
        },
      },
      prices: { monthly: "", annual: "" },
    }),
    resolveHub: hub ? () => hub : undefined,
  });
}

async function seedUser(id: string, tier: "free" | "plus" = "free") {
  const db = createDb(env.DB);
  await db.insert(schema.user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.profiles).values({
    id,
    username: id,
    subscriptionTier: tier,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

type Req = { method?: string; user?: string; body?: unknown };
async function call(path: string, { method = "GET", user, body }: Req = {}, hub?: ClubLiveHub) {
  const api = apiWith(hub);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (user) headers["x-test-user"] = user;
  return api.fetch(
    new Request(`https://test.local${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env as never,
  );
}

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
});
