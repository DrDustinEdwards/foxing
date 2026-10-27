import { env } from "cloudflare:test";
import { createDb, schema } from "@foxing/core";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { callApi, seedUser, testApi } from "./test-api";

// Offline sync + push, exercised web -> api -> core -> D1 against local D1. This
// is the device-independent proof of the sync protocol: idempotent create replay,
// row-level LWW, progress = greatest client_ts, delete idempotency, append-only sessions,
// pull-by-cursor, and push token registration. Device behavior (airplane-mode queue +
// real push receipt) is a separate human gate.

const call = (path: string, req?: Parameters<typeof callApi>[2]) => callApi(testApi(), path, req);

const db = () => createDb(env.DB);

async function seedBook(id: string) {
  await db()
    .insert(schema.books)
    .values({
      id,
      title: `Book ${id}`,
      author: "Author",
      slug: `book-${id}`,
      source: "test",
      sourceType: "catalog",
      language: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

async function push(user: string, ops: unknown[]) {
  const res = await call("/sync", { method: "POST", user, body: { ops } });
  return (await res.json()) as {
    results: { id: string; status: string; action: string; reason?: string }[];
  };
}

describe("sync API (web -> api -> core -> D1)", () => {
  beforeEach(async () => {
    const d = db();
    for (const t of [
      schema.pushTokens,
      schema.notifications,
      schema.annotations,
      schema.diaryEntries,
      schema.vocabulary,
      schema.readingSessions,
      schema.userBooks,
      schema.books,
      schema.profiles,
      schema.user,
    ]) {
      await d.delete(t);
    }
  });

  it("create is applied, and a replayed create is an idempotent no-op", async () => {
    await seedUser("alice");
    await seedBook("b1");
    const op = {
      id: "ann-1",
      resource: "annotation",
      verb: "create",
      clientTs: 1000,
      payload: {
        bookId: "b1",
        type: "highlight",
        selectedText: "hello world",
        locator: { href: "x" },
      },
    };
    const first = await push("alice", [op]);
    expect(first.results[0]).toMatchObject({ status: "applied", action: "insert" });

    const replay = await push("alice", [op]);
    expect(replay.results[0]).toMatchObject({ status: "skipped", reason: "replay" });

    const rows = await db()
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.id, "ann-1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].normalizedText).toBe("hello world"); // computed on insert
  });

  it("update obeys row-level LWW: older op skipped, newer op applied", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await push("alice", [
      {
        id: "ann-2",
        resource: "annotation",
        verb: "create",
        clientTs: 2000,
        payload: { bookId: "b1", type: "note", body: "v1" },
      },
    ]);

    const stale = await push("alice", [
      {
        id: "ann-2",
        resource: "annotation",
        verb: "update",
        clientTs: 1500,
        payload: { body: "stale" },
      },
    ]);
    expect(stale.results[0]).toMatchObject({ status: "skipped", reason: "stale" });

    const fresh = await push("alice", [
      {
        id: "ann-2",
        resource: "annotation",
        verb: "update",
        clientTs: 3000,
        payload: { body: "v2" },
      },
    ]);
    expect(fresh.results[0]).toMatchObject({ status: "applied", action: "update" });

    const [row] = await db()
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.id, "ann-2"));
    expect(row.body).toBe("v2");
  });

  it("user_book progress: greatest client_ts wins regardless of arrival order", async () => {
    await seedUser("alice");
    await seedBook("b1");
    // Apply the newer progress first, then an older one out of order.
    await push("alice", [
      {
        id: "ub-op-late",
        resource: "user_book",
        verb: "update",
        clientTs: 5000,
        payload: { bookId: "b1", status: "reading", progressPct: 80 },
      },
    ]);
    const older = await push("alice", [
      {
        id: "ub-op-early",
        resource: "user_book",
        verb: "update",
        clientTs: 4000,
        payload: { bookId: "b1", status: "reading", progressPct: 40 },
      },
    ]);
    expect(older.results[0]).toMatchObject({ status: "skipped", reason: "stale" });

    const [row] = await db()
      .select()
      .from(schema.userBooks)
      .where(and(eq(schema.userBooks.userId, "alice"), eq(schema.userBooks.bookId, "b1")));
    expect(row.progressPct).toBe(80); // the later client_ts stuck
  });

  it("delete is idempotent (deleting a missing row succeeds)", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await push("alice", [
      {
        id: "v-1",
        resource: "vocabulary",
        verb: "create",
        clientTs: 100,
        payload: { word: "foxing", definition: "n." },
      },
    ]);
    const del1 = await push("alice", [
      { id: "v-1", resource: "vocabulary", verb: "delete", clientTs: 200 },
    ]);
    expect(del1.results[0]).toMatchObject({ status: "applied", action: "delete" });
    const del2 = await push("alice", [
      { id: "v-1", resource: "vocabulary", verb: "delete", clientTs: 300 },
    ]);
    expect(del2.results[0]).toMatchObject({ status: "skipped", reason: "missing_ok" });
  });

  it("sessions are append-only: a create sticks, an update is a no-op", async () => {
    await seedUser("alice");
    await seedBook("b1");
    const create = await push("alice", [
      {
        id: "sess-1",
        resource: "session",
        verb: "create",
        clientTs: 100,
        payload: { bookId: "b1", startedAt: 100, endedAt: 200, pagesRead: 5 },
      },
    ]);
    expect(create.results[0]).toMatchObject({ status: "applied", action: "insert" });
    const update = await push("alice", [
      {
        id: "sess-1",
        resource: "session",
        verb: "update",
        clientTs: 300,
        payload: { bookId: "b1", startedAt: 100, pagesRead: 99 },
      },
    ]);
    expect(update.results[0]).toMatchObject({ status: "skipped", reason: "append_only" });
    const [row] = await db()
      .select()
      .from(schema.readingSessions)
      .where(eq(schema.readingSessions.id, "sess-1"));
    expect(row.pagesRead).toBe(5);
  });

  it("ops are scoped to the session user (payload cannot forge another user's row)", async () => {
    await seedUser("alice");
    await seedUser("bob");
    await seedBook("b1");
    await push("alice", [
      {
        id: "ann-x",
        resource: "annotation",
        verb: "create",
        clientTs: 100,
        payload: { bookId: "b1", type: "highlight", selectedText: "mine", user_id: "bob" },
      },
    ]);
    const [row] = await db()
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.id, "ann-x"));
    expect(row.userId).toBe("alice"); // forced to the session user, not payload.user_id
  });

  it("GET /sync pulls changed rows since a cursor and returns a new cursor", async () => {
    await seedUser("alice");
    await seedBook("b1");
    await push("alice", [
      {
        id: "ann-p",
        resource: "annotation",
        verb: "create",
        clientTs: 10_000,
        payload: { bookId: "b1", type: "highlight", selectedText: "pulled" },
      },
    ]);
    const res = await call("/sync?since=0", { user: "alice" });
    const body = (await res.json()) as { cursor: number; changes: Record<string, unknown[]> };
    expect(body.changes.annotation).toHaveLength(1);
    expect(body.cursor).toBeGreaterThanOrEqual(10_000);
  });

  it("push register writes a token row; notifications endpoint reads the user's list", async () => {
    await seedUser("alice");
    const reg = await call("/push/register", {
      method: "POST",
      user: "alice",
      body: { token: "ExponentPushToken[abc]", platform: "ios" },
    });
    expect(reg.status).toBe(201);
    const [tok] = await db()
      .select()
      .from(schema.pushTokens)
      .where(eq(schema.pushTokens.userId, "alice"));
    expect(tok.token).toBe("ExponentPushToken[abc]");

    const list = await call("/notifications", { user: "alice" });
    const body = (await list.json()) as { notifications: unknown[]; unread: number };
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.unread).toBe(0);
  });
});
