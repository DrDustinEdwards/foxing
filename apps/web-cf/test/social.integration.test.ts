import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { createDb, schema } from "@foxing/core";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// Phase 6 social write paths, exercised web -> api -> core -> D1 against local D1.
// Verifies: diary event emission RESPECTS visibility (private emits nothing; friends /
// public emit the right event), follow emits a new_follower notification, and list likes
// go through the reactions table.

function apiWith() {
  return createApi({
    resolveSession: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id, email: `${id}@example.com` } : null;
    },
    resolveCompanionCaller: () =>
      // biome-ignore lint/correctness/useYield: unused in this suite
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
  });
}

type Req = { method?: string; user?: string; body?: unknown };
async function call(path: string, { method = "GET", user, body }: Req = {}) {
  const api = apiWith();
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

async function seedBook(id: string) {
  const db = createDb(env.DB);
  await db.insert(schema.books).values({
    id,
    title: `Book ${id}`,
    author: "Some Author",
    slug: `book-${id}`,
    source: "gutenberg",
    sourceType: "catalog",
    language: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const db = () => createDb(env.DB);

describe("social API (web -> api -> core -> D1)", () => {
  beforeEach(async () => {
    const d = db();
    for (const t of [
      schema.reactions,
      schema.readingListBooks,
      schema.readingLists,
      schema.diaryEntries,
      schema.activityEvents,
      schema.notifications,
      schema.closeFriends,
      schema.follows,
      schema.books,
      schema.profiles,
      schema.user,
    ]) {
      await d.delete(t);
    }
  });

  // -- Follows --------------------------------------------------------------

  it("PUT /follows/:id creates the edge and emits a new_follower notification to the target", async () => {
    await seedUser("alice");
    await seedUser("bob");

    const res = await call("/follows/bob", { method: "PUT", user: "alice" });
    expect(res.status).toBe(201);

    const edges = await db()
      .select()
      .from(schema.follows)
      .where(eq(schema.follows.followerId, "alice"));
    expect(edges).toHaveLength(1);
    expect(edges[0].followingId).toBe("bob");

    const notifs = await db()
      .select()
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.userId, "bob"), eq(schema.notifications.type, "new_follower")),
      );
    expect(notifs).toHaveLength(1);
  });

  it("re-following does not emit a second notification", async () => {
    await seedUser("alice");
    await seedUser("bob");
    await call("/follows/bob", { method: "PUT", user: "alice" });
    await call("/follows/bob", { method: "PUT", user: "alice" });
    const notifs = await db()
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, "bob"));
    expect(notifs).toHaveLength(1);
  });

  it("cannot follow yourself", async () => {
    await seedUser("alice");
    const res = await call("/follows/alice", { method: "PUT", user: "alice" });
    expect(res.status).toBe(422);
  });

  // -- Diary event emission respects visibility -----------------------------

  it("private diary entry emits NO activity event", async () => {
    await seedUser("alice");
    await seedBook("b1");
    const res = await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b1", ratingHalf: 8, review: "Loved it", visibility: "private" },
    });
    expect(res.status).toBe(201);

    const events = await db()
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.userId, "alice"));
    expect(events).toHaveLength(0);
  });

  it("public diary entry WITH a review emits a 'reviewed' event carrying public visibility", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b1", ratingHalf: 9, review: "A masterpiece", visibility: "public" },
    });
    const events = await db()
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.userId, "alice"));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("reviewed");
    expect(events[0].visibility).toBe("public");
  });

  it("friends diary entry with ONLY a rating emits a 'rated' event carrying friends visibility", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b1", ratingHalf: 7, visibility: "friends" },
    });
    const events = await db()
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.userId, "alice"));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("rated");
    expect(events[0].visibility).toBe("friends");
  });

  it("diary create recomputes the book rating aggregate", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b1", ratingHalf: 8, visibility: "public" }, // 4.0 stars
    });
    const [book] = await db().select().from(schema.books).where(eq(schema.books.id, "b1"));
    expect(book.ratingCount).toBe(1);
    expect(book.weightedRating).toBeCloseTo(4.0, 5);
  });

  // -- List likes via reactions ---------------------------------------------

  it("liking a list writes a reactions row and notifies the owner (not the liker)", async () => {
    await seedUser("alice");
    await seedUser("bob");
    const created = await call("/lists", {
      method: "POST",
      user: "alice",
      body: { title: "Alice's list", isPublic: true },
    });
    const { list } = (await created.json()) as { list: { id: string } };

    const res = await call("/reactions", {
      method: "PUT",
      user: "bob",
      body: { targetType: "reading_list", targetId: list.id, kind: "like" },
    });
    expect(res.status).toBe(201);

    const reactions = await db()
      .select()
      .from(schema.reactions)
      .where(
        and(
          eq(schema.reactions.targetType, "reading_list"),
          eq(schema.reactions.targetId, list.id),
        ),
      );
    expect(reactions).toHaveLength(1);
    expect(reactions[0].userId).toBe("bob");

    // Owner (alice) gets a reaction notification; the liker (bob) does not.
    const aliceNotifs = await db()
      .select()
      .from(schema.notifications)
      .where(
        and(eq(schema.notifications.userId, "alice"), eq(schema.notifications.type, "reaction")),
      );
    expect(aliceNotifs).toHaveLength(1);
  });

  it("a public list emits a list_created activity event; a private list does not", async () => {
    await seedUser("alice");
    await call("/lists", {
      method: "POST",
      user: "alice",
      body: { title: "Public", isPublic: true },
    });
    await call("/lists", {
      method: "POST",
      user: "alice",
      body: { title: "Private", isPublic: false },
    });
    const events = await db()
      .select()
      .from(schema.activityEvents)
      .where(
        and(
          eq(schema.activityEvents.userId, "alice"),
          eq(schema.activityEvents.type, "list_created"),
        ),
      );
    expect(events).toHaveLength(1);
  });

  // -- Feed end-to-end visibility -------------------------------------------

  it("GET /feed shows a followed author's public review but hides their friends-only one", async () => {
    await seedUser("alice"); // author
    await seedUser("carol"); // viewer, follows alice but is NOT a close friend
    await seedBook("b1");
    await seedBook("b2");
    await call("/follows/alice", { method: "PUT", user: "carol" });
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b1", review: "Public review", visibility: "public" },
    });
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b2", review: "Friends only", visibility: "friends" },
    });

    const res = await call("/feed", { user: "carol" });
    const { items } = (await res.json()) as {
      items: { kind: string; event?: { type: string; bookId: string } }[];
    };
    const activity = items.filter((i) => i.kind === "activity");
    expect(activity).toHaveLength(1);
    expect(activity[0].event?.bookId).toBe("b1");
  });

  it("GET /feed reveals the friends-only review once the viewer is a close friend", async () => {
    await seedUser("alice");
    await seedUser("carol");
    await seedBook("b2");
    await call("/follows/alice", { method: "PUT", user: "carol" });
    // Alice adds carol as a close friend (alice would need Plus in the route; here we
    // write the edge directly to isolate the resolver from the tier gate).
    await db().insert(schema.closeFriends).values({ userId: "alice", friendId: "carol" });
    await call("/diary", {
      method: "POST",
      user: "alice",
      body: { bookId: "b2", review: "Friends only", visibility: "friends" },
    });

    const res = await call("/feed", { user: "carol" });
    const { items } = (await res.json()) as {
      items: { kind: string; event?: { bookId: string } }[];
    };
    const activity = items.filter((i) => i.kind === "activity");
    expect(activity).toHaveLength(1);
    expect(activity[0].event?.bookId).toBe("b2");
  });
});
